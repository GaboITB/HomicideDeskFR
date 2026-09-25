// Reconstruit cases/case-XXX.fr.json à partir de la VF d'origine (.fr.orig.json) en remplaçant chaque
// chaîne par la réécriture fournie dans .fr.flat.json ({ "<chemin>": "<texte>" }). Toute chaîne absente
// du flat garde la VF d'origine et est signalée. Usage : node cases_build.js case-001
"use strict";
const fs = require("fs");
const path = require("path");
const id = process.argv[2];
if (!id) { console.error("usage : node cases_build.js case-001"); process.exit(1); }
const DIR = path.join(__dirname, "cases");
const orig = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.orig.json"), "utf8"));
let flat = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.flat.json"), "utf8"));
// Paquet publié : les textes repris tels quels du studio y sont des ancres (voir ancres.js),
// résolues contre le jeu du joueur. Une ancre introuvable est retirée, la VF du studio reste.
{
  const ancres = require("./ancres.js");
  if (ancres.compter(flat)) {
    const r = ancres.resoudrePlat(flat, ancres.bundleDuJeu());
    flat = r.plat;
    if (r.retires.length) console.log(id, ": ATTENTION,", r.retires.length, "texte(s) introuvable(s) dans ce jeu, VF du studio gardée :", r.retires.slice(0, 5).join(", "));
  }
}
const used = new Set();
const missing = [];
function apply(o, p) {
  if (typeof o === "string") {
    if (p in flat) { used.add(p); return flat[p]; }
    missing.push(p); return o;
  }
  if (Array.isArray(o)) return o.map((v, i) => apply(v, p + "/" + i));
  if (o && typeof o === "object") { const r = {}; for (const k of Object.keys(o)) r[k] = apply(o[k], p ? p + "/" + k : k); return r; }
  return o;
}
const out = apply(orig, "");
// Un chemin du flat absent de la VF du studio mais PRESENT dans la VO est un manque du studio :
// la fusion du jeu ecrase alors la valeur d'origine (un identifiant d'indice, par exemple, qui
// disparait dans les dix langues traduites). On le retablit au lieu de le signaler comme inconnu.
const voPath = path.join(DIR, id + ".en.json");
const vo = fs.existsSync(voPath) ? JSON.parse(fs.readFileSync(voPath, "utf8")) : null;
const ajoutes = [];
if (vo) {
  for (const chemin of Object.keys(flat)) {
    if (used.has(chemin)) continue;
    const seg = chemin.split("/");
    let n = out;
    let ok = true;
    for (let i = 0; i < seg.length - 1; i++) {
      if (n === undefined || n === null) { ok = false; break; }
      n = Array.isArray(n) && /^\d+$/.test(seg[i]) ? n[Number(seg[i])] : n[seg[i]];
    }
    if (!ok || n === undefined || n === null || typeof n !== "object") continue;
    n[seg[seg.length - 1]] = flat[chemin];
    used.add(chemin);
    ajoutes.push(chemin);
  }
}
const unknown = Object.keys(flat).filter(k => !used.has(k));
fs.writeFileSync(path.join(DIR, id + ".fr.json"), JSON.stringify(out, null, 1));
console.log(id, ":", used.size, "chaînes réécrites,", missing.length, "gardées d'origine,", unknown.length, "chemins inconnus");
if (missing.length) console.log("  gardées :", missing.join(", "));
if (ajoutes.length) console.log("  rétablis (manquants chez le studio) :", ajoutes.join(", "));
if (unknown.length) console.log("  inconnus :", unknown.join(", "));
// contrôle largeur des fileContent (papier 3D)
let wide = [];
for (const [k, v] of Object.entries(flat)) if (/fileContent|body$/.test(k)) for (const l of v.split("\n")) if (l.length > 74) wide.push(k + " (" + l.length + ")");
if (wide.length) console.log("  lignes > 74 car. :", [...new Set(wide)].join(", "));
