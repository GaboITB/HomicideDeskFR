// Reconstruit cases/case-00X.fr.json (l'objet injecté dans le jeu) à partir de
// cases/case-00X.fr.flat.json, pour les affaires livrées par le studio sans traduction.
//
// Ces affaires n'ont pas de .fr.orig.json : le fichier plat EST la source, et l'objet n'en est que
// la mise en forme. À relancer après toute modification du plat.
//
// Usage : node cases_build_neuve.js case-005 case-006   (par défaut : toutes les affaires « neuves »)
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "cases");

function neuves() {
  return fs.readdirSync(DIR).filter(f => f.endsWith(".meta.json")).map(f => {
    try { return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")); } catch (e) { return null; }
  }).filter(m => m && m.neuve).map(m => m.id);
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : neuves();
if (!ids.length) { console.log("aucune affaire neuve"); process.exit(0); }

for (const id of ids) {
  const fp = path.join(DIR, id + ".fr.flat.json");
  if (!fs.existsSync(fp)) { console.error(id + " : " + path.basename(fp) + " introuvable"); process.exitCode = 1; continue; }
  let plat = JSON.parse(fs.readFileSync(fp, "utf8"));
  // Paquet publié : textes repris tels quels du jeu remplacés par des ancres (voir ancres.js).
  // Une ancre introuvable est retirée, la VO s'affiche alors à cet endroit.
  const ancres = require("./ancres.js");
  if (ancres.compter(plat)) {
    const r = ancres.resoudrePlat(plat, ancres.bundleDuJeu());
    plat = r.plat;
    if (r.retires.length) console.log(id + " : ATTENTION, " + r.retires.length + " texte(s) introuvable(s) dans ce jeu : " + r.retires.slice(0, 5).join(", "));
  }
  const obj = {};
  for (const [chemin, texte] of Object.entries(plat)) {
    const seg = chemin.split("/");
    let n = obj;
    for (let i = 0; i < seg.length - 1; i++) {
      const suivantEstIndice = /^\d+$/.test(seg[i + 1]);
      if (n[seg[i]] === undefined) n[seg[i]] = suivantEstIndice ? [] : {};
      n = n[seg[i]];
    }
    n[seg[seg.length - 1]] = texte;
  }
  // Une cellule de tableau qui n'a pas besoin d'être traduite (une heure, un numéro) n'est pas
  // dans le plat : elle laisserait un trou, que le jeu afficherait vide puisque la surcouche
  // REMPLACE le tableau d'origine. On rebouche depuis la VO, au même chemin.
  const vo = JSON.parse(fs.readFileSync(path.join(DIR, id + ".en.json"), "utf8"));
  let bouches = 0;
  // La surcouche indexe les pièces et les fichiers par identifiant (« va:E8 »), la VO les liste
  // dans un tableau : il faut retrouver l'élément par son id avant de comparer.
  function correspond(o, cle) {
    if (o === undefined || o === null) return undefined;
    if (Array.isArray(o)) {
      if (/^\d+$/.test(cle)) return o[Number(cle)];
      const id = String(cle).replace(/^va:/, "");
      const trouve = o.find((x) => x && typeof x === "object" && (x.id === id || x.id === cle));
      if (trouve) return trouve;
      // certains tableaux imbriquent leurs entrées (arborescence de fichiers)
      for (const x of o) {
        if (x && x.children) {
          const d = correspond(x.children, cle);
          if (d) return d;
        }
      }
      return undefined;
    }
    return o[cle];
  }
  (function reboucher(n, o) {
    if (Array.isArray(n)) {
      // une ligne de tableau dont les dernières cellules sont vides en VO est plus courte chez
      // nous : on la ramène à la longueur d'origine, sinon les colonnes se décalent à l'écran
      if (Array.isArray(o) && o.length > n.length) {
        for (let i = n.length; i < o.length; i++) {
          n[i] = o[i];
          bouches++;
        }
      }
      for (let i = 0; i < n.length; i++) {
        if (n[i] === undefined || n[i] === null) {
          const v = correspond(o, String(i));
          if (v !== undefined) {
            n[i] = v;
            bouches++;
          }
        } else reboucher(n[i], correspond(o, String(i)));
      }
    } else if (n && typeof n === "object") {
      for (const k of Object.keys(n)) reboucher(n[k], correspond(o, k));
    }
  })(obj, vo);

  fs.writeFileSync(path.join(DIR, id + ".fr.json"), JSON.stringify(obj, null, 1) + "\n");
  const mp = path.join(DIR, id + ".meta.json");
  if (fs.existsSync(mp)) {
    const m = JSON.parse(fs.readFileSync(mp, "utf8"));
    m.frTitle = obj.title || m.frTitle;
    m.length = JSON.stringify(obj).length;
    fs.writeFileSync(mp, JSON.stringify(m, null, 1) + "\n");
  }
  console.log(id + " : " + Object.keys(plat).length + " chaînes, " + bouches + " cellule(s) reprise(s) de la VO, " + Object.keys(obj).length +
    " sections, titre « " + (obj.title || "?") + " » -> " + id + ".fr.json");
}
