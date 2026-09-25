// Audit de non-régression des réécritures : nombres, heures, codes, noms propres, marqueurs [[...]],
// phrases cliquables des articles, calques restants dans tout le bundle FR.
"use strict";
const fs = require("fs");
const path = require("path");
const asar = require("@electron/asar");
const DIR = path.join(__dirname, "cases");
const GAME = process.env.HD_GAME_DIR || "D:/SteamLibrary/steamapps/common/Homicide Desk";
const A = path.join(GAME, "resources", "app.asar");

function flatten(o, p, acc) {
  if (typeof o === "string") acc[p] = o;
  else if (Array.isArray(o)) o.forEach((v, i) => flatten(v, p + "/" + i, acc));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) flatten(o[k], p ? p + "/" + k : k, acc);
  return acc;
}
// « 20h58 » et « 20:58 » désignent la même heure : la VF écrit 00h00 en prose et 00:00 dans les
// documents. On normalise avant de comparer, sinon chaque choix typographique ressort en écart.
const nums = s => (s.match(/\d+(?:[.,:h]\d+)*/g) || []).map(x => x.replace(/(\d)h(\d)/g, "$1:$2")).sort();
const markers = s => (s.match(/\[\[[^\]]+\]\]/g) || []).sort();
const propers = s => [...new Set((s.match(/\b[A-ZÀ-Ý][a-zà-ÿ]{2,}(?:\s[A-ZÀ-Ý][a-zà-ÿ]{2,})?/g) || []))].sort();
const STOP = new Set(["Aucune", "Aucun", "Cette", "Celui", "Celle", "Chaque", "Dans", "Deux", "Elle", "Ils", "Les", "Une", "Vous", "Votre", "Voici", "Voilà", "Rien", "Pas", "Tout", "Toute", "Tous", "Quelqu", "Quoi", "Racontez", "Madame", "Monsieur", "Mademoiselle", "Inspecteur", "Trois", "Quatre", "Cinq", "Six", "Sept", "Huit", "Neuf", "Dix", "Onze", "Quatorze", "Seize", "Vingt", "Cent", "Mais", "Sauf", "Puis", "Ensuite", "Personne", "Quand", "Sans", "Sous", "Selon", "Depuis", "Avant", "Après", "Pour", "Par", "Sur", "Plusieurs", "Même", "Quelque", "Quelques", "Lancez", "Lisez", "Faites", "Ouvrez", "Envoyez", "Soumettez", "Regardez", "Examinez", "Comparez", "Marquez", "Cliquez", "Zoomez", "Utilisez", "Essayez", "Posez", "Dites", "Demandez", "Expliquez", "Suivez", "Renseignez", "Prenez", "Apportez", "Gardez", "Guettez", "Recoupez", "Transmettez", "Sachez", "Notez", "Merci", "Bon", "Oui", "Non", "Ouais", "Juste", "Alors", "Pardon", "Désolé", "Désolée", "Vendredi", "Samedi", "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Janvier", "Février", "Mars", "Septembre", "Octobre", "Novembre", "Décembre", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Nuit", "Journal", "Registre", "Ligne", "Note", "Source", "Sujet", "Objet", "Date", "Lieu", "Heure", "Statut", "Résumé", "Constat", "Conclusion", "Recommandation", "Contenu", "Cause", "Plan", "Image", "Capture", "Pièce", "Preuve", "Photographie", "Scan", "Cassette", "Carte", "Serrure", "Barillet", "Entrée", "Sortie", "Portefeuille", "Signé", "Signature", "Ticket", "Achat", "Espèces", "Déclaration", "Permis", "Code", "Mission", "Dossier", "Affaire", "Rapport", "Division", "Police", "Brigade", "Unité", "Imagerie", "Section", "Service", "Bureau", "Conseil", "Cabinet", "Institut", "Équipe", "Patrouille", "Labo", "Archives", "Retours", "Exploitation", "Direction", "Ligne", "Semaine", "Page", "Feuille", "Livre", "Cahier", "Mot", "Fin", "Version", "Dernière", "Première", "Seconde", "Deuxième", "Second", "Nouveau", "Nouvelle", "Grand", "Petit", "Vieux", "Bien", "Mal", "Très", "Plus", "Moins", "Encore", "Toujours", "Jamais", "Ici", "Là", "Vers", "Entre", "Chez", "Nous", "Notre", "Nos", "Vos", "Leur", "Leurs", "Son", "Ses", "Mon", "Mes", "Ton", "Tes", "Que", "Qui", "Quel", "Quelle", "Comment", "Pourquoi", "Où", "Combien", "Elles", "Eux", "Lui", "Moi", "Toi", "Soi", "Ça", "Cela", "Ceci", "Celles", "Ceux", "Autre", "Autres", "Même", "Tel", "Telle", "Certains", "Certaines", "Aujourd", "Hier", "Demain", "Matin", "Soir", "Midi", "Minuit"]);

// Écarts de nombres voulus, tous décrits dans DEVELOPER_NOTES.md (sections 2 et 3) : durée réelle du
// message vocal, heures de l'affaire 002 mises en cohérence, 8 100 $, dates de naissance, et des
// différences purement typographiques (2 400, « quatrième », « trois mois », 2019-2020).
const DECLARED = new Set([
  "case-000|evidence/va:E0/description",
  "case-001|evidence/va:E2/description", "case-001|evidence/va:E3/audioTranscript",
  "case-001|evidence/va:E4/spreadsheetRows/10/4", "case-001|evidence/va:E5/description",
  "case-001|evidence/va:E5/presentationMessage", "case-001|evidence/va:E7/clue/label",
  "case-001|evidence/va:E9/forensicsReport",
  "case-002|description", "case-002|captainBriefing", "case-002|evidence/va:E1/description",
  "case-002|evidence/va:E1/presentationMessage", "case-002|evidence/va:E1/fileContent",
  "case-002|evidence/va:E5/description", "case-002|evidence/va:E5/clue/detail",
  "case-003|files/file-E13/name", "case-003|evidence/va:E13/name", "case-003|evidence/va:E1/fileContent",
  "case-003|emails/email-room5-note/body",
  "case-004|evidence/va:E3/handwritingCompare/knownName", "case-004|evidence/va:E17/presentationMessage",
]);
let issues = 0, declared = 0;
for (const mf of fs.readdirSync(DIR).filter(f => f.endsWith(".meta.json"))) {
  const id = JSON.parse(fs.readFileSync(path.join(DIR, mf), "utf8")).id;
  const origPath = path.join(DIR, id + ".fr.orig.json");
  // 005 et 006 sont livrées sans français : rien à comparer.
  if (!fs.existsSync(origPath)) { console.log("=== " + id + " : pas de français d'origine, ignorée"); continue; }
  const orig = flatten(JSON.parse(fs.readFileSync(origPath, "utf8")), "", {});
  const work = flatten(JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.json"), "utf8")), "", {});
  console.log("=== " + id);
  for (const p of Object.keys(orig)) {
    const a = orig[p], b = work[p];
    if (a === b) continue;
    const na = nums(a).join(" "), nb = nums(b).join(" ");
    if (na !== nb) { const d = DECLARED.has(id + "|" + p); if (d) declared++; else issues++; console.log("  NOMBRES " + (d ? "(déclaré) " : "") + p + "\n     orig: " + na + "\n     new : " + nb); }
    const ma = markers(a).join(" "), mb = markers(b).join(" ");
    if (ma !== mb) { issues++; console.log("  MARQUEURS " + p + "\n     orig: " + ma + "\n     new : " + mb); }
    const pa = propers(a).filter(x => !STOP.has(x.split(" ")[0])), pb = propers(b).filter(x => !STOP.has(x.split(" ")[0]));
    const lost = pa.filter(x => !pb.includes(x) && !b.includes(x));
    if (lost.length) console.log("  noms absents dans la réécriture (" + p + ") : " + lost.join(", "));
  }
  // phrases cliquables des articles : doivent apparaître telles quelles dans un body du même article
  const w = JSON.parse(fs.readFileSync(path.join(DIR, id + ".fr.json"), "utf8"));
  for (const [i, art] of (w.pressArchive && w.pressArchive.articles || []).entries()) {
    if (art.hotspot && art.hotspot.phrase) {
      const ok = (art.body || []).some(b => b.includes(art.hotspot.phrase));
      console.log("  article " + i + " phrase cliquable : " + (ok ? "OK" : "INTROUVABLE DANS LE CORPS -> lien cassé"));
      if (!ok) issues++;
    }
  }
  // uvText / uvClue conservés
  for (const p of Object.keys(orig)) if (/uvText|uvClue|lockHint|lockedHint|inspectHint/.test(p) && orig[p] !== work[p]) console.log("  modifié (à relire) : " + p);
}

// calques restants dans tout le bundle installé (dictionnaire FR + affaires)
const html = asar.extractFile(A, path.join("dist", "index.html")).toString();
const name = html.match(/assets\/(index-[^"]+\.js)/)[1];
const s = asar.extractFile(A, path.join("dist", "assets", name)).toString("utf8");
console.log("=== calques restants dans le bundle installé");
for (const pat of ["fenêtre du meurtre", "personne d'intérêt", "personnes d'intérêt", "Méridie", "Affaires internes", "Cpt ", "préfet", "Le log", "hors livres", "trace de pesée", "dérangé"]) {
  const n = (s.match(new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  if (n) { const i = s.indexOf(pat); console.log("  « " + pat + " » x" + n + " : …" + s.slice(Math.max(0, i - 80), i + 60).replace(/\n/g, " ") + "…"); }
}
// autres cartes de langue inline (fr:"...") hors dictionnaire et affaires : à recenser
const inline = [...s.matchAll(/\bfr:"((?:[^"\\]|\\.){3,120})"/g)].map(m => m[1]);
console.log("=== chaînes fr:\"…\" inline dans le bundle : " + inline.length);
for (const t of inline.slice(0, 40)) console.log("  - " + t);
console.log("=== écarts déclarés (DEVELOPER_NOTES.md) : " + declared + " | problèmes bloquants : " + issues);
process.exit(issues ? 1 : 0);
