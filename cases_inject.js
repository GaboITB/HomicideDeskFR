// Réinjecte les traductions FR réécrites (cases/case-XXX.fr.json) dans le texte du bundle.
// Exporte : injectCases(bundleText, log) -> nouveau texte. Vérifie d'abord que chaque JSON réécrit a
// exactement la même structure (clés, tableaux) que l'original extrait (case-XXX.fr.orig.json).
"use strict";
const fs = require("fs");
const path = require("path");

const CASES_DIR = path.join(__dirname, "cases");

function shape(o, p, acc) {
  if (Array.isArray(o)) { acc.push(p + "[]:" + o.length); o.forEach((v, i) => shape(v, p + "[" + i + "]", acc)); }
  else if (o && typeof o === "object") { acc.push(p + "{}"); for (const k of Object.keys(o)) shape(o[k], p + "." + k, acc); }
  else acc.push(p + ":" + typeof o);
  return acc;
}
// La surcouche du studio désigne les éléments d'un tableau par leur identifiant
// (« email-E4 », « va:E6 ») là où la VO les liste par rang. On produit les deux écritures,
// sinon une clé légitimement rétablie depuis la VO passe pour une clé inventée.
function shapeAlias(o, p, acc) {
  if (Array.isArray(o)) {
    acc.push(p + "[]:" + o.length);
    o.forEach((v, i) => {
      shapeAlias(v, p + "[" + i + "]", acc);
      const id = v && typeof v === "object" && !Array.isArray(v) ? v.id : null;
      if (typeof id === "string" && id) {
        shapeAlias(v, p + "." + id, acc);
        shapeAlias(v, p + ".va:" + id, acc);
      }
    });
  } else if (o && typeof o === "object") {
    acc.push(p + "{}");
    for (const k of Object.keys(o)) shapeAlias(o[k], p + "." + k, acc);
  } else acc.push(p + ":" + typeof o);
  return acc;
}
function placeholders(o, acc = new Set()) {
  if (typeof o === "string") { for (const m of o.matchAll(/\{[a-zA-Z_]+\}/g)) acc.add(m[0]); }
  else if (o && typeof o === "object") Object.values(o).forEach(v => placeholders(v, acc));
  return acc;
}

function objectBounds(s, anchorIndex) {
  let pos = anchorIndex, depth = 0;
  while (pos > 0) { const c = s[pos]; if (c === "}") depth++; else if (c === "{") { if (depth === 0) break; depth--; } pos--; }
  let p2 = anchorIndex; depth = 0;
  while (p2 < s.length) { const c = s[p2]; if (c === "{") depth++; else if (c === "}") { if (depth === 0) break; depth--; } p2++; }
  return [pos, p2 + 1];
}

// Nom de la variable qui porte l'objet français d'une affaire, lu dans la carte des traductions
// `{"case-000":{ar:X,zh:Y,fr:Z,...}}`. Les noms minifiés changent à chaque build Steam : celui
// noté dans meta.json n'est qu'un repli.
function frVarName(s, id, repli) {
  const m = s.match(new RegExp('"' + id + '":\\{[^}]*?\\bfr:([A-Za-z_$][\\w$]*)'));
  return m ? m[1] : repli;
}

// Chaque affaire est traitée à part : un écart sur l'une (le studio l'a restructurée, retitrée,
// ou vient de la traduire lui-même) la laisse telle que le studio la livre, avec un avertissement,
// sans priver le joueur des autres. Aucune écriture n'a lieu avant que tous les contrôles de
// l'affaire soient passés.
function injectCases(s, log = console.log) {
  if (!fs.existsSync(CASES_DIR)) return s;
  const metas = fs.readdirSync(CASES_DIR).filter(f => f.endsWith(".meta.json")).sort();
  let count = 0;
  const ignorees = [];
  for (const mf of metas) {
    const meta = JSON.parse(fs.readFileSync(path.join(CASES_DIR, mf), "utf8"));
    try {
      s = injectOne(s, meta, log, () => count++);
    } catch (err) {
      ignorees.push(meta.id);
      log("ATTENTION : affaire " + meta.id + " laissée telle que le studio la livre : " + err.message);
    }
  }
  if (!count) log("aucune affaire réécrite à injecter");
  if (ignorees.length)
    log("ATTENTION : " + ignorees.length + " affaire(s) non traduite(s) par le patch (" + ignorees.join(", ") +
      "). Le reste du jeu est patché. Signalez-le avec la version du jeu.");
  return s;
}

