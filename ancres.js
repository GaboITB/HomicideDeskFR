// Ancres : désigner un texte du jeu sans le recopier.
//
// Le patch doit retrouver des chaînes du studio dans le code du jeu (une personnalité anglaise, une
// ligne de règles, un libellé) pour les remplacer par leur traduction. Les écrire en clair dans le
// paquet publié reviendrait à redistribuer le texte du studio. Une ancre ne garde que sa longueur,
// une somme glissante de son début et une empreinte SHA-256 : chez le joueur, `resoudre()` parcourt
// SON jeu, retrouve la chaîne qui a cette empreinte et rend exactement la même donnée qu'en clair.
//
//   ancre   "#hdfr:<longueur>:<somme glissante du début>:<SHA-256 tronqué>"
//
// Un texte à nous qui reprend quelques phrases du studio telles quelles (une réécriture garde les
// bonnes phrases) est stocké en morceaux : { "_hdfr": ["#hdfr:…", " notre texte ", "#hdfr:…"] }.
// La résolution recolle les morceaux en une seule chaîne.
//
// Une ancre introuvable (le studio a changé le texte) reste telle quelle : le code qui l'utilise ne
// la trouve pas dans le jeu et le signale comme n'importe quel texte absent.
"use strict";
const crypto = require("crypto");

const P = 2147483647; // 2^31 - 1
const B = 257;
const DEBUT = 12; // longueur du début sur lequel porte la somme glissante
const FORME = /^#hdfr:(\d+):(\d+):([0-9a-f]{20})$/;

function sha(t) {
  return crypto.createHash("sha256").update(t, "utf8").digest("hex").slice(0, 20);
}
function somme(t) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * B + t.charCodeAt(i)) % P;
  return h;
}

/** L'ancre d'un texte (côté construction du paquet). */
function ancre(texte) {
  return "#hdfr:" + texte.length + ":" + somme(texte.slice(0, DEBUT)) + ":" + sha(texte);
}
function estAncre(v) {
  return typeof v === "string" && FORME.test(v);
}
function estMorceaux(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && Array.isArray(v._hdfr);
}

/**
 * Retire d'une donnée résolue les valeurs restées ancres (texte changé par le studio), dans les
 * objets seulement : afficher « #hdfr:… » serait pire que garder le texte du studio. Les tableaux
 * sont laissés tels quels, leur rang compte (le code qui les lit saute les ancres). Rend le nombre
 * de valeurs retirées.
 */
function purger(v) {
  let n = 0;
  if (Array.isArray(v)) v.forEach((x) => { if (x && typeof x === "object") n += purger(x); });
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      if (estAncre(x)) { delete v[k]; n++; }
      else if (x && typeof x === "object") n += purger(x);
    }
  return n;
}

/** Une passe de somme glissante de largeur `w` sur le bundle. `table` : somme -> ancres. */
function passe(bundle, w, table, trouve) {
  let h = 0, pw = 1;
  for (let i = 0; i < w - 1; i++) pw = (pw * B) % P;
  for (let i = 0; i < bundle.length; i++) {
    if (i >= w) h = (h - ((bundle.charCodeAt(i - w) * pw) % P) + P) % P;
    h = (h * B + bundle.charCodeAt(i)) % P;
    if (i < w - 1) continue;
    const candidates = table.get(h);
    if (!candidates) continue;
    const debut = i - w + 1;
    for (const a of candidates) {
      if (trouve.has(a.texte)) continue;
      if (debut + a.n > bundle.length) continue;
      const t = bundle.substr(debut, a.n);
      if (sha(t) === a.h) trouve.set(a.texte, t);
    }
  }
}

/** Remplace, dans une donnée JSON quelconque (clés et valeurs), chaque ancre par le texte du jeu. */
function resoudre(donnee, bundle) {
  const ancres = new Map();
  (function collecter(v) {
    if (estAncre(v)) {
      const [, n, p, h] = v.match(FORME);
      ancres.set(v, { texte: v, n: Number(n), p: Number(p), h });
    } else if (Array.isArray(v)) v.forEach(collecter);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { collecter(k); collecter(x); }
  })(donnee);
  if (!ancres.size) return donnee;

  // Une passe par largeur : DEBUT pour les textes longs, la longueur exacte pour les courts.
  const parLargeur = new Map();
  for (const a of ancres.values()) {
    const w = Math.min(a.n, DEBUT);
    if (!parLargeur.has(w)) parLargeur.set(w, new Map());
    const t = parLargeur.get(w);
    if (!t.has(a.p)) t.set(a.p, []);
    t.get(a.p).push(a);
  }
  const trouve = new Map();
  for (const [w, table] of parLargeur) passe(bundle, w, table, trouve);

  const r = (v) => (estAncre(v) && trouve.has(v) ? trouve.get(v) : v);
  return (function rendre(v) {
    if (typeof v === "string") return r(v);
    if (Array.isArray(v)) return v.map(rendre);
    if (estMorceaux(v)) {
      // Un morceau introuvable rend tout le texte introuvable : on renvoie son ancre, que
      // l'appelant traite comme n'importe quelle ancre non résolue.
      const parts = v._hdfr.map(r);
      const manque = parts.find(estAncre);
      return manque !== undefined ? manque : parts.join("");
    }
    if (v && typeof v === "object") {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[r(k)] = rendre(x);
      return o;
    }
    return v;
  })(donnee);
}

