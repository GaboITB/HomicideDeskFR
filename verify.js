// Vérifie le contenu d'un app.asar (original ou patché) : marqueur, dictionnaire FR, consigne.
"use strict";
const path = require("path");
const asar = require("@electron/asar");
const GAME = process.env.HD_GAME_DIR || "D:/SteamLibrary/steamapps/common/Homicide Desk";
const A = process.argv[2] || path.join(GAME, "resources", "app.asar");

function file(p) { return asar.extractFile(A, path.join(...p.split("/"))); }
const marker = file("desktop/dist/localAI.js").toString("utf8").startsWith("/*HomicideDeskFR-patch-v1*/");
console.log("archive :", A);
console.log("marqueur patch :", marker);
const html = file("dist/index.html").toString();
const name = html.match(/assets\/(index-[^"]+\.js)/)[1];
const s = file("dist/assets/" + name).toString("utf8");
function grab(anchor) {
  const i = s.indexOf(anchor); let pos = i, d = 0;
  while (pos > 0) { const c = s[pos]; if (c === "}") d++; else if (c === "{") { if (d === 0) break; d--; } pos--; }
  let p2 = i; d = 0;
  while (p2 < s.length) { const c = s[p2]; if (c === "{") d++; else if (c === "}") { if (d === 0) break; d--; } p2++; }
  return new Function("return (" + s.slice(pos, p2 + 1) + ")")();
}
const fr = grab('"settings.title":"Paramètres"'), en = grab('"settings.title":"Settings"');
const missing = Object.keys(en).filter(k => !(k in fr));
console.log("clés EN :", Object.keys(en).length, "| clés FR :", Object.keys(fr).length, "| EN sans FR :", missing.length);
console.log("charsel.title =", fr["charsel.title"], "| intro.warrant.title =", fr["intro.warrant.title"]);
const m = s.match(/fr:"CONSIGNE DE LANGUE[^"]*"/);
console.log("consigne renforcée :", /Vouvoie l.inspecteur/.test(m && m[0]));
