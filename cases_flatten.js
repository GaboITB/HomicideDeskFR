// Convertit une réécriture complète cases/<id>.fr.json en cases/<id>.fr.flat.json (seulement les
// chaînes qui diffèrent de la VF d'origine). Usage : node cases_flatten.js case-000
"use strict";
const fs = require("fs");
const path = require("path");
const id = process.argv[2];
if (!id) { console.error("usage : node cases_flatten.js case-000"); process.exit(1); }
const DIR = path.join(__dirname, "cases");
const work = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.json"), "utf8"));
const orig = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.orig.json"), "utf8"));
function flatten(o, p, acc) {
  if (typeof o === "string") acc[p] = o;
  else if (Array.isArray(o)) o.forEach((v, i) => flatten(v, p + "/" + i, acc));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) flatten(o[k], p ? p + "/" + k : k, acc);
  return acc;
}
const fw = flatten(work, "", {}), fo = flatten(orig, "", {});
const flat = {};
for (const k of Object.keys(fo)) {
  if (!(k in fw)) { console.error("chemin absent de la réécriture : " + k); process.exit(1); }
  if (fw[k] !== fo[k]) flat[k] = fw[k];
}
fs.writeFileSync(path.join(DIR, id + ".fr.flat.json"), JSON.stringify(flat, null, 1));
console.log(id + ".fr.flat.json :", Object.keys(flat).length, "chaînes modifiées sur", Object.keys(fo).length);
