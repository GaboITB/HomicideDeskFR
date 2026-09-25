// Extrait, depuis le bundle du jeu, les objets « affaire » en VO (EN) et leur traduction FR,
// vers cases/case-XXX.en.json et cases/case-XXX.fr.orig.json (référence, jamais modifiée à la main).
// La réécriture se fait dans cases/case-XXX.fr.json (copie de .fr.orig.json au départ).
// Usage : node cases_extract.js [chemin app.asar]   (défaut : app.asar.orig du jeu, sinon app.asar)
"use strict";
const fs = require("fs");
const path = require("path");
const asar = require("@electron/asar");

const GAME = process.env.HD_GAME_DIR || "D:\\SteamLibrary\\steamapps\\common\\Homicide Desk";
const RES = path.join(GAME, "resources");
let A = process.argv[2] || (fs.existsSync(path.join(RES, "app.asar.orig")) ? path.join(RES, "app.asar.orig") : path.join(RES, "app.asar"));
const OUT = path.join(__dirname, "cases");
fs.mkdirSync(OUT, { recursive: true });

const html = asar.extractFile(A, path.join("dist", "index.html")).toString();
const bundle = html.match(/assets\/(index-[^"]+\.js)/)[1];
const s = asar.extractFile(A, path.join("dist", "assets", bundle)).toString("utf8");

function objectBounds(anchorIndex) {
  let pos = anchorIndex, depth = 0;
  while (pos > 0) { const c = s[pos]; if (c === "}") depth++; else if (c === "{") { if (depth === 0) break; depth--; } pos--; }
  let p2 = anchorIndex; depth = 0;
  while (p2 < s.length) { const c = s[p2]; if (c === "{") depth++; else if (c === "}") { if (depth === 0) break; depth--; } p2++; }
  return [pos, p2 + 1];
}
function evalLiteral(txt) { return new Function("return (" + txt + ")")(); }

// Affaires EN : objets `{id:"case-00X",caseNumber:X,title:...`
const cases = [];
for (const m of s.matchAll(/\{id:"(case-\d{3})",caseNumber:\d+,title:"/g)) {
  const [a, b] = objectBounds(m.index + 1);
  const en = evalLiteral(s.slice(a, b));
  cases.push({ id: m[1], en, enTitle: en.title });
}
console.log("affaires EN trouvées :", cases.map(c => c.id + " (" + c.enTitle + ")").join(", "));

// La VO de CHAQUE affaire, y compris celles que le studio n'a traduites dans aucune langue (005 et
// 006) : cases_build_neuve.js en a besoin pour reboucher les cellules non traduites. Sans elle,
// une installation depuis le paquet publié laissait ces affaires en anglais.
for (const c of cases) fs.writeFileSync(path.join(OUT, c.id + ".en.json"), JSON.stringify(c.en, null, 1));

// Traductions : une carte `{"case-000":{ar:HE,zh:_E,fr:VE,...},"case-001":{...}}` associe chaque
// affaire à une variable par langue. L'objet FR est la constante `VE={title:"...",tagline:...}`.
for (const c of cases) {
  const map = s.match(new RegExp('"' + c.id + '":\\{[^}]*?\\bfr:([A-Za-z_$][\\w$]*)'));
  if (!map) { console.log(c.id, ": pas d'entrée fr dans la carte des traductions"); continue; }
  const varName = map[1];
  const decl = new RegExp("(?<![\\w$])" + varName.replace(/\$/g, "\\$") + '=\\{title:"');
  const dm = s.match(decl);
  if (!dm) { console.log(c.id, ": déclaration " + varName + " introuvable"); continue; }
  const [fa, fb] = objectBounds(dm.index + varName.length + 2);
  const frText = s.slice(fa, fb);
  const fr = evalLiteral(frText);
  const meta = { id: c.id, varName, enTitle: c.enTitle, frTitle: fr.title, length: frText.length };
  fs.writeFileSync(path.join(OUT, c.id + ".fr.orig.json"), JSON.stringify(fr, null, 1));
  fs.writeFileSync(path.join(OUT, c.id + ".meta.json"), JSON.stringify(meta, null, 1));
  const work = path.join(OUT, c.id + ".fr.json");
  if (!fs.existsSync(work)) fs.copyFileSync(path.join(OUT, c.id + ".fr.orig.json"), work);
  console.log(c.id, ": FR «", fr.title, "»,", frText.length, "caractères ->", path.basename(work));
}
