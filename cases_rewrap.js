// Recale les lignes trop longues des documents réécrits (fileContent, forensicsReport, audioTranscript,
// pages, uvText) à 68 caractères : le rendu papier 3D coupe vers 70 caractères et laisse sinon des
// mots orphelins. Méthode conservatrice : une ligne trop longue est coupée au dernier espace, et le
// reste est reporté en tête de la ligne suivante si celle-ci est une continuation de prose, sinon
// sur une nouvelle ligne. Rien n'est fusionné, la structure (libellés, puces, tableaux) est intacte.
// Usage : node cases_rewrap.js [case-001 …]   (par défaut : toutes les affaires)
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "cases");
const MAX = 68;
const KEYS = /fileContent|forensicsReport|audioTranscript|pages\/\d+\/content|uvText/;

// Ligne « structurelle » = ne peut pas recevoir la fin de la ligne précédente : vide, puce, libellé
// (premier mot tout en majuscules, ou LIBELLÉ :), tableau, crochet ou parenthèse d'ouverture.
// Une heure (22:30) ou une ligne commençant par « restent des continuations de prose.
const isStructural = l => l === "" || /^[A-ZÀ-Ý][A-ZÀ-Ý0-9.'’-]+(\s|$)/.test(l) || /^- /.test(l) || l.includes("|") || (/^[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9 .()/&'’-]*\s?:(\s|$)/.test(l) && !/^\d{1,2}:\d{2}/.test(l)) || /^\d{1,2}:\d{2}(:\d{2})?\s{2,}/.test(l) || /^[\[(\u2014»"]/.test(l) || /\.{4,}/.test(l);
const isTableLine = l => l.includes("|") || /\.{4,}/.test(l);
const isIndented = l => /^\s{2,}\S/.test(l);

function breakLine(l) {
  // coupe au dernier espace avant MAX, sans laisser « en fin de ligne ni » ? ! : en début de suite
  let cut = -1;
  for (let i = Math.min(MAX, l.length - 1); i > 20; i--) {
    if (l[i] !== " ") continue;
    const head = l.slice(0, i).trimEnd(), tail = l.slice(i + 1);
    if (/[«(]$/.test(head) || /^[»?!:;)]/.test(tail)) continue;
    cut = i; break;
  }
  if (cut < 0) return null;
  return [l.slice(0, cut).trimEnd(), l.slice(cut + 1)];
}

function reflow(content) {
  const lines = content.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    if (isTableLine(l) || l.length <= MAX) { out.push(l); continue; }
    const indent = l.match(/^(- |\s*)/)[0];
    const parts = breakLine(l);
    if (!parts) { out.push(l); continue; }
    out.push(parts[0]);
    const next = lines[i + 1];
    if (next !== undefined && isIndented(next) && !isStructural(next)) {
      // transcription à colonne horodatée : la suite rejoint la ligne indentée suivante, même retrait
      const ni = next.match(/^\s*/)[0];
      lines[i + 1] = ni + parts[1] + " " + next.trimStart();
    } else if (next !== undefined && !isIndented(l) && !isStructural(next) && !isTableLine(next)) {
      lines[i + 1] = parts[1] + " " + next.trimStart();
    } else {
      const rest = (indent === "- " ? "  " : indent) + parts[1];
      lines.splice(i + 1, 0, rest);
    }
  }
  return out.join("\n");
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(DIR).filter(f => f.endsWith(".fr.flat.json")).map(f => f.replace(".fr.flat.json", ""));
for (const id of ids) {
  const p = path.join(DIR, id + ".fr.flat.json");
  const flat = JSON.parse(fs.readFileSync(p, "utf8"));
  let changed = 0, longest = 0;
  for (const [k, v] of Object.entries(flat)) {
    if (!KEYS.test(k) || typeof v !== "string") continue;
    const nv = reflow(v);
    if (nv !== v) { flat[k] = nv; changed++; }
    for (const l of nv.split("\n")) if (!isTableLine(l)) longest = Math.max(longest, l.length);
  }
  fs.writeFileSync(p, JSON.stringify(flat, null, 1));
  console.log(id + " : " + changed + " documents recalés, ligne de prose la plus longue : " + longest);
}