function injectOne(s, meta, log, compter) {
  const workPath = path.join(CASES_DIR, meta.id + ".fr.json");
  const origPath = path.join(CASES_DIR, meta.id + ".fr.orig.json");
  // Affaire livrée par le studio sans traduction dans aucune langue : il n'y a pas d'objet
  // français à remplacer, il faut en déclarer un et l'inscrire dans la carte des traductions.
  // Le jeu fusionne clé par clé, une chaîne absente reste donc simplement en anglais.
  if (meta.neuve) {
    if (!fs.existsSync(workPath)) throw new Error(path.basename(workPath) + " absent (préparation des affaires incomplète)");
    const work = JSON.parse(fs.readFileSync(workPath, "utf8"));
    const nom = "hdfrFr" + meta.id.replace(/[^0-9]/g, "");
    if (s.includes(nom + "=")) { log("affaire " + meta.id + " : déjà injectée"); return s; }
    const carte = s.match(/(?<![\w$])(\w+)=\{"case-000":\{ar:/);
    if (!carte) throw new Error("carte des traductions introuvable dans le bundle");
    const debutCarte = carte.index;
    const finCarte = s.indexOf("}", s.indexOf('"case-004":{', debutCarte));
    if (finCarte < 0) throw new Error("fin de la carte des traductions introuvable");
    // Le studio a pu traduire l'affaire depuis : deux entrées dans la carte, la sienne gagnerait
    // en silence. On le dit plutôt que d'injecter pour rien.
    const finObjetCarte = s.indexOf("}}", finCarte);
    if (s.slice(debutCarte, finObjetCarte + 2).includes('"' + meta.id + '":{'))
      throw new Error("le studio fournit désormais ses propres traductions de cette affaire");
    // 1. déclaration de l'objet, juste avant la carte, dans la même liste de déclarations
    s = s.slice(0, debutCarte) + nom + "=" + JSON.stringify(work) + "," + s.slice(debutCarte);
    // 2. entrée dans la carte, après la dernière affaire traduite
    const fin2 = s.indexOf("}", s.indexOf('"case-004":{', debutCarte)) + 1;
    s = s.slice(0, fin2) + ',"' + meta.id + '":{fr:' + nom + "}" + s.slice(fin2);
    compter();
    log("affaire " + meta.id + " : traduction FR créée et inscrite dans la carte (" +
      shape(work, "", []).filter(x => x.endsWith(":string")).length + " chaînes)");
    return s;
  }
  if (!fs.existsSync(workPath) || !fs.existsSync(origPath))
    throw new Error(path.basename(!fs.existsSync(workPath) ? workPath : origPath) + " absent (préparation des affaires incomplète)");
  const work = JSON.parse(fs.readFileSync(workPath, "utf8"));
  const orig = JSON.parse(fs.readFileSync(origPath, "utf8"));
  if (JSON.stringify(work) === JSON.stringify(orig)) return s; // pas réécrit

  // L'objet français tel qu'il est RÉELLEMENT dans ce jeu, qui peut être plus récent que
  // l'extraction : c'est contre lui que la structure se vérifie.
  const varName = frVarName(s, meta.id, meta.varName);
  if (!varName) throw new Error("entrée française introuvable dans la carte des traductions");
  const decl = new RegExp("(?<![\\w$])" + varName.replace(/\$/g, "\\$") + '=\\{title:"');
  const dm = s.match(decl);
  if (!dm) throw new Error("déclaration " + varName + " introuvable dans le bundle");
  const [fa, fb] = objectBounds(s, dm.index + varName.length + 2);
  const current = new Function("return (" + s.slice(fa, fb) + ")")();
  if (current.title !== meta.frTitle) throw new Error("l'objet trouvé n'a pas le titre attendu (« " + current.title + " »)");

  // Le contrôle exige une structure identique à la VF du studio. Seule exception admise : une clé
  // que le studio a OUBLIÉE alors que la VO la porte (un identifiant d'indice, par exemple, que la
  // fusion du jeu écrase et perd dans les dix langues traduites). On la rétablit sciemment.
  const voP = path.join(CASES_DIR, meta.id + ".en.json");
  const voObj = fs.existsSync(voP) ? JSON.parse(fs.readFileSync(voP, "utf8")) : null;
  const cheminsVO = new Set(voObj ? shapeAlias(voObj, "", []) : []);
  const la = shape(current, "", []), lb = shape(work, "", []);
  const ensA = new Set(la), ensB = new Set(lb);
  const enTrop = lb.filter(x => !ensA.has(x));
  const enMoins = la.filter(x => !ensB.has(x));
  const enTropNonVO = enTrop.filter(x => !cheminsVO.has(x));
  if (enMoins.length || enTropNonVO.length)
    throw new Error("le studio a modifié la structure de cette affaire" +
      (enMoins.length ? " | manquant chez nous : " + enMoins.slice(0, 3).join(", ") : "") +
      (enTropNonVO.length ? " | en trop chez nous : " + enTropNonVO.slice(0, 3).join(", ") : ""));
  if (enTrop.length)
    log("affaire " + meta.id + " : " + enTrop.length +
      " clé(s) rétablie(s), oubliée(s) par le studio mais présente(s) dans la VO");
  const pa = [...placeholders(current)].sort().join(","), pb = [...placeholders(work)].sort().join(",");
  if (pa !== pb) throw new Error("les variables {…} diffèrent (" + pa + " contre " + pb + ")");
  if (JSON.stringify(current) !== JSON.stringify(orig))
    log("ATTENTION : affaire " + meta.id + " : le studio a modifié son texte depuis l'extraction de référence, " +
      "la structure est la même donc la traduction est injectée, mais un fait a pu changer");

  s = s.slice(0, fa) + JSON.stringify(work) + s.slice(fb);
  compter();
  log("affaire " + meta.id + " : traduction FR réécrite injectée (" + shape(work, "", []).filter(x => x.endsWith(":string")).length + " chaînes)");
  return s;
}

module.exports = { injectCases };

if (require.main === module) {
  // auto-test : vérifie la structure de chaque .fr.json sans toucher au bundle
  for (const mf of fs.readdirSync(CASES_DIR).filter(f => f.endsWith(".meta.json"))) {
    const id = JSON.parse(fs.readFileSync(path.join(CASES_DIR, mf), "utf8")).id;
    const w = path.join(CASES_DIR, id + ".fr.json"), o = path.join(CASES_DIR, id + ".fr.orig.json");
    if (!fs.existsSync(w)) continue;
    const work = JSON.parse(fs.readFileSync(w, "utf8")), orig = JSON.parse(fs.readFileSync(o, "utf8"));
    const same = JSON.stringify(work) === JSON.stringify(orig);
    const ok = shape(orig, "", []).join("\n") === shape(work, "", []).join("\n");
    console.log(id, same ? "non réécrit" : (ok ? "réécrit, structure OK" : "réécrit, STRUCTURE DIFFÉRENTE"));
  }
}