/** Nombre d'ancres d'une donnée, et combien restent introuvables après résolution. */
function compter(donnee) {
  let n = 0;
  (function c(v) {
    if (estAncre(v)) n++;
    else if (Array.isArray(v)) v.forEach(c);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { c(k); c(x); }
  })(donnee);
  return n;
}

/**
 * Résout les VALEURS ancrées d'un fichier plat d'affaire ({ "<chemin>": "<texte>" }). Une valeur
 * restée ancre (le studio a changé ce texte) est retirée plutôt qu'affichée telle quelle : le jeu
 * garde alors son propre texte à cet endroit. Rend { plat, retires }.
 */
function resoudrePlat(plat, bundle) {
  const r = resoudre(plat, bundle);
  const retires = [];
  for (const [k, v] of Object.entries(r)) if (estAncre(v)) { delete r[k]; retires.push(k); }
  return { plat: r, retires };
}

/** Le bundle d'origine du jeu du joueur (celui d'app.asar.orig s'il existe, sinon app.asar). */
function bundleDuJeu() {
  const fs = require("fs");
  const path = require("path");
  const asar = require("@electron/asar");
  const jeu = process.env.HD_GAME_DIR || "D:\\SteamLibrary\\steamapps\\common\\Homicide Desk";
  const res = path.join(jeu, "resources");
  const a = fs.existsSync(path.join(res, "app.asar.orig")) ? path.join(res, "app.asar.orig") : path.join(res, "app.asar");
  const html = asar.extractFile(a, path.join("dist", "index.html")).toString();
  return asar.extractFile(a, path.join("dist", "assets", html.match(/assets\/(index-[^"]+\.js)/)[1])).toString("utf8");
}

/**
 * Côté construction du paquet : un texte devient une ancre s'il figure tel quel dans le jeu, sinon
 * ses phrases et ses lignes de 25 caractères ou plus qui y figurent deviennent des ancres, le reste
 * garde notre texte. Rend le texte inchangé s'il ne reprend rien du jeu.
 */
const SEPARATEUR = /(\n|(?<=[.!?])\s+)/;
const MIN_PHRASE = 25;
function ancrerTexte(texte, bundle, min = 12) {
  if (typeof texte !== "string") return texte;
  if (texte.length >= min && bundle.includes(texte)) return ancre(texte);
  const parts = [];
  let ancrees = 0;
  texte.split(SEPARATEUR).forEach((morceau, i) => {
    if (i % 2 === 1) { parts.push(morceau); return; } // séparateur, gardé tel quel
    const coeur = morceau.trim();
    if (coeur.length >= MIN_PHRASE && bundle.includes(coeur)) {
      const debut = morceau.indexOf(coeur);
      if (debut > 0) parts.push(morceau.slice(0, debut));
      parts.push(ancre(coeur));
      if (debut + coeur.length < morceau.length) parts.push(morceau.slice(debut + coeur.length));
      ancrees++;
    } else parts.push(morceau);
  });
  // morceaux voisins en clair fusionnés, pour un fichier lisible
  const fusion = [];
  for (const p of parts) {
    if (p === "") continue;
    if (fusion.length && !estAncre(p) && !estAncre(fusion[fusion.length - 1])) fusion[fusion.length - 1] += p;
    else fusion.push(p);
  }
  // Deux phrases courtes mises bout à bout peuvent reproduire un passage du jeu que le découpage
  // phrase par phrase ne voyait pas. Tant qu'un morceau en clair en contient un, on l'y ancre.
  for (let i = 0; i < fusion.length; i++) {
    const p = fusion[i];
    if (estAncre(p)) continue;
    const trouve = [p, ...p.split(SEPARATEUR)].map((m) => m.trim()).find((m) => m.length >= MIN_PHRASE && bundle.includes(m));
    if (!trouve) continue;
    const debut = p.indexOf(trouve);
    const neuf = [p.slice(0, debut), ancre(trouve), p.slice(debut + trouve.length)].filter((x) => x !== "");
    fusion.splice(i, 1, ...neuf);
    ancrees++;
    i--; // on réexamine depuis le premier morceau produit
  }
  if (!ancrees) return texte;
  return { _hdfr: fusion };
}

module.exports = { ancre, ancrerTexte, estAncre, resoudre, resoudrePlat, purger, compter, bundleDuJeu, SEPARATEUR, MIN_PHRASE };
