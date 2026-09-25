// Feuille de travail : pour chaque chaîne de la VF d'origine (case-XXX.fr.orig.json), retrouve la VO
// correspondante dans case-XXX.en.json et écrit cases/case-XXX.sheet.txt (chemin, VO, VF d'origine).
// La réécriture se fait dans cases/case-XXX.fr.flat.json : { "<chemin>": "<nouveau texte FR>" }.
// Usage : node cases_sheet.js case-001
"use strict";
const fs = require("fs");
const path = require("path");
const id = process.argv[2];
if (!id) { console.error("usage : node cases_sheet.js case-001"); process.exit(1); }
const DIR = path.join(__dirname, "cases");
const en = JSON.parse(fs.readFileSync(path.join(DIR, id + ".en.json"), "utf8"));
const fr = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.orig.json"), "utf8"));

function flatten(o, p, acc) {
  if (typeof o === "string") acc.push([p, o]);
  else if (Array.isArray(o)) o.forEach((v, i) => flatten(v, p + "/" + i, acc));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) flatten(o[k], p ? p + "/" + k : k, acc);
  return acc;
}
function findById(list, id) { return Array.isArray(list) ? list.find(x => x && x.id === id) : undefined; }
function findFile(nodes, id) {
  for (const n of nodes || []) { if (n.id === id) return n; const r = findFile(n.children, id); if (r) return r; }
}
function variants() { return [en, ...(en.variants || [])]; }
function stripV(k) { const m = k.match(/^v[a-z]:(.*)$/); return m ? m[1] : k; }
function get(o, keys) { for (const k of keys) { if (o == null) return undefined; o = o[k]; } return o; }

function resolve(p) {
  const seg = p.split("/");
  const head = seg[0];
  const rest = seg.slice(1);
  if (["title", "tagline", "description", "captainBriefing", "location", "victim", "date"].includes(head)) return get(en, seg);
  if (head === "suspects") { const s = findById(en.suspects, stripV(seg[1])); return get(s, rest.slice(1)); }
  if (head === "files") { const f = findFile(en.files, stripV(seg[1])); return get(f, rest.slice(1)); }
  if (head === "evidence") {
    for (const v of variants()) { const e = findById(v.evidence, stripV(seg[1])); if (e) { const r = get(e, rest.slice(1)); if (r !== undefined) return r; } }
    return undefined;
  }
  if (head === "questions") {
    for (const v of variants()) for (const sd of Object.values(v.suspectData || {})) { const q = findById(sd.questions, stripV(seg[1])); if (q) { const r = get(q, rest.slice(1)); if (r !== undefined) return r; } }
    return undefined;
  }
  if (head === "openingStatements") { for (const v of variants()) { const r = get(v, ["suspectData", stripV(seg[1]), "openingStatement"]); if (r !== undefined) return r; } return undefined; }
  if (head === "endings") { const k = seg[seg.length - 1]; for (const v of variants()) { const r = get(v, ["endings", k]); if (r !== undefined) return r; } return undefined; }
  if (head === "emails") { for (const v of variants()) { const e = findById(v.emails, stripV(seg[1])); if (e) { const r = get(e, rest.slice(1)); if (r !== undefined) return r; } } return undefined; }
  if (head === "script") { for (const v of variants()) { const e = findById(v.script, stripV(seg[1])); if (e) { const r = get(e, rest.slice(1).map(x => (/^\d+$/.test(x) ? Number(x) : x))); if (r !== undefined) return r; } } return undefined; }
  // générique : même chemin, en essayant sans préfixe de variante et en cherchant par id dans les tableaux
  let cur = en;
  for (const s of seg) {
    if (cur == null) return undefined;
    if (Array.isArray(cur) && !/^\d+$/.test(s)) { cur = findById(cur, stripV(s)); continue; }
    cur = cur[s] !== undefined ? cur[s] : cur[stripV(s)];
  }
  return typeof cur === "string" ? cur : undefined;
}

const rows = flatten(fr, "", []);
let unresolved = 0;
const out = [];
for (const [p, v] of rows) {
  let e = resolve(p);
  if (typeof e !== "string") { e = "(VO introuvable)"; unresolved++; }
  out.push("### " + p + "\nEN: " + e.replace(/\n/g, "\n    ") + "\nFR: " + v.replace(/\n/g, "\n    ") + "\n");
}
fs.writeFileSync(path.join(DIR, id + ".sheet.txt"), out.join("\n"));
console.log(id, ":", rows.length, "chaînes,", unresolved, "sans VO ->", id + ".sheet.txt");
