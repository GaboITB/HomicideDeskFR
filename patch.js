#!/usr/bin/env node
/**
 * HomicideDeskFR : patch local du jeu Steam « Homicide Desk » (Electron + Ollama embarqué).
 *
 * Ce que fait le patch :
 *  1. Ajoute au dictionnaire français les 74 chaînes absentes (traduites depuis la VO,
 *     fichier fr_additions.json) : écran de choix du détective, fiches « premier accès ».
 *  2. Renforce la consigne de langue donnée aux suspects (accord au genre, pas d'anglicismes,
 *     vouvoiement).
 *  3. Rend le modèle de langue pilotable par un fichier de configuration FACULTATIF
 *     %APPDATA%\detective-os\localai-override.json  ({"model": "...", "igpu": true|false}).
 *     Sans ce fichier, le jeu garde sa propre détection (Qwen 4B, ou Gemma 12B au-delà de 10 Go
 *     de VRAM NVIDIA). Le patch ne le crée jamais : c'est un choix du joueur.
 *
 * Usage :
 *   node patch.js            applique le patch (sauvegarde l'original en app.asar.orig)
 *   node patch.js --restore  remet l'app.asar d'origine
 *   node patch.js --retirer  idem, puis efface la sauvegarde app.asar.orig devenue inutile
 *   node patch.js --check    vérifie l'état (patché ou non) sans rien modifier
 *
 * À relancer après chaque mise à jour Steam du jeu (Steam remplace app.asar).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const GAME = process.env.HD_GAME_DIR || "D:\\SteamLibrary\\steamapps\\common\\Homicide Desk";
const RES = path.join(GAME, "resources");
const ASAR = path.join(RES, "app.asar");
const ASAR_ORIG = path.join(RES, "app.asar.orig");
const HERE = __dirname;
const WORK = path.join(HERE, ".work");
const EXTRACT = path.join(WORK, "app");
const OUT = path.join(WORK, "app.asar.patched");
const MARKER = "/*HomicideDeskFR-patch-v1*/";
const UNPACK_DIRS = "{node_modules/@img/sharp-win32-x64,node_modules/onnxruntime-node,node_modules/steamworks.js}";
const OVERRIDE_PATH = path.join(process.env.APPDATA || "", "detective-os", "localai-override.json");

function log(msg) { console.log("[HomicideDeskFR] " + msg); }
function die(msg) { console.error("[HomicideDeskFR] ERREUR : " + msg); process.exit(1); }
// @electron/asar 4 est un module ES chargé par require(), ce que Node ne sait faire qu'à partir de
// la 22.12. Plus ancien, l'erreur serait un ERR_REQUIRE_ESM incompréhensible pour un joueur.
{
  const [maj, min] = process.versions.node.split(".").map(Number);
  if (maj < 22 || (maj === 22 && min < 12))
    die("Node.js " + process.versions.node + " est trop ancien : installez Node.js 22.12 ou plus récent (https://nodejs.org).");
}
if (!fs.existsSync(path.join(HERE, "node_modules", "@electron", "asar")))
  die("dépendance absente : lancez d'abord « npm install » dans ce dossier.");
const asarLib = require("@electron/asar");
const { resoudre, estAncre, purger } = require("./ancres.js");

// Fichiers de données. Dans le paquet publié, les textes du studio qui servent de repères (une
// personnalité anglaise, une ligne de règles, un libellé) sont remplacés par des ancres, résolues
// ici contre le bundle d'ORIGINE du joueur, avant toute modification (voir ancres.js).
let BUNDLE0 = null;
// Arrêt anticipé de la génération en français (25/09/2026) : { a2, fd } si ge() du jeu est
// exactement celle contre laquelle le critère d'arret_fr.js a été validé, sinon null (désactivé).
let HDFR_GE = null;
// Vrai si le filtre [[SI]] du rendu est posé : patchInlineFrench garde alors les marqueurs des
// personnalités, sinon il les retire (un marqueur ne doit jamais atteindre le modèle).
let HDFR_SI_FILTRE = false;
const GE_VALIDEE = "154918ef5d87943b9086928b1be670acd467fcb5cdb303e16dba8a52399814b9";
// Architecture « prompt stable » du français (25/09/2026, scratch/vo/ARCHITECTURE_LATENCE.md) :
// fiche invariable pendant la partie, dévoilements [[SI]] dans le dernier message, pièces montrées
// gardées dans le prompt système (V2), historique complet, filet par blocs. false = comportement du 24/09 (pièces et [[SI]]
// dans le prompt système, coupe du studio à 10 messages).
const CACHE_FR = true;
// Ruptures du cache du moteur (26/09/2026, simulation du cache sur les requêtes du banc). Risque sur la
// qualité : désactivées tant que les juges à l'aveugle n'ont pas tranché. Désactivées, le bundle
// est identique à celui sans ces options. HDFR_PIECE_HIST=1 ou HDFR_HUMEUR_NOTES=1 les active
// pour une mesure ou un test, sans toucher au fichier.
// PIECE_HIST_FR : au tour d'une pièce, le jeu envoie « pose une pièce + présentation + question »
// mais range « Présente une pièce + question » dans l'historique. Le tour suivant ne retrouvait
// donc pas ce qu'il avait lu et relisait tout à partir de là. Activé, l'envoi garde la forme de
// l'historique et ajoute la présentation seule en dernier message. Gain simulé faible (40 jetons
// au tour suivant, 22 de plus au tour de la pièce) : l'essentiel de la relecture après une pièce
// vient des dévoilements [[SI]], renvoyés dans le dernier message à chaque tour.
const PIECE_HIST_FR = process.env.HDFR_PIECE_HIST === "1";
// HUMEUR_NOTES_FR : l'humeur du suspect (seuils de stress 40 et 70) est au milieu du prompt
// système. Chaque changement fait relire la fin du prompt et tout l'historique. Activé, elle
// quitte le prompt système et rejoint les notes du dernier message, que le jeu ne garde pas.
// Contrepartie simulée : les notes n'étant plus jamais vides, chaque tour relit aussi l'échange
// précédent (70 à 180 jetons), contre 800 à 1000 épargnés à chaque changement d'humeur.
const HUMEUR_NOTES_FR = process.env.HDFR_HUMEUR_NOTES === "1";
function lire(nom) {
  const d = JSON.parse(fs.readFileSync(path.join(HERE, nom), "utf8"));
  if (BUNDLE0 === null) die("lecture de " + nom + " avant celle du bundle");
  const r = resoudre(d, BUNDLE0);
  const n = purger(r);
  if (n) log("ATTENTION : " + nom + " : " + n + " texte(s) introuvable(s) dans cette version du jeu, laissé(s) tel(s) que le studio les livre");
  return r;
}
async function asarExtract(src, dest) { await asarLib.extractAll(src, dest); }
async function asarPack(src, dest) { await asarLib.createPackageWithOptions(src, dest, { unpackDir: UNPACK_DIRS }); }
function asarList(archive) { return asarLib.listPackage(archive, { isPack: true }); }

function readBundleName() {
  const html = fs.readFileSync(path.join(EXTRACT, "dist", "index.html"), "utf8");
  const m = html.match(/src="\/assets\/(index-[^"]+\.js)"/);
  if (!m) die("bundle principal introuvable dans dist/index.html");
  return m[1];
}

function isPatched(asarPath) {
  try {
    const buf = asarLib.extractFile(asarPath, path.join("desktop", "dist", "localAI.js"));
    return buf.toString("utf8").startsWith(MARKER);
  } catch (e) {
    return false;
  }
}

// --- [publication] archive abîmée (audit du 26/09, M8) -------------------------------------------
// Une archive illisible n'est ni patchée ni originale. Prise pour un original, elle écrasait
// app.asar.orig, la seule copie saine. Contrôles : en-tête lisible, aucun fichier au-delà de la fin
// de l'archive (téléchargement tronqué), empreinte SHA-256 de chaque fichier égale à celle que
// l'en-tête déclare (moins d'une seconde pour 860 Mo). Renvoie la raison, ou null si l'archive est saine.
const crypto = require("crypto");
function asarAbime(archive) {
  if (!fs.existsSync(archive)) return "fichier absent";
  let h;
  try { h = asarLib.getRawHeader(archive); } catch (e) { return "en-tête illisible (" + e.message + ")"; }
  const debut = 8 + h.headerSize, taille = fs.statSync(archive).size;
  const fd = fs.openSync(archive, "r");
  let buf = Buffer.alloc(1 << 20);
  try {
    const pile = [["", h.header]];
    while (pile.length) {
      const [dossier, d] = pile.pop();
      for (const [nom, e] of Object.entries(d.files || {})) {
        const rel = dossier + "/" + nom;
        if (e.files) { pile.push([rel, e]); continue; }
        if (e.unpacked || e.link || e.offset === undefined) continue;
        const pos = debut + Number(e.offset);
        if (pos + e.size > taille) return "archive tronquée (" + rel + ")";
        if (!e.integrity) continue;
        if (buf.length < e.size) buf = Buffer.alloc(e.size);
        for (let lu = 0; lu < e.size;) {
          const n = fs.readSync(fd, buf, lu, e.size - lu, pos + lu);
          if (!n) return "lecture impossible (" + rel + ")";
          lu += n;
        }
        if (crypto.createHash("sha256").update(buf.subarray(0, e.size)).digest("hex") !== e.integrity.hash)
          return "contenu altéré (" + rel + ")";
      }
    }
  } finally { fs.closeSync(fd); }
  return null;
}
// Code de sortie 3 : la version d'origine du jeu ne peut pas être établie sans Steam (archive
// abîmée, sauvegarde absente ou abîmée). Rien n'a été modifié, l'installateur conseille alors la
// vérification de l'intégrité des fichiers dans Steam.
const CODE_STEAM = 3;
function dieSteam(msg) { console.error("[HomicideDeskFR] ERREUR : " + msg + ". Rien n'a été modifié."); process.exit(CODE_STEAM); }
// Code 2 : --retirer sur un jeu qui n'est pas patché, rien à retirer.
const CODE_RIEN = 2;
// --- fin [publication] ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1 + 2 : bundle du rendu (dictionnaire FR et consigne de langue)
// ---------------------------------------------------------------------------
const KA_FR = "fr:{wmSealed:\"SCELLÉ\",wmCaseFile:\"DOSSIER\",wmConfidential:\"CONFIDENTIEL\",bandTitle:\"BRIGADE CRIMINELLE · DOSSIER D\\'ENQUÊTE\",bandDept:\"POLICE DE RAVENPORT\",bandStatus:\"STATUT : EN COURS\",orgFallback:\"POLICE DE RAVENPORT · BRIGADE CRIMINELLE\",unitFallback:\"BRIGADE CRIMINELLE\",docFallback:\"DOCUMENT D\\'ENQUÊTE\",footMaster:\"DOSSIER D\\'ENQUÊTE ORIGINAL · NE PAS SORTIR DES ARCHIVES\",footOfficial:\"DOCUMENT OFFICIEL · RÉSERVÉ À L\\'ENQUÊTE\",page:\"PAGE 1 SUR 1\",stampSealed:\"S C E L L É\",stampOpen:\"E N   C O U R S\",stampEvidence:\"P R E U V E\",wmRecovered:\"RÉCUPÉRÉ\",fieldHead:\"RÉCUPÉRATION SUR LE TERRAIN\",fieldOrg:\"POLICE DE RAVENPORT\",fieldDoc:\"OBJET RÉCUPÉRÉ\",footField:\"PROPRIÉTÉ DU DÉPÔT DES SCELLÉS RPD · TOUTE ALTÉRATION EST UN DÉLIT\",reverseBlank:\"· VERSO LAISSÉ VIERGE ·\",tape:\"RPD · SCELLÉS\",roundStamp1:\"OBJET\",roundStamp2:\"RÉCUPÉRÉ\",medBand:\"SERVICE DE SANTÉ AU TRAVAIL · SECRET MÉDICAL\",medStamp:\"CONFIDENTIEL\",wmMedical:\"MÉDICAL\",footMedical:\"SECRET MÉDICAL · NE FIGURE PAS AU DOSSIER HIÉRARCHIQUE DE L\'AGENT\",medUnit:\"SANTÉ AU TRAVAIL\",medDoc:\"DOSSIER MÉDICAL DU PERSONNEL\"}";
function patchRenderer() {
  const name = readBundleName();
  const file = path.join(EXTRACT, "dist", "assets", name);
  let s = fs.readFileSync(file, "utf8");
  BUNDLE0 = s;
  const code = lire("code_fr.json");

  // ge() du rendu d'interrogatoire (4 phrases, 460 caractères) : l'arrêt anticipé de localAI.js
  // n'est sûr que pour CETTE fonction, reconnue à son empreinte. Autre version : désactivé.
  {
    const ie = s.search(/async function \w+\(\w+\)\{const \w+=\w+\.value,\w+=\w+\.value;if\(!\w+\(\w+\)&&\w+\.isLawyeredUp/);
    const g = ie < 0 ? -1 : s.lastIndexOf("function ge(be){", ie);
    const fin = g < 0 ? -1 : s.indexOf('return{text:Ue||"…",icon:We}}', g);
    const a2 = (s.match(/[,;]a2=(\d+)[,;]/) || [])[1], fd = (s.match(/[,;]Fd=(\d+)[,;]/) || [])[1];
    const empreinte = fin < 0 ? "" : require("crypto").createHash("sha256").update(s.slice(g, fin + 29)).digest("hex");
    if (empreinte === GE_VALIDEE && a2 && fd) {
      HDFR_GE = { a2: Number(a2), fd: Number(fd) };
      log("ge() du jeu reconnue (" + a2 + " phrases, " + fd + " caractères) : arrêt anticipé possible");
    } else log("info : ge() du jeu modifiée ou introuvable, arrêt anticipé désactivé");
  }

  // 1. chaînes FR manquantes : insérées en tête de l'objet FR (les clés existantes gardent priorité,
  //    car en JS la dernière occurrence d'une clé gagne)
  const anchorFR = '={"app.name":"HOMICIDE DESK","generic.close":"Fermer"';
  const iFR = s.indexOf(anchorFR);
  if (iFR < 0) die("dictionnaire FR introuvable (ancre generic.close=Fermer)");
  const additions = lire("fr_additions.json");
  const enDict = grabDict(s, '"settings.title":"Settings"');
  const frDict = grabDict(s, '"settings.title":"Paramètres"');
  const missing = Object.keys(enDict).filter(k => !(k in frDict));
  const notCovered = missing.filter(k => !(k in additions));
  const stale = Object.keys(additions).filter(k => k in frDict);
  if (notCovered.length) log("ATTENTION : " + notCovered.length + " clés EN toujours sans FR (nouvelle version ?) : " + notCovered.slice(0, 10).join(", "));
  if (stale.length) log("info : " + stale.length + " clés de fr_additions.json existent désormais dans le jeu (ignorées) : " + stale.slice(0, 5).join(", "));
  const toAdd = Object.fromEntries(Object.entries(additions).filter(([k]) => !(k in frDict)));
  const injected = JSON.stringify(toAdd).slice(1, -1); // sans les accolades
  s = s.slice(0, iFR) + "={" + injected + "," + s.slice(iFR + 2);
  log("dictionnaire FR : +" + Object.keys(toAdd).length + " chaînes");

  // 1b. corrections du dictionnaire FR existant (fr_overrides.json : calques, accords de genre du
  //     joueur ou du suspect, jargon). Remplacement borné au seul objet FR.
  const overrides = lire("fr_overrides.json");
  const frStart = iFR; // l'ancre n'est plus contiguë après l'insertion des ajouts, mais l'objet commence toujours ici
  let frEnd = frStart, depth = 0;
  for (let i = frStart + 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { frEnd = i; break; } }
  }
  if (frEnd === frStart) die("fin de l'objet FR introuvable");
  let frObj = s.slice(frStart, frEnd + 1);
  let applied = 0;
  const missed = [];
  for (const [k, v] of Object.entries(overrides)) {
    const re = new RegExp('"' + k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + '":"(?:[^"\\\\]|\\\\.)*"');
    if (!re.test(frObj)) { missed.push(k); continue; }
    frObj = frObj.replace(re, () => '"' + k + '":' + JSON.stringify(v));
    applied++;
  }
  s = s.slice(0, frStart) + frObj + s.slice(frEnd + 1);
  log("dictionnaire FR : " + applied + " valeurs corrigées" + (missed.length ? " (introuvables : " + missed.join(", ") + ")" : ""));

  // 2. consigne de langue FR pour les suspects (celle du studio, désignée par code_fr.json)
  const consigneStudio = code.consigneStudio;
  if (!s.includes(consigneStudio)) die("consigne de langue FR du studio introuvable (wI.fr)");
  const directive =
    "CONSIGNE DE LANGUE, PRIORITAIRE SUR TOUT : réponds uniquement en français naturel, sans un mot " +
    "d'anglais ni anglicisme (« le journal des accès », jamais « le log »). " +
    // Pas d'exemple : Gemma recopiait « je suis partie » pour Tommy Vale (banc du 24/09/2026).
    // Le genre est donné par la première phrase de chaque fiche (prompts_fr.json).
    "Accorde chaque mot au genre de ton personnage, que donne la première phrase de ta fiche. " +
    "Vouvoie TOUJOURS l'inspecteur, même en colère : « vous », jamais « tu », et « oui, inspecteur », sans article.";
  s = s.replace(consigneStudio, () => "fr:" + JSON.stringify(directive));
  log("consigne de langue FR renforcée");

  // 3. documents d'enquête réécrits en français naturel (cases/case-XXX.fr.json)
  s = require("./cases_inject.js").injectCases(s, log);

  // 4. alignement des textes scriptés (tutoriel du Personnel, messages du commissariat) sur les
  //    noms de documents et les choix de traduction retenus. Chaînes propres au français : un
  //    remplacement global est sans risque pour les autres langues.
  //    Les paires « texte du studio » vers « texte voulu » vivent dans code_fr.json (termes) :
  //    noms de documents du tutoriel, accord de genre du joueur, « Conseil de surveillance » de
  //    l'Atlas, titre de l'affaire 000 cité par le tutoriel et le certificat, et les dix mots du
  //    mini-jeu ROT-13 du labo, remplacés par des mots lisibles en anglais comme en français.
  const TERM_FIXES = code.termes;

  // Date de chaque affaire (« 17 March 2024 ») : champ anglais hors objet de traduction, affiché tel
  // quel sur l'ouverture, la carte des Archives, la liste des affaires et RPD-NET.
  const DATES_FR = { "11 January 2020": "11 janvier 2020", "17 March 2024": "17 mars 2024",
    "17 January 2020": "17 janvier 2020", "20 January 2020": "20 janvier 2020", "2 February 2020": "2 février 2020",
    "19 February 2020": "19 février 2020", "2 March 2020": "2 mars 2020" };

  for (const [from, to] of TERM_FIXES) {
    const n = s.split(from).length - 1;
    if (!n) { log("info : terme absent (version du jeu différente ?) : « " + from.slice(0, 40) + "… »"); continue; }
    s = s.split(from).join(to);
    log("alignement : « " + from.slice(0, 40) + (from.length > 40 ? "…" : "") + " » x" + n);
  }

  // 5. correctifs de code. Les mises à jour Steam renomment les identifiants minifiés à chaque
  //    build : on ancre donc sur des motifs stables (contenu, chaînes littérales) et jamais sur un
  //    nom de variable. Chaque correctif est optionnel et signale son absence sans interrompre.
  function reFix(nom, re, build) {
    const m = s.match(re);
    if (!m) { log("info : « " + nom + " » non trouvé dans cette version du jeu, correctif ignoré"); return false; }
    s = s.slice(0, m.index) + build(m) + s.slice(m.index + m[0].length);
    log("code : " + nom);
    return true;
  }

  // Référence de la langue courante (« Dt.value » avant la mise à jour du 06/09/2026, « Ot.value » après).
  const mLang = s.match(/function \w+\(\)\{return (\w+)\.value==="ar"\}/);
  if (!mLang) die("référence de langue introuvable (fonction « est-ce de l'arabe ? »)");
  const L = mLang[1] + ".value";
  log("référence de langue détectée : " + L);
  const frCaseId = (e) => '(' + L + '==="fr"?"AFFAIRE N°"+' + e + '.split("-")[1]:' + e + '.toUpperCase())';

  // Mécaniques écrites pour l'anglais seulement (1.2.1) : mots-clés de stress tapés par le joueur
  // et gestes du suspect qui choisissent l'icône de réaction. En français, motifs de
  // mecaniques_fr.json, même barème (8 points par mot-clé) et même ordre des icônes.
  const meca = lire("mecaniques_fr.json");
  const reFr = (motif) => "new RegExp(" + JSON.stringify(motif) + ',"iu")';
  // Mots-clés : hdfrMotsFr(texte, coupable), déclarée juste avant la fonction d'envoi (xe) pour
  // que le préchauffage projette le stress avec le même code. « saw you » (coupableSeul, décision
  // de l'auteur du 26/09/2026) ne compte que face au coupable de l'affaire (guiltySuspectId, celui
  // que le jeu compare à l'accusation). Les onze autres gardent la règle du studio.
  {
    const mS = s.match(/const (\w+)=\["prove","saw you","evidence","lied","access code","bank","will","debt","key","cctv","fired","silverware"\],(\w+)=(\w+)\.toLowerCase\(\);let (\w+)=\1\.filter\((\w+)=>\2\.includes\(\5\)\)\.length\*8;if\(\w+&&\(\4\+=10\),\4>0\)\{const \w+=\w+\.stress\[(\w+)\.value\]/);
    const debutComp = mS ? s.lastIndexOf('__name:"Interrogation"', mS.index) : -1;
    const mCas = debutComp < 0 ? null : s.slice(debutComp, mS.index).match(/(\w+)=\w+\(\(\(\w+=(\w+)\.activeCase\)==null\?void 0:\w+\.suspects\[0\]\.id\)\?\?""\)/);
    const debutXe = mS ? s.lastIndexOf("async function ", mS.index) : -1;
    if (!mS || !mCas || mCas[1] !== mS[6] || debutXe < 0 || mS.index - debutXe > 1500)
      log("info : « mots-clés de stress en français » non trouvé dans cette version du jeu, correctif ignoré");
    else {
      const [tout, Xe, Re, , ca, et] = mS;
      const coupable = "(" + mCas[2] + ".activeCase&&" + mCas[2] + ".activeCase.guiltySuspectId)===" + mS[6] + ".value";
      const neuf = tout.slice(0, tout.indexOf("let ")) + "let " + ca + "=(" + L + '==="fr"?hdfrMotsFr(' + Re + "," + coupable + "):" +
        Xe + ".filter(" + et + "=>" + Re + ".includes(" + et + "))).length*8;" + tout.slice(tout.indexOf(".length*8;") + 10);
      const fonction = "function hdfrMotsFr(hdfrT,hdfrC){return[" +
        meca.stress.map((e) => "[" + reFr(e.motif) + "," + (e.coupableSeul ? "1" : "0") + "]").join(",") +
        "].filter(([hdfrK,hdfrO])=>(!hdfrO||hdfrC)&&hdfrK.test(hdfrT))}";
      s = s.slice(0, debutXe) + fonction + s.slice(debutXe, mS.index) + neuf + s.slice(mS.index + tout.length);
      log("code : mots-clés de stress en français (« je vous ai vu » face au coupable seulement)");
    }
  }
  reFix("gestes et icônes de réaction en français",
    /(\w+)=(\[\[\/shak\(es\|ing\)\? \(his \|her \|their \)\?head\|refus\/i,"react-refuse"\][\s\S]*?\[\/lean\/i,"react-lean"\]\])/,
    (m) => m[1] + "=(hdfrT=>hdfrT.map(([hdfrR,hdfrI])=>{const hdfrF={" +
      Object.entries(meca.gestes).map(([k, v]) => JSON.stringify(k) + ":" + reFr(v)).join(",") +
      "}[hdfrI];return[hdfrF?{test:hdfrS=>hdfrR.test(hdfrS)||(" + L + '==="fr"&&hdfrF.test(hdfrS))}:hdfrR,hdfrI]}))(' + m[2] + ")");

  // Date du bureau (« SAT 7 MAR 2020 ») : jours et mois codés en dur en anglais.
  reFix("date du bureau",
    new RegExp("function (\\w+)\\(e=(\\w+)\\(\\)\\)\\{return\\x60\\$\\{(\\w+)\\[e\\.getDay\\(\\)\\]\\} \\$\\{e\\.getDate\\(\\)\\} \\$\\{(\\w+)\\[e\\.getMonth\\(\\)\\]\\} \\$\\{e\\.getFullYear\\(\\)\\}\\x60\\}"),
    (m) => "function " + m[1] + "(e=" + m[2] + "()){if(" + L + '!=="en"){try{return e.toLocaleDateString(' + L +
      ',{weekday:"short",day:"numeric",month:"short",year:"numeric"}).toUpperCase()}catch(_){}}' +
      m[0].slice(m[0].indexOf("){return") + 2));

  // Papier 3D : en-têtes, tampons, filigranes et pieds de page en anglais, arabe et chinois seulement.
  reFix("en-têtes du papier 3D",
    /function (\w+)\((\w+)\)\{return (\w+)\.test\(\2\)\?"ar":(\w+)\.test\(\2\)\?"zh":"en"\}const (\w+)=\{en:\{/,
    (m) => "function " + m[1] + "(" + m[2] + "){return " + m[3] + ".test(" + m[2] + ')?"ar":' + m[4] + ".test(" + m[2] +
      ')?"zh":' + L + '==="fr"?"fr":"en"}const ' + m[5] + "={" + KA_FR + ",en:{");

  // Appels radio du jour : livrés en anglais et en arabe seulement, hors dictionnaire.
  const radioFr = lire("radio_fr.json");
  reFix("table des appels radio",
    /(\w+)="\/icons\/police_radio_icon\.png",(\w+)=\[\{brief:/,
    (m) => m[1] + '="/icons/police_radio_icon.png",hdfrRadio=' + JSON.stringify(radioFr) + "," + m[2] + "=[{brief:");
  reFix("sélecteur des appels radio",
    /\{brief:(\w+)\?(\w+)\.briefAr:\2\.brief,clue:\1\?\2\.clueAr:\2\.clue,options:\1\?\2\.optionsAr:\2\.options,answerIndex:\2\.answerIndex\}/,
    (m) => {
      const f = m[1], h = m[2];
      const pick = (c) => f + "?" + h + "." + c + "Ar:(" + L + '==="fr"&&typeof hdfrRadio!=="undefined"&&hdfrRadio[' +
        h + ".brief]?hdfrRadio[" + h + ".brief]." + c + ":" + h + "." + c + ")";
      return "{brief:" + pick("brief") + ",clue:" + pick("clue") + ",options:" + pick("options") + ",answerIndex:" + h + ".answerIndex}";
    });

  // Identifiant d'affaire affiché brut (« CASE-001 ») sur l'ouverture, le mandat et RPD-NET.
  reFix("identifiant d'affaire, écran d'ouverture",
    /(\w+)\.id\)==null\?void 0:(\w+)\.toUpperCase\(\)/,
    (m) => m[1] + ".id)==null?void 0:" + frCaseId(m[2]));
  reFix("identifiant d'affaire, mandat",
    /\((\w+)\((\w+)\)\.activeCaseId\?\?""\)\.toUpperCase\(\)/,
    (m) => "(X=>" + frCaseId("X") + ")(" + m[1] + "(" + m[2] + ').activeCaseId??"")');
  reFix("identifiant d'affaire, RPD-NET",
    /(\w+)\.value\.caseId\.toUpperCase\(\)/,
    (m) => frCaseId(m[1] + ".value.caseId"));

  // Recherche RPD-NET insensible aux accents en français (audit du 26/09/2026) : « nephrectomie »
  // ne trouvait pas « néphrectomie ». Les deux normalisations de la recherche (No : espaces et
  // séparateurs, tc : lettres et chiffres seuls) retirent d'abord les diacritiques et défont œ, æ.
  {
    const sansAccents = (v) => "(" + L + '==="fr"?' + v + '.normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").replace(/œ/g,"oe").replace(/Œ/g,"OE").replace(/æ/g,"ae").replace(/Æ/g,"AE"):' + v + ")";
    reFix("recherche RPD-NET insensible aux accents",
      /function (\w+)\((\w+)\)\{return \2\.toLowerCase\(\)\.replace\(\/\[\\s\\-_\.,\/\]\+\/g," "\)\.trim\(\)\}function (\w+)\((\w+)\)\{return \4\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9/,
      (m) => "function " + m[1] + "(" + m[2] + "){return " + sansAccents(m[2]) + m[0].slice(m[0].indexOf(".toLowerCase()"), m[0].indexOf("}function ") + 1) +
        "function " + m[3] + "(" + m[4] + "){return " + sansAccents(m[4]) + ".toLowerCase().replace(/[^a-z0-9");
  }

  // « VICTIME: nom » : deux-points collés, à la française avec une espace avant.
  reFix("deux-points de la ligne victime",
    /l\((\w+)\(r\)\("dispatch\.victim"\)\)\+": "/,
    (m) => "l(" + m[1] + '(r)("dispatch.victim"))+(' + L + '==="fr"?" : ":": ")');

  // Relevés téléphoniques : durée d'appel composée à l'anglaise (« 0m 38s »). En français « 0:38 ».
  reFix("durée des appels",
    /l\(Math\.floor\((\w+)\.durationSec\/60\)\)\+"m "\+l\(\1\.durationSec%60\)\+"s"/,
    (m) => "(" + L + '==="fr"?Math.floor(' + m[1] + '.durationSec/60)+":"+String(' + m[1] +
      '.durationSec%60).padStart(2,"0"):l(Math.floor(' + m[1] + ".durationSec/60))+\"m \"+l(" + m[1] + '.durationSec%60)+"s")');

  // Date de chaque affaire : champ anglais affiché tel quel, transformé en accesseur.
  let nDates = 0;
  for (const [en, fr] of Object.entries(DATES_FR)) {
    const from = "date:" + JSON.stringify(en) + ",";
    const n = s.split(from).length - 1;
    if (!n) continue;
    s = s.split(from).join("get date(){return " + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "},");
    nDates += n;
  }
  log("code : dates des affaires (" + nDates + " occurrences)");

  // Trois textes anglais partent au modèle sans passer par le dictionnaire, et deux d'entre eux
  // occupent la position la plus lue du prompt, juste avant la question. Ils expliquent une part
  // du mélange de langues que la consigne de langue ne suffisait pas à corriger. On les rend
  // conditionnels : le français pour les joueurs français, l'anglais intact pour les neuf autres
  // langues, dont aucune ne doit être touchée.
  //  Les trois paires vivent dans code_fr.json (promptAnglais).
  const ANGLAIS_PROMPT = code.promptAnglais;
  let nAng = 0;
  for (const [en, fr] of ANGLAIS_PROMPT) {
    const av = JSON.stringify(en).slice(1, -1);
    const from = "`" + av;
    const n = s.split(from).length - 1;
    if (!n) { log("info : texte anglais du prompt absent : « " + en.slice(0, 40) + "… »"); continue; }
    s = s.split(from).join("`${" + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "}");
    nAng += n;
  }
  log("code : textes anglais du prompt rendus français (" + nAng + " occurrence(s))");

  // Ces deux consignes finissent par une queue anglaise écrite dans le code, derrière le nom de la
  // langue (« … en French only. Never use any English word… »), que la paire ci-dessus ne couvre pas.
  // La consigne de langue part deux fois par prompt (début et fin) : en français, elle se réduit à
  // notre directive, déjà complète. Mesuré le 24/09 : 376 jetons Qwen par prompt avant, et le seul
  // anglais qui restait dans le prompt des 32 rôles.
  reFix("consigne de langue sans queue anglaise",
    /return (\w+)\?\1\+(\w+):(?="LANGUAGE: MANDATORY, HIGHEST PRIORITY)/,
    (m) => "return " + m[1] + "?(" + L + '==="fr"?' + m[1] + ":" + m[1] + "+" + m[2] + "):");
  // Consigne du greffier du procureur, qui juge la déclaration avant accusation.
  //  Les textes du studio viennent de code_fr.json (ancrés dans le paquet public) : le début est la
  //  paire de promptAnglais déjà appliquée ci-dessus, la queue est code.greffierQueue. L'anglais
  //  d'origine est rendu tel quel (m[0], le gabarit trouvé dans le jeu) pour les autres langues.
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const paireGreffier = ANGLAIS_PROMPT.find(([, fr]) => fr === "Écris toute ta réponse en ");
  if (paireGreffier && code.greffierQueue)
    reFix("consigne du greffier en français",
      new RegExp("\\x60\\$\\{\\w+\\.value===\"fr\"\\?" + escRe(JSON.stringify(paireGreffier[1])) + ":" +
        escRe(JSON.stringify(paireGreffier[0])) + "\\}\\$\\{\\w+\\(\\w+\\)\\}" + escRe(code.greffierQueue) + "\\x60"),
      (m) => "(" + L + '==="fr"?' + JSON.stringify(code.consigneGreffier) + ":" + m[0] + ")");

  // Signal de langue pour localAI.js (fenêtre et filet du français, voir patchLocalAI) : l'unique
  // appel au modèle local ajoute hdfrLang à ses options. Le processus principal ne connaît pas la
  // langue de l'interface, le rendu si. Les autres langues ignorent ce champ.
  // [langue] Correctif FONDATEUR (audit M3, 26/09/2026) : sans lui, les questions françaises
  // passeraient par la route du studio (fenêtre de 4 096, coupe à 10 messages, pas de filet ni
  // d'arrêt anticipé) pendant que les préchauffages, qui écrivent hdfrLang:"fr" en dur, passent
  // par la route française : deux fenêtres, donc un rechargement du modèle à chaque alternance, et
  // un historique complet (CACHE_FR) sans filet contre le débordement. Aucun sous-ensemble de
  // l'architecture française ne tient sans lui : le patch s'arrête, le jeu d'origine reste intact.
  // hdfrArret : la réplique d'un SMS n'est pas coupée par ge() (seul le rendu de l'interrogatoire
  // l'est), l'arrêt anticipé ne vaut donc pas pour elle (audit m4).
  const smsLg = ancreSms(s);
  if (!smsLg) log("ATTENTION : envoi des SMS introuvable, arrêt anticipé laissé sur leurs réponses");
  if (!reFix("langue transmise au modèle local",
    /\{maxTokens:(\w+)==="judge"\?300:400,temperature:\1==="judge"\?\.2:\.8,format:\1==="judge"\?(\w+):void 0\}/,
    (m) => m[0].slice(0, -1) + ",hdfrLang:" + L + (smsLg ? ",hdfrArret:" + m[1] + "!==" + smsLg.genre : "") + "}"))
    die("langue de l'interface non transmise au modèle local (appel du modèle introuvable) : jeu d'origine laissé en place");

  // Pièces connues du suspect (décision du 24/09/2026, tests joueur) : le studio met dans le prompt
  // TOUTES les pièces ramassées (collectedEvidenceIds), montrées ou non, et un petit modèle s'en
  // sert avant que l'inspecteur en parle (Tommy Vale citait le cahier de fermeture, 3 fois sur 3,
  // et une consigne de texte n'y change rien, mesuré). En français, la liste se réduit aux pièces
  // déjà posées sur la table devant CE suspect : leur nom est dans l'historique, car le jeu y
  // enregistre « int.presents » suivi de la question. Autres langues : filtre du studio intact.
  const mEnvoi = s.match(/async function \w+\(\w+\)\{const (\w+)=(\w+)\.value,\w+=\w+\.value;if\(!\w+\(\1\)&&(\w+)\.isLawyeredUp\(\1\)\)/);
  if (mEnvoi)
    reFix("pièces connues du suspect : seulement celles montrées",
      /(\w+)=\(\(\((\w+)=(\w+)\.value\)==null\?void 0:\2\.evidence\)\?\?\[\]\)\.filter\((\w+)=>(\w+)\.collectedEvidenceIds\.includes\(\4\.id\)\)/,
      (m) => m[0].slice(0, -1) + "&&(" + L + '!=="fr"||' + mEnvoi[3] + ".getHistory(" + mEnvoi[2] + '.value).some(hdfrH=>hdfrH.role==="player"&&String(hdfrH.text).includes(' + m[4] + ".name))))");
  else log("info : fonction d'envoi de l'interrogatoire non trouvée, liste des pièces du studio gardée");

  // Ce que le suspect cache (décision du 24/09/2026, test joueur : Tommy Vale a donné l'heure et le
  // lieu de la revente sans avoir vu le bordereau). Même leçon que pour les pièces : ce que le modèle
  // ne doit pas dire ne doit pas être dans son prompt. Un passage de personnalité entouré de
  // [[SI:<id de pièce>]]…[[/SI]] (prompts_fr.json, français seulement) n'y entre qu'une fois cette
  // pièce posée devant CE suspect, d'après la liste filtrée ci-dessus. Sans marqueur, rien ne change.
  const mPerso = s.match(/(\w+)=\w+\.value\?\(\((\w+)=\w+\.value\)==null\?void 0:\2\.systemPrompt\)\?\?"":\(\((\w+)=\w+\.value\)==null\?void 0:\3\.systemPrompt\)\?\?""/);
  const mMontrees = s.match(/(\w+)=\(\(\((\w+)=\w+\.value\)==null\?void 0:\2\.evidence\)\?\?\[\]\)\.filter\((\w+)=>\w+\.collectedEvidenceIds\.includes\(\3\.id\)&&\(/);
  const siFiltre = !!(mEnvoi && mPerso && mMontrees);
  HDFR_SI_FILTRE = siFiltre;
  const RE_SI = "/\\[\\[SI:([^\\]]+)\\]\\]([\\s\\S]*?)\\[\\[\\/SI\\]\\]/g";
  if (siFiltre) {
    const E = mPerso[1], SA = mMontrees[1];
    const gabarit = "${" + E + "}${";
    const at = s.indexOf(gabarit, mPerso.index);
    if (at < 0 || at - mPerso.index > 5000) die("gabarit du prompt introuvable après la personnalité");
    const filtre = CACHE_FR
      // prompt stable : aucun passage [[SI]] dans le système en français (ils partent dans les notes)
      ? "${(" + L + '==="fr"?' + E + ".replace(" + RE_SI + ',""):' + E + ")}${"
      : "${" + E + ".replace(" + RE_SI + ",(hdfrT,hdfrId,hdfrC)=>hdfrId.split(\"|\").some(hdfrO=>hdfrO.split(\"+\").every(hdfrI=>" + SA + ".some(hdfrP=>hdfrP.id===hdfrI)))?hdfrC:\"\")}${";
    s = s.slice(0, at) + filtre + s.slice(at + gabarit.length);
    log("code : personnalités, passages cachés jusqu'à la pièce qui les révèle");
    if (CACHE_FR) {
      // Queue du gabarit : ${We}${Ue}${Ne}\n\n${r2}${Re}\n\n${be}` . En français, la liste des pièces
      // posées (Ne) et les passages [[SI]] qu'elles dévoilent quittent le prompt système : ils le
      // faisaient changer en cours de partie et le moteur relisait tout (jusqu'à 74 s, mesuré).
      // Ils suivent le prompt après un séparateur (U+241E) que la fonction d'envoi retire.
      const reQueue = /^\$\{(\w+)\}\$\{(\w+)\}\$\{(\w+)\}\n\n\$\{(\w+)\}\$\{(\w+)\}\n\n\$\{(\w+)\}`\}/;
      const debut = at + filtre.length - 2;
      const mq = s.slice(debut).match(reQueue);
      if (!mq) die("queue du gabarit du prompt introuvable (architecture CACHE_FR)");
      const [tout, We, Ue, Ne, r2, Re, be] = mq;
      // V2 (25/09, validée au banc) : la liste des pièces montrées RESTE dans le prompt système.
      // Déplacée dans le dernier message (C4), elle devenait une affirmation de l'inspecteur que
      // le suspect contestait (Dana niait le registre qu'elle a signé, 4 fois sur 5). Seuls les
      // passages [[SI]] dévoilés partent dans les notes, sans phrase d'introduction.
      // HUMEUR_NOTES_FR : l'humeur (bloc du studio « (T.value?"":`\n\n${va[Ve.value.label]}`) ») est
      // lue ici, avant toute modification, pour la reprendre dans les notes.
      const reHumeur = /\((\w+)\.value\?"":`\n\n\$\{(\w+)\[(\w+)\.value\.label\]\}`\)/;
      const mH = HUMEUR_NOTES_FR ? s.slice(mPerso.index, at).match(reHumeur) : null;
      if (HUMEUR_NOTES_FR && !mH) die("humeur du suspect introuvable dans le prompt (HUMEUR_NOTES_FR)");
      const devoile = "hdfrR.length?" + JSON.stringify(code.notesDevoile || "Ce que tu peux désormais reconnaître :\n") +
        '+hdfrR.join("\\n"):""';
      const retour = mH
        ? "const hdfrS=" + devoile + ",hdfrU=" + mH[1] + ".value?\"\":" + mH[2] + "[" + mH[3] + '.value.label];return[hdfrU,hdfrS].filter(Boolean).join("\\n\\n")'
        : "return " + devoile;
      const notes = "(" + L + '==="fr"?"\\u241e"+(()=>{const hdfrR=[...' + E + ".matchAll(" + RE_SI +
        ")].filter(hdfrX=>hdfrX[1].split(\"|\").some(hdfrO=>hdfrO.split(\"+\").every(hdfrI=>" + SA + ".some(hdfrP=>hdfrP.id===hdfrI)))).map(hdfrX=>hdfrX[2].trim());" +
        retour + "})():\"\")";
      const neuf = "${" + We + "}${" + Ue + "}${" + Ne + "}\n\n${" + r2 + "}${" + Re +
        "}\n\n${" + be + "}`+" + notes + "}";
      s = s.slice(0, debut) + neuf + s.slice(debut + tout.length);
      log("code : fiche stable en français, dévoilements [[SI]] dans le dernier message (V2)");
      if (mH) {
        // l'humeur quitte le prompt système en français (elle est avant « debut » : rien ne se décale)
        const i = s.indexOf(mH[0], mPerso.index);
        s = s.slice(0, i) + "(" + mH[1] + ".value||" + L + '==="fr"?"":' + mH[0].slice(mH[1].length + 11) + s.slice(i + mH[0].length);
        log("code : humeur du suspect dans le dernier message (HUMEUR_NOTES_FR)");
      }
    }
  } else log("ATTENTION : assemblage du prompt non trouvé, passages [[SI:…]] gardés sans leurs marqueurs, " +
    "architecture du cache et préchauffages désactivés ensemble");

  // Fonction d'envoi (Ie) : sépare le prompt de ses notes, les place dans le dernier message (que le
  // jeu ne garde pas dans l'historique), et garde tout l'historique en français (la coupe à 10
  // messages décalait le début de la conversation à chaque tour : relecture complète, mesuré).
  if (CACHE_FR && siFiltre) {
    const mIe = s.match(/async function \w+\(\w+\)\{const (\w+)=(\w+)\.value,(\w+)=(\w+)\.value;if\(!/);
    if (!mIe) die("fonction d'envoi introuvable (architecture CACHE_FR)");
    const [avant, A, , U, MA] = mIe;
    const apres = avant.replace("," + U + "=" + MA + ".value;", () => ",hdfrP=" + MA + '.value.split("\\u241e"),' + U + '=hdfrP[0],hdfrN=hdfrP[1]||"";');
    s = s.slice(0, mIe.index) + apres + s.slice(mIe.index + avant.length);
    const zone = s.slice(mIe.index, mIe.index + 1500);
    const mHg = zone.match(new RegExp("await (\\w+)\\(" + A + ",(\\w+)," + U + ",(\\w+)\\)"));
    const mSl = zone.match(/\.filter\((\w+)=>\1\.role!=="system"\)\.slice\(-10\)/);
    if (!mHg || !mSl) die("appel du modèle ou coupe de l'historique introuvable (architecture CACHE_FR)");
    let z = zone.replace(mHg[0], () => "await " + mHg[1] + "(" + A + ",hdfrN?" + JSON.stringify(code.notesEntete || "") +
      "+hdfrN+\"\\n\\n\"+" + mHg[2] + ":" + mHg[2] + "," + U + "," + mHg[3] + ")");
    // Question en double (26/09/2026) : l'unique appelant (xe) range la question dans l'historique
    // AVANT l'envoi, et l'appel du modèle la rajoute en dernier message. Le modèle lisait deux
    // messages identiques d'affilée et reprochait à l'inspecteur de se répéter (Lisa, tour 1).
    // En français, l'historique envoyé s'arrête donc avant cette question.
    z = z.replace(mSl[0], () => mSl[0].replace(".slice(-10)", () => ".slice(" + L + '==="fr"?-1e3:-10,' + L + '==="fr"?-1:void 0)'));
    let avantIe = "";
    if (PIECE_HIST_FR) {
      // Tour d'une pièce : la question rangée (« [Présente une pièce : NOM]\nquestion ») reste dans
      // l'historique envoyé, et le dernier message ne porte plus que la pose et la présentation
      // (sans la question, déjà lue). Le tour suivant retrouve alors tout ce qui a été lu. Variante
      // préférée à « ranger la forme envoyée dans l'historique » : la bulle du joueur à l'écran et
      // l'historique sauvegardé restent ceux du studio, la présentation n'est lue qu'une fois.
      const Q = avant.match(/^async function \w+\((\w+)\)/)[1];
      const mPa = z.match(/const (\w+)=(\w+)\.getHistory\((\w+)\)\.filter\(\w+=>\w+\.role!=="system"\)\.slice\([^)]*\)\.map\(\w+=>\(\{role:[^}]*\}\)\);try\{/);
      if (!mPa) die("historique envoyé introuvable dans la fonction d'envoi (PIECE_HIST_FR)");
      z = z.replace(mPa[0], () => mPa[0].slice(0, -4) + Q + "=" + L + '==="fr"?hdfrPiece(' + Q + "," + mPa[1] + "," + mPa[2] +
        ".getHistory(" + mPa[3] + ")):" + Q + ";try{");
      avantIe = "function hdfrPiece(hdfrE,hdfrM,hdfrH){const hdfrL=hdfrH.filter(hdfrX=>hdfrX.role!==\"system\").at(-1);" +
        "if(!hdfrL||hdfrL.role!==\"player\"||hdfrL.text===hdfrE)return hdfrE;const hdfrI=String(hdfrL.text).indexOf(\"\\n\");" +
        "if(hdfrI<0)return hdfrE;const hdfrQ=hdfrL.text.slice(hdfrI+1);if(!hdfrE.endsWith(\"\\n\\n\"+hdfrQ))return hdfrE;" +
        "hdfrM.push({role:\"user\",content:hdfrL.text});return hdfrE.slice(0,hdfrE.length-hdfrQ.length-2)}";
      log("code : présentation de pièce en dernier message, question gardée dans l'historique (PIECE_HIST_FR)");
    }
    s = s.slice(0, mIe.index) + avantIe + z + s.slice(mIe.index + zone.length);
    log("code : notes dans le dernier message et historique complet en français");
  }

  // Préchauffage (25/09/2026, délai de réponse, refondu le 26/09 après l'audit) : pendant que le
  // joueur choisit, épingle et tape, le moteur lit déjà le prompt système et l'historique que la
  // question enverra. Le moteur réutilise ensuite cette lecture. Même calcul, fait plus tôt : aucune
  // différence de texte, la question part telle quelle. Une question envoyée pendant la lecture
  // attend son tour dans la file de localAI.js, sans rien perdre, et localAI.js abandonne tout
  // préchauffage dépassé par une demande plus récente (hdfrPrechauffe).
  // Règles (audit du 26/09) :
  //  - rien à l'ouverture de la fenêtre : elle montre le premier suspect, que le joueur quitte
  //    souvent (préchauffage perdu, 37 scénarios sur 52). Déclencheurs : choix d'un suspect,
  //    épinglage d'une pièce, frappe de la question, fin d'avocat ou de remise en liberté.
  //  - rien pour un suspect qui ne peut pas répondre (avocat, relâché), ni pendant une réponse
  //    attendue ou affichée, ni après une question partie avant la fin de l'attente (800 ms).
  //  - le prompt préchauffé est celui de la question : pièce épinglée comprise (hdfrEp) et humeur
  //    projetée (hdfrSt), avec le stress que la question ajoutera (mots-clés tapés, pièce, questions
  //    débloquées). Sans cela, une pièce qui fait franchir un seuil (40, 70) changeait le prompt
  //    système et le moteur relisait tout (10 s avant le premier jeton, partie du 26/09).
  //  - un prompt déjà préchauffé à l'identique n'est pas renvoyé (la frappe réévalue souvent).
  // Tout ou rien pour le cœur (ancres d'envoi, de prompt, d'API, d'ouverture), l'épinglage et
  // l'humeur projetée sont facultatifs et signalent leur absence.
  // la fonction d'envoi peut déjà avoir été modifiée par l'architecture CACHE_FR (hdfrP=…split)
  const mPrompt = s.match(/async function \w+\(\w+\)\{const (\w+)=(\w+)\.value,(?:\w+=)?(?:hdfrP=)?(\w+)\.value(?:\.split\([^)]*\))?[;,]/);
  const mApi = s.match(/const (\w+)=(\w+)\(\);if\(\1\)try\{const \w+=await \1\.ask\(/);
  const mOuvre = s.match(/Ra\((\w+),(\w+)=>(\w+)\(\2\),\{immediate:!1\}\),Ya\(\(\)=>\3\(\1\.value\)\);/);
  // garde de l'envoi (xe) : texte saisi, réponse attendue, réplique affichée, relâché, avocat
  const mGarde = s.match(/const (\w+)=(\w+)\.value\.trim\(\);if\(!\1\|\|(\w+)\.value\|\|(\w+)\.value\|\|(\w+)\.value\|\|(\w+)\.value\)return;/);
  const mDa = mGarde && s.match(new RegExp("(" + mGarde[5] + "=[\\w$]+\\(\\(\\)=>\\(\\w+\\.value,!\\w+\\.value&&\\w+\\.isReleased\\(\\w+\\.value\\)\\)\\))"));
  const mIa = mGarde && s.match(new RegExp(mGarde[6] + "=[\\w$]+\\(\\(\\)=>\\(\\w+\\.value,\\w+\\.isLawyeredUp\\(\\w+\\.value\\)\\)\\)"));
  // Épinglage : la déclaration de v DANS le composant de l'interrogatoire, la dernière avant la
  // fonction d'épinglage et après le début du composant. Le 25/09, la première du bundle était
  // prise, dans un autre composant : « hdfrEp is not defined » à chaque question, suspects muets.
  const mEpingle = s.match(/function \w+\(be\)\{var Ee;if\(!\(\w+\.value\|\|\w+\.value\)\)\{if\((\w+)\.value===be\)\{\1\.value=null/);
  const Vp = mEpingle && mEpingle[1];
  let mRef = null;
  if (Vp) {
    const debutComposant = s.lastIndexOf("setup(", mEpingle.index);
    for (const m of s.matchAll(new RegExp("([,{;])" + Vp + "=(\\w+)\\(null\\)", "g")))
      if (m.index > debutComposant && m.index < mEpingle.index) mRef = m;
  }
  const filtreAvant = mEnvoi ? "&&(" + L + '!=="fr"||' + mEnvoi[3] + ".getHistory(" + mEnvoi[2] + ".value).some(" : null;
  const mFiltre = filtreAvant && s.indexOf(filtreAvant);
  const epinglage = !!(CACHE_FR && siFiltre && mEpingle && mRef && mFiltre > 0 && s.split(filtreAvant).length === 2);
  // Humeur projetée : l'humeur (Ve) lit le stress, le stress ajouté par la question vient de la
  // même mécanique que l'envoi (xe) : témoin, mots-clés, pièce (+10), questions débloquées.
  const mHumeur = s.match(/if\((\w+)\.value\)return\{label:"COOPERATIVE",cls:"low"\};const (\w+)=(\w+)\.value;return \2>70/);
  const mTemoin = s.match(/if\(!(\w+)\.value\)\{const \w+=\["prove"/);
  const mTa = s.match(/(\w+)\(\)\.find\((\w+)=>\2\.evidenceToUnlockId&&\2\.requiredEvidenceIds\.includes\(\w+\.id\)\)/);
  const mQe = s.match(/\w+\(\)\.find\((\w+)=>\1!==\w+&&(\w+)\(\w+,\1\)\)/);
  const mMots = s.match(/hdfrMotsFr\(\w+,(\(\w+\.activeCase&&\w+\.activeCase\.guiltySuspectId\)===\w+\.value)\)/);
  const projection = !!(epinglage && mRef && mHumeur && mTemoin && mTa && mQe);
  // [langue] tout ou rien avec l'architecture du cache (audit M3) : le préchauffage lit l'historique
  // complet comme l'envoi de CACHE_FR. Sans elle, il ferait lire au moteur un texte que la question
  // suivante ne reprend pas.
  if (CACHE_FR && siFiltre && mPrompt && mApi && mOuvre && mEnvoi && mGarde && mDa && mIa) {
    const F = mOuvre[1], ST = mEnvoi[3], [, , G, OCC, AFF, REL, AVO] = mGarde;
    if (epinglage) {
      const [refTout, sep, REF] = mRef;
      // à la position trouvée, pas s.replace : le même texte existe dans un autre composant
      s = s.slice(0, mRef.index) + sep + Vp + "=" + REF + "(null),hdfrEp=" + REF + "(null)" +
        (projection ? ",hdfrSt=" + REF + "(0)" : "") + s.slice(mRef.index + refTout.length);
      // le filtre des pièces montrées : la pièce épinglée compte le temps du préchauffage
      const X = s.slice(s.lastIndexOf(".filter(", s.indexOf(filtreAvant)) + 8).match(/^(\w+)=>/)[1];
      s = s.replace(filtreAvant, () => "&&(" + L + '!=="fr"||hdfrEp.value===' + X + ".id||" + mEnvoi[3] + ".getHistory(" + mEnvoi[2] + ".value).some(");
    } else log("info : épinglage des pièces non trouvé, pas de préchauffage à l'épinglage");
    if (projection) {
      // l'humeur lit le stress plus hdfrSt, nul hors du calcul du préchauffage
      const h = s.indexOf(mHumeur[0]);
      s = s.slice(0, h) + mHumeur[0].replace("const " + mHumeur[2] + "=" + mHumeur[3] + ".value;",
        "const " + mHumeur[2] + "=" + mHumeur[3] + ".value+hdfrSt.value;") + s.slice(h + mHumeur[0].length);
    } else log("info : mécanique du stress non reconnue, préchauffage sans l'humeur projetée");
    // Stress après la question, calculé comme l'envoi (xe) : plafond 25 pour mots-clés et pièce,
    // 100 = avocat (la question ne part pas).
    const stressProjete = !projection ? "" :
      "let hdfrS=" + ST + ".getStress(hdfrQui);if(!" + mTemoin[1] + ".value){const hdfrT=" + G + ".value.trim();" +
      "const hdfrC=" + (mMots ? "hdfrMotsFr(hdfrT.toLowerCase()," + mMots[1] + ").length*8" : "0") + "+(hdfrQuoi?10:0);" +
      "hdfrC>0&&(hdfrS=Math.min(100,hdfrS+Math.min(hdfrC,25)));let hdfrD=null;" +
      "if(hdfrQuoi){const hdfrE=" + mTa[1] + "().find(hdfrF=>hdfrF.evidenceToUnlockId&&hdfrF.requiredEvidenceIds.includes(hdfrQuoi));" +
      "hdfrE&&(hdfrD=hdfrE,hdfrE.stressIncrease>0&&(hdfrS=Math.min(100,hdfrS+hdfrE.stressIncrease)))}" +
      "const hdfrJ=" + mTa[1] + "().find(hdfrF=>hdfrF!==hdfrD&&" + mQe[2] + "(hdfrT,hdfrF));" +
      "hdfrJ&&hdfrJ.stressIncrease>0&&(hdfrS=Math.min(100,hdfrS+hdfrJ.stressIncrease))}if(hdfrS>=100)return;";
    const chauffe = "let hdfrMinuterie=null,hdfrFait=\"\";function hdfrChauffe(hdfrAttente){try{if(" + L + '!=="fr"||!' + F +
      ".value)return;if(hdfrMinuterie&&hdfrAttente<800)return;clearTimeout(hdfrMinuterie);const hdfrQui=" + F + ".value,hdfrN=" + ST +
      ".getHistory(hdfrQui).length;hdfrMinuterie=setTimeout(()=>{hdfrMinuterie=null;try{" +
      "if(" + F + ".value!==hdfrQui||" + ST + ".getHistory(hdfrQui).length!==hdfrN)return;" +
      "if(" + OCC + ".value||" + AFF + ".value||" + REL + ".value||" + AVO + ".value)return;" +
      "const hdfrQuoi=" + (epinglage ? Vp + ".value" : "null") + ";" + stressProjete +
      "const hdfrA=" + mApi[2] + "();if(!hdfrA)return;" +
      (epinglage ? "hdfrEp.value=hdfrQuoi;" : "") + (projection ? "hdfrSt.value=hdfrS-" + ST + ".getStress(hdfrQui);" : "") +
      "let hdfrY;try{hdfrY=" + mPrompt[3] + '.value.split("\\u241e")[0]}finally{' +
      (epinglage ? "hdfrEp.value=null;" : "") + (projection ? "hdfrSt.value=0;" : "") + "}" +
      "const hdfrH=" + ST + '.getHistory(hdfrQui).filter(hdfrM=>hdfrM.role!=="system").map(hdfrM=>({role:hdfrM.role==="player"?"user":"assistant",content:hdfrM.text}));' +
      "const hdfrK=JSON.stringify([hdfrQui,hdfrY,hdfrH]);if(hdfrK===hdfrFait)return;hdfrFait=hdfrK;" +
      'hdfrA.ask(hdfrY,[...hdfrH,{role:"user",content:"…"}],{maxTokens:1,temperature:.8,hdfrLang:"fr",hdfrPrechauffe:!0}).catch(()=>{})' +
      "}catch{}},hdfrAttente)}catch{}}";
    // Choix du suspect et épinglage : 800 ms (un joueur qui passe d'un suspect à l'autre n'empile
    // rien). Frappe : 300 ms, sans repousser une attente déjà en cours.
    s = s.replace(mOuvre[0], () => mOuvre[0] + chauffe + ";Ra(" + F + ",()=>hdfrChauffe(800))," +
      (epinglage ? "Ra(" + Vp + ",()=>hdfrChauffe(800))," : "") + "Ra(" + G + ",()=>hdfrChauffe(300));");
    // fin d'avocat ou de remise en liberté du suspect affiché (surveillance posée après leur déclaration)
    s = s.replace(mDa[1], () => mDa[1] + ",hdfrVeille=Ra(()=>" + REL + ".value||" + AVO + ".value,hdfrV=>{hdfrV||hdfrChauffe(800)})");
    log("code : préchauffage du prompt de la prochaine question (français" + (epinglage ? ", pièce épinglée" : "") +
      (projection ? ", humeur projetée" : "") + ")");
  } else log((CACHE_FR && siFiltre ? "ATTENTION" : "info") + " : interrogatoire non reconnu, pas de préchauffage");

  // Préchauffage du greffier du mandat d'arrêt (1.2.3, 27/09/2026). Après
  // « AUTORISER L'ARRESTATION », 23 à 24 s d'attente (deux parties sur le vrai moteur), dont 16 de
  // relecture à froid du prompt du greffier (affaire, suspects, résumés, texte complet des pièces
  // jointes, environ 2 200 jetons). Ce prompt ne dépend que du suspect désigné et des pièces
  // jointes, pas de la conclusion : le moteur le lit pendant que le joueur écrit et signe.
  // Même code que la vraie requête, sans copie : le dossier de Le() devient hdfrDossier(), que
  // Le() appelle elle-même, et SI() rend son prompt système à un rappel (hdfrP) au lieu d'appeler
  // le modèle. localAI.js écarte un préchauffage identique à ce que le moteur vient de lire, et la
  // vraie requête interrompt un préchauffage en cours. Rien pendant l'examen ni après le tampon.
  // Déclencheurs (mesure du 27/09, joueur pressé) : rien avant le nombre minimal de pièces jointes
  // du mandat (le prompt change à chaque pièce, relire le dossier au seul choix du suspect coûtait
  // 11 à 37 s pour rien), puis 2,5 s sans nouveau suspect ni nouvelle pièce. Frappe et signature :
  // 300 ms, sans repousser une attente en cours (reprise si un interrogatoire a pris le cache).
  {
    const mLe = s.match(/async function (\w+)\(\)\{var (\w+);if\(!(\w+)\.value\|\|(\w+)\.value\|\|(\w+)\.value\|\|!(\w+)\.value\)return;if\(\w+\.value="",\w+\((\w+)\.value\)<2\)\{[^{}]*\}\4\.value=!0;/);
    const nLe = mLe ? s.split(mLe[0]).length - 1 : 0;
    const debutDossier = mLe ? mLe.index + mLe[0].length : -1;
    const mAppel = mLe ? s.slice(debutDossier, debutDossier + 6000).match(/;let \w+=!0,[^;]*;try\{const \w+=await (\w+)\(([^()]*)\);/) : null;
    // Le() doit appartenir au composant du mandat (dernier composant déclaré avant elle)
    const dansMandat = !!mLe && s.lastIndexOf("__name:", mLe.index) === s.lastIndexOf('__name:"WarrantApp"', mLe.index);
    const SI = mAppel && mAppel[1];
    const mSi = SI && s.match(new RegExp("async function " + SI + "\\((\\w+),(\\w+),(\\w+),(\\w+)=\"\",(\\w+)=\\[\\]\\)\\{"));
    const nSi = mSi ? s.split(mSi[0]).length - 1 : 0;
    const finSi = mSi ? s.indexOf("async function ", mSi.index + 10) : -1;
    const corpsSi = mSi ? s.slice(mSi.index, finSi) : "";
    const mCite = corpsSi.match(/if\((\w+)\.length>0&&(\w+)===0\)return\{valid:!1,feedback:"",score:0,graded:!0,uncited:!0\};/);
    const mJuge = corpsSi.match(/;try\{const\{askSuspectAPI:(\w+)\}=await [\s\S]*?await \1\("judge",\w+,(\w+),\[\]\)/);
    const mFormat = s.match(/format:(\w+)==="judge"\?(\w+):void 0,hdfrLang:/);
    const mT = mLe && s.slice(s.lastIndexOf('__name:"WarrantApp"', mLe.index), mLe.index);
    // pièces jointes (R), signature (ie), lues dans le composant
    const mJointes = mT && mT.match(/function \w+\((\w+)\)\{(\w+)\.value\.length>=\w+\|\|\(\2\.value=\[\.\.\.\2\.value,\1\]/);
    const mSigne = mT && mT.match(/!(\w+)\.value&&\w+>=\w+&&\(\1\.value=!0,\w+\.tell\(\)\)/);
    // nombre minimal de pièces jointes exigé par le mandat (case à cocher du studio)
    const mMin = mT && mT.match(/"warrant\.ckExhibits",\{min:(\w+)\}/);
    let noms = null;
    if (mLe && mAppel) noms = declarateurs(s.slice(debutDossier, debutDossier + mAppel.index));
    if (CACHE_FR && siFiltre && mApi && nLe === 1 && dansMandat && mAppel && nSi === 1 && mCite && mJuge && mFormat &&
      mJointes && mSigne && mMin && noms && noms.length) {
      const [, LE, VAR, EA, FE, TAMPON, SUSPECT, CONCL] = mLe;
      const decl = s.slice(debutDossier, debutDossier + mAppel.index);
      const liste = noms.join(",");
      // 1. SI() : mode préchauffage (rappel hdfrP), sans le refus « aucune pièce citée »
      const corps = corpsSi.replace(mSi[0], () => mSi[0].slice(0, -2) + ",hdfrP){")
        .replace(mCite[0], () => "if(!hdfrP&&" + mCite[0].slice(3))
        .replace(mJuge[0], () => ";if(hdfrP)return hdfrP(" + mJuge[2] + ")" + mJuge[0]);
      s = s.slice(0, mSi.index) + corps + s.slice(finSi);
      // 2. Le() : dossier calculé par hdfrDossier(), la même instruction déplacée
      const i = s.indexOf(mLe[0]);
      const fonctions = "function hdfrDossier(){var " + VAR + ";" + decl + ";return{" + liste + "}}" +
        "let hdfrMinuterieG=null;function hdfrChauffeGreffier(hdfrAttente){try{if(" + L + '!=="fr"||!' + SUSPECT + ".value||" + FE + ".value||" + TAMPON +
        ".value||" + mJointes[2] + ".value.length<" + mMin[1] + ")return;if(hdfrMinuterieG&&hdfrAttente<2500)return;clearTimeout(hdfrMinuterieG);hdfrMinuterieG=setTimeout(()=>{hdfrMinuterieG=null;try{" +
        "if(!" + SUSPECT + ".value||" + FE + ".value||" + TAMPON + ".value||" + mJointes[2] + ".value.length<" + mMin[1] + ")return;const hdfrA=" + mApi[2] + "();if(!hdfrA)return;" +
        "const{" + liste + "}=hdfrDossier();" + SI + "(" + mAppel[2] + ",hdfrB=>{hdfrA.ask(hdfrB,[{role:\"user\",content:\"…\"}]," +
        "{maxTokens:1,temperature:.2,format:" + mFormat[2] + ',hdfrLang:"fr",hdfrPrechauffe:!0}).catch(()=>{})}).catch(()=>{})' +
        "}catch{}},hdfrAttente)}catch{}}" +
        "Ra(" + SUSPECT + ",()=>hdfrChauffeGreffier(2500)),Ra(" + mJointes[2] + ",()=>hdfrChauffeGreffier(2500))," +
        "Ra(" + CONCL + ",()=>hdfrChauffeGreffier(300)),Ra(" + mSigne[1] + ",()=>hdfrChauffeGreffier(300)),Ya(()=>hdfrChauffeGreffier(2500));";
      const neufLe = mLe[0] + "const{" + liste + "}=hdfrDossier()";
      s = s.slice(0, i) + fonctions + neufLe + s.slice(i + mLe[0].length + decl.length);
      log("code : préchauffage du greffier du mandat (français)");
    } else log((CACHE_FR && siFiltre ? "ATTENTION" : "info") + " : mandat d'arrêt non reconnu, pas de préchauffage du greffier");
  }

  s = patchCaseClosedMail(s, L);

  s = patchInlineFrench(s, L);
  s = patchTextesVisibles(s, L);
  fs.writeFileSync(file, s);
}

// ── [langue] Lexique du bundle (26/09/2026, audit M2) ─────────────────────────────────────────
// Les littéraux du code minifié, sans l'exécuter : chaînes entre guillemets (deb/fin : le contenu,
// guillemets exclus) et morceaux de texte des gabarits (entre ` ou } et ${ ou `, tpl : numéro du
// gabarit). Expressions régulières et commentaires sont sautés. Sert à savoir si un texte à
// traduire est une chaîne entière ou un morceau de gabarit, donc comment le rendre conditionnel.
// Une incohérence (chaîne non fermée…) arrête le patch : le jeu d'origine reste en place.
function segmentsLitteraux(s) {
  const segs = [], pile = [];
  const n = s.length;
  let i = 0, prec = "", nTpl = 0;
  const AVANT_REGEX = "(,=:[!&|?{};+-*%<>~^";
  const MOTS = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;
  const texte = (debut, tpl) => {
    for (let j = debut; ; j++) {
      if (j >= n) die("lexique du bundle : gabarit non fermé (" + debut + ")");
      const c = s.charCodeAt(j);
      if (c === 92) { j++; continue; }
      if (c === 96) { segs.push({ q: "`", deb: debut, fin: j, tpl }); return j + 1; }
      if (c === 36 && s.charCodeAt(j + 1) === 123) { segs.push({ q: "`", deb: debut, fin: j, tpl }); pile.push({ acc: 0, tpl }); return j + 2; }
    }
  };
  while (i < n) {
    const c = s[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      for (; s[j] !== c; j++) {
        if (j >= n || s[j] === "\n") die("lexique du bundle : chaîne non fermée (" + i + ")");
        if (s[j] === "\\") j++;
      }
      segs.push({ q: c, deb: i + 1, fin: j });
      i = j + 1; prec = "a"; continue;
    }
    if (c === "`") { i = texte(i + 1, ++nTpl); prec = "a"; continue; }
    if (c === "{") { if (pile.length) pile[pile.length - 1].acc++; prec = c; i++; continue; }
    if (c === "}") {
      const h = pile[pile.length - 1];
      if (h && h.acc === 0) { pile.pop(); i = texte(i + 1, h.tpl); prec = "a"; continue; }
      if (h) h.acc--;
      prec = c; i++; continue;
    }
    if (c === "/") {
      if (s[i + 1] === "/") { const k = s.indexOf("\n", i); i = k < 0 ? n : k; continue; }
      if (s[i + 1] === "*") { const k = s.indexOf("*/", i + 2); if (k < 0) die("lexique du bundle : commentaire non fermé"); i = k + 2; continue; }
      if (prec === "" || AVANT_REGEX.includes(prec) || (prec === "w" && MOTS.test(s.slice(Math.max(0, i - 12), i)))) {
        let j = i + 1, classe = false;
        for (; ; j++) {
          const d = s[j];
          if (j >= n || d === "\n") die("lexique du bundle : expression régulière non fermée (" + i + ")");
          if (d === "\\") j++;
          else if (d === "[") classe = true;
          else if (d === "]") classe = false;
          else if (d === "/" && !classe) break;
        }
        for (j++; /[a-z]/i.test(s[j] || ""); j++);
        i = j; prec = "a"; continue;
      }
      prec = "/"; i++; continue;
    }
    const k = s.charCodeAt(i);
    if (k === 32 || k === 10 || k === 13 || k === 9) { i++; continue; }
    prec = (k >= 48 && k <= 57) || (k >= 65 && k <= 90) || (k >= 97 && k <= 122) || k === 95 || k === 36 || k > 127 ? "w" : c;
    i++;
  }
  if (pile.length) die("lexique du bundle : interpolation ${…} non fermée");
  return segs;
}
// Envoi d'un SMS au contact du personnel (H. Whitmore) : historique des messages, puis appel au
// modèle (genre, question, prompt, historique). Même fonction d'appel que l'interrogatoire.
function ancreSms(s) {
  const m = s.match(/\.resolveMessage\(([\w$]+)\)\}\)\),([\w$]+)=([\w$]+)\(([\w$]+),([\w$]+),([\w$]+),([\w$]+)\);/);
  if (!m || s.split(m[0]).length !== 2) return null;
  return { appel: m, genre: m[4], systeme: m[6],
    remplacer: (expr) => ".resolveMessage(" + m[1] + ")})),"+ m[2] + "=" + m[3] + "(" + m[4] + "," + m[5] + "," + expr + "," + m[7] + ");" };
}

// Textes français livrés « en ligne » dans les données d'affaires (fil des transmissions du
// commissariat, precinctChatter[].text.fr) et météo du bureau (weather.desc, anglais seulement).
// chatter_fr.json : { "case-001": [texte FR de chaque entrée, dans l'ordre] }.
// weather_fr.json : { "texte anglais": "texte français" }, devient un accesseur lu à l'affichage.
function patchInlineFrench(s, L) {
  // Fil des transmissions du commissariat. Les affaires traduites par le studio ont une valeur
  // française à remplacer, les affaires neuves n'ont aucune clé fr : on l'insère alors après en:.
  const chatter = lire("chatter_fr.json");
  let done = 0, skipped = [];
  for (const [caseId, texts] of Object.entries(chatter)) {
    const caseAt = s.indexOf('id:"' + caseId + '"');
    const arrAt = caseAt < 0 ? -1 : s.indexOf("precinctChatter:[", caseAt);
    const nextCase = s.indexOf('id:"case-', caseAt + 1);
    if (arrAt < 0 || (nextCase > 0 && arrAt > nextCase)) { skipped.push(caseId + " (tableau introuvable)"); continue; }
    // Délimiter le tableau, puis repérer CHAQUE objet text:{...} et n'agir qu'à l'intérieur de
    // celui-ci. L'ancienne version cherchait le prochain « fr: » sans borne : comme les entrées
    // du studio portent leur fr APRÈS leur en, chaque message recevait la traduction du suivant.
    let prof = 0, deb = s.indexOf("[", arrAt), finTab = deb;
    for (; finTab < s.length; finTab++) {
      const c = s[finTab];
      if (c === "[") prof++;
      else if (c === "]") { prof--; if (prof === 0) break; }
    }
    const objets = [];
    let p = deb;
    while ((p = s.indexOf("text:{", p)) >= 0 && p < finTab) {
      const o = s.indexOf("{", p);
      let d2 = 0, f2 = o;
      for (; f2 < finTab; f2++) {
        const c = s[f2];
        if (c === "\\") { f2++; continue; }
        if (c === "{") d2++;
        else if (c === "}") { d2--; if (d2 === 0) break; }
      }
      objets.push([o, f2]);
      p = f2;
    }
    // On écrit de la fin vers le début pour que les index restent valides.
    let ok = 0;
    for (let i = Math.min(objets.length, texts.length) - 1; i >= 0; i--) {
      // texte repris du studio et introuvable dans ce jeu : on garde le message du studio
      if (estAncre(texts[i])) continue;
      const [o, f2] = objets[i];
      const obj = s.slice(o, f2 + 1);
      const m = obj.match(/fr:(["'`])/);
      if (m) {
        const q = m[1];
        let j = m.index + 4;
        while (j < obj.length) { if (obj[j] === "\\") { j += 2; continue; } if (obj[j] === q) break; j++; }
        const neufObj = obj.slice(0, m.index) + "fr:" + JSON.stringify(texts[i]) + obj.slice(j + 1);
        s = s.slice(0, o) + neufObj + s.slice(f2 + 1);
      } else {
        const neufObj = "{fr:" + JSON.stringify(texts[i]) + "," + obj.slice(1);
        s = s.slice(0, o) + neufObj + s.slice(f2 + 1);
      }
      ok++;
    }
    done += ok;
    if (ok !== texts.length) skipped.push(caseId + " (" + ok + "/" + texts.length + ")");
  }
  log("fil du commissariat : " + done + " entrées en français" + (skipped.length ? " | ATTENTION : " + skipped.join(", ") : ""));

  const weather = lire("weather_fr.json");
  let w = 0;
  for (const [en, fr] of Object.entries(weather)) {
    const from = "desc:" + JSON.stringify(en) + "}";
    if (!s.includes(from)) { log("info : météo absente : « " + en + " »"); continue; }
    s = s.split(from).join('get desc(){return ' + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "}}");
    w++;
  }
  log("météo du bureau : " + w + " descriptions en français");

  // Textes multilingues livrés EN LIGNE dans le bundle (chefs d'inculpation, compteurs de
  // l'interface), que ni le dictionnaire ni les surcouches d'affaires n'atteignent. On remplace
  // la valeur française en place, clé « texte actuel » vers « texte voulu ».
  const charges = lire("inline_fr.json");
  let ch = 0, chMiss = [];
  for (const [avant, apres] of Object.entries(charges)) {
    const from = "fr:" + JSON.stringify(avant);
    const n = s.split(from).length - 1;
    if (!n) { chMiss.push(avant.slice(0, 34)); continue; }
    s = s.split(from).join("fr:" + JSON.stringify(apres));
    ch += n;
  }
  // ── [langue] Textes envoyés au modèle : français pour les joueurs français, texte du studio pour
  //    tous les autres (décision de l'auteur du 26/09/2026, audit M2). Rien n'est plus remplacé en
  //    dur dans ce qui part au modèle : chaque texte devient un choix fait à l'usage, selon la
  //    langue du moment, comme promptAnglais. Hors français, le moteur reçoit au caractère près ce
  //    qu'envoie le jeu d'origine (scratch/test_langue.js, 52 interrogatoires rejoués contre lui).
  //    Le lexique du bundle (segmentsLitteraux) dit si un texte est une chaîne entière ou un morceau
  //    de gabarit. Sinon, rien de sûr : le texte reste celui du studio (ATTENTION).
  const segs = segmentsLitteraux(s);
  const finsGabarit = new Set(segs.filter((g) => g.q === "`").map((g) => g.fin));
  const segmentDe = (deb, fin) => {
    let a = 0, b = segs.length - 1, r = -1;
    while (a <= b) { const m = (a + b) >> 1; if (segs[m].deb <= deb) { r = m; a = m + 1; } else b = m - 1; }
    for (let k = r; k >= 0 && k > r - 50; k--) if (segs[k].deb <= deb && fin <= segs[k].fin) return segs[k];
    return null;
  };
  const siFr = (fr, autre) => "(" + L + '==="fr"?' + fr + ":" + autre + ")";
  const modifs = []; // { deb, fin, par } sur le texte courant, appliquées en une fois à la fin
  // SMS de H. Whitmore : leur prompt est une constante évaluée au chargement du module, avant que
  // la langue soit connue. Le choix se fait donc à l'appel, où le français reçoit sa propre copie.
  const sms = ancreSms(s);
  let smsGabarit = null;
  const smsFr = [];
  if (sms) {
    const decl = [...s.matchAll(new RegExp("[,;]" + sms.systeme.replace(/\$/g, "\\$") + "=`", "g"))];
    const d = decl.length === 1 ? decl[0].index + decl[0][0].length : -1;
    const g0 = d < 0 ? null : segmentDe(d, d);
    if (g0 && g0.q === "`" && g0.deb === d) {
      const bouts = segs.filter((g) => g.tpl === g0.tpl);
      smsGabarit = { tpl: g0.tpl, deb: d - 1, fin: bouts[bouts.length - 1].fin + 1 };
    }
  }
  if (!smsGabarit) log("ATTENTION : SMS de H. Whitmore introuvables, ils restent en anglais en français");

  // Chaînes françaises écrites en dur hors dictionnaire (fiches de l'Atlas, tables internes) et
  // règles du prompt des suspects (litteraux_fr.json), personnalités (prompts_fr.json). Les
  // personnalités ne sont pas atteignables par les surcouches d'affaires : la fusion du jeu n'y
  // prend que la première phrase et les questions.
  const litt = lire("litteraux_fr.json");
  const fiches = fs.existsSync(path.join(HERE, "prompts_fr.json")) ? lire("prompts_fr.json") : {};
  let li = 0;
  const liMiss = [];
  // le bundle cite ses chaînes tantôt en guillemets doubles, tantôt en apostrophes simples,
  // tantôt en accents graves : on essaie les trois formes avec l'échappement propre à chacune.
  const formes = (t) => {
    const BS = String.fromCharCode(92); // antislash
    const ech = t.split(BS).join(BS + BS);
    const dbl = JSON.stringify(t);
    const smp = "'" + ech.split("'").join(BS + "'").split("\n").join(BS + "n") + "'";
    const bak = "`" + ech.split("`").join(BS + "`").split("${").join(BS + "${") + "`";
    return [dbl, smp, bak];
  };
  // Occurrences d'un texte en chaîne ENTIÈRE du code (jamais un morceau d'une autre chaîne).
  const entieres = (texte) => {
    const out = [];
    formes(texte).forEach((f, k) => {
      for (let p = s.indexOf(f); p >= 0; p = s.indexOf(f, p + 1)) {
        const g = segmentDe(p + 1, p + f.length - 1);
        if (g && g.deb === p + 1 && g.fin === p + f.length - 1 && g.q === f[0]) out.push({ p, k, n: f.length });
      }
    });
    return out;
  };
  // Constante du studio (« const X="…" ») lue par des gabarits (${X}) : chaque lecture choisit.
  const constantesFr = new Map(); // nom -> forme française, pour la copie française des SMS
  for (const [avant, apres] of Object.entries(litt)) {
    const occ = entieres(avant);
    if (!occ.length) { liMiss.push(avant.slice(0, 34)); continue; }
    for (const { p, k, n } of occ) {
      const decl = s.slice(Math.max(0, p - 64), p).match(/(?:^|[^\w$.])([A-Za-z_$][\w$]*)=$/);
      if (!decl) {
        // valeur d'un objet du jeu : ce sont des chaînes FRANÇAISES du studio (Atlas, terminal),
        // affichées en français seulement, remplacées telles quelles
        modifs.push({ deb: p, fin: p + n, par: formes(apres)[k] });
        li++;
        continue;
      }
      const X = decl[1], lecture = "${" + X + "}";
      let lu = 0;
      for (let r = s.indexOf(lecture); r >= 0; r = s.indexOf(lecture, r + 1)) {
        if (!finsGabarit.has(r)) continue;
        if (smsGabarit && r > smsGabarit.deb && r < smsGabarit.fin) continue; // copie française des SMS
        modifs.push({ deb: r, fin: r + lecture.length, par: "${" + siFr(formes(apres)[k], X) + "}" });
        lu++;
      }
      constantesFr.set(X, formes(apres)[k]);
      if (!lu) liMiss.push(avant.slice(0, 28) + " (aucune lecture ${…})");
      li += lu;
    }
  }
  // Personnalités : le calcul du prompt du suspect lit systemPrompt à UN endroit, où la table
  // française prend le relais en français. Le texte de l'affaire reste celui du studio.
  const tableFiches = [];
  for (const [avant, voulu] of Object.entries(fiches)) {
    // Sans filtre (jeu modifié), un marqueur [[SI:…]] ne doit jamais atteindre le modèle.
    const apres = HDFR_SI_FILTRE ? voulu : voulu.replace(/\[\[SI:[^\]]+\]\]|\[\[\/SI\]\]/g, "");
    if (!entieres(avant).length) { liMiss.push(avant.slice(0, 34)); continue; }
    tableFiches.push([avant, apres]);
  }
  const mFiche = s.match(/(\w+)=(\w+\.value\?\(\((\w+)=\w+\.value\)==null\?void 0:\3\.systemPrompt\)\?\?"":\(\((\w+)=\w+\.value\)==null\?void 0:\4\.systemPrompt\)\?\?"")/);
  if (!mFiche) die("lecture de la personnalité du suspect introuvable (fiches françaises)");
  modifs.push({ deb: mFiche.index, fin: mFiche.index + mFiche[0].length,
    par: mFiche[1] + "=(hdfrX=>" + L + '==="fr"&&hdfrFiches.get(hdfrX)||hdfrX)(' + mFiche[2] + ")" });
  li += tableFiches.length;

  // Fragments de texte anglais fabriqués par le code (en-têtes de blocs du prompt, humeurs,
  // greffier, SMS). Chacun a été vérifié unique dans le bundle.
  const frag = lire("fragments_fr.json");
  let fr2 = 0;
  const fragMiss = [];
  // un morceau de gabarit recopié dans un gabarit imbriqué : ni accent grave, ni ${, ni antislash final
  const texteSur = (t) => !t.includes("`") && !t.includes("${") && !/(^|[^\\])(\\\\)*\\$/.test(t);
  for (const [avant, apres] of Object.entries(frag)) {
    const n = s.split(avant).length - 1;
    if (!n) { fragMiss.push(avant.slice(0, 34)); continue; }
    if (n > 1) { fragMiss.push(avant.slice(0, 28) + " (" + n + " occurrences, ignoré)"); continue; }
    const p = s.indexOf(avant), g = segmentDe(p, p + avant.length);
    if (!g) { fragMiss.push(avant.slice(0, 28) + " (hors d'une chaîne, ignoré)"); continue; }
    if (g.q !== "`") {
      if (g.deb !== p || g.fin !== p + avant.length) { fragMiss.push(avant.slice(0, 28) + " (morceau de chaîne, ignoré)"); continue; }
      const q = g.q, cle = s.slice(Math.max(0, p - 65), p - 1).match(/[{,]([A-Za-z_$][\w$]*):$/);
      // valeur d'un objet (humeurs) : un accesseur, lu à chaque prompt
      if (cle) modifs.push({ deb: p - 1 - cle[1].length - 1, fin: p + avant.length + 1,
        par: "get " + cle[1] + "(){return " + siFr(q + apres + q, q + avant + q) + "}" });
      else modifs.push({ deb: p - 1, fin: p + avant.length + 1, par: siFr(q + apres + q, q + avant + q) });
    } else if (smsGabarit && g.tpl === smsGabarit.tpl) {
      smsFr.push({ deb: p, fin: p + avant.length, par: apres });
    } else {
      if (!texteSur(avant) || !texteSur(apres)) { fragMiss.push(avant.slice(0, 28) + " (texte non isolable, ignoré)"); continue; }
      modifs.push({ deb: p, fin: p + avant.length, par: "${" + siFr("`" + apres + "`", "`" + avant + "`") + "}" });
    }
    fr2++;
  }
  if (smsGabarit && smsFr.length) {
    // copie française du prompt des SMS : ses fragments, et ses lectures de constantes traduites
    for (const [X, fr] of constantesFr) {
      const lecture = "${" + X + "}";
      for (let r = s.indexOf(lecture, smsGabarit.deb); r >= 0 && r < smsGabarit.fin; r = s.indexOf(lecture, r + 1))
        if (finsGabarit.has(r)) smsFr.push({ deb: r, fin: r + lecture.length, par: "${" + fr + "}" });
    }
    let copie = s.slice(smsGabarit.deb, smsGabarit.fin);
    for (const m of smsFr.sort((a, b) => b.deb - a.deb))
      copie = copie.slice(0, m.deb - smsGabarit.deb) + m.par + copie.slice(m.fin - smsGabarit.deb);
    modifs.push({ deb: sms.appel.index, fin: sms.appel.index + sms.appel[0].length, par: sms.remplacer(siFr(copie, sms.systeme)) });
    log("code : SMS de H. Whitmore en français pour les joueurs français, texte du studio pour les autres");
  } else if (smsGabarit) log("ATTENTION : aucun fragment des SMS de H. Whitmore trouvé, ils restent en anglais en français");

  modifs.sort((a, b) => b.deb - a.deb);
  for (let k = 1; k < modifs.length; k++)
    if (modifs[k].fin > modifs[k - 1].deb) die("remplacements de textes du modèle qui se chevauchent (" + modifs[k].deb + ")");
  for (const m of modifs) s = s.slice(0, m.deb) + m.par + s.slice(m.fin);
  // Table des personnalités, en tête du module : construite une fois, lue à chaque prompt.
  s = "var hdfrFiches=new Map(" + JSON.stringify(tableFiches) + ");\n" + s;
  log("fragments du prompt : " + fr2 + " en français" + (fragMiss.length ? " | ATTENTION : " + fragMiss.join(", ") : ""));

  log("chaînes littérales : " + li + " remplacée(s)" + (liMiss.length ? " | ATTENTION : " + liMiss.join(", ") : ""));

  log("textes multilingues en ligne : " + ch + " en français" + (chMiss.length ? " | ATTENTION : " + chMiss.join(", ") : ""));

  // Terminal de régulation (codes radio, lieux d'incidents, lignes d'affaire, conseils) : objets
  // {en,ar,zh} sans clé fr. On insère fr: juste après en:. POI de l'Atlas et statut des unités :
  // chaînes anglaises seules, remplacées par des accesseurs lus à l'affichage.
  const cad = lire("cad_fr.json");
  let c = 0, cMiss = [];
  for (const [en, fr] of Object.entries(cad.multilingual)) {
    // le bundle cite en double quotes, ou en simples quotes quand le texte contient des guillemets
    const forms = ["{en:" + JSON.stringify(en), "{en:'" + en + "'"];
    const from = forms.find(f => s.split(f).length - 1 === 1);
    if (!from) { cMiss.push(en.slice(0, 30)); continue; }
    s = s.replace(from, () => "{fr:" + JSON.stringify(fr) + "," + from.slice(1));
    c++;
  }
  log("terminal de régulation : " + c + " textes en français" + (cMiss.length ? " | ATTENTION : " + cMiss.join(", ") : ""));
  const mPoi = s.match(/(\w+)=\[\{id:"poi-hq"/);
  const giStart = mPoi ? mPoi.index : -1;
  const giEnd = giStart < 0 ? -1 : s.indexOf("];", giStart);
  let p = 0;
  if (giStart > 0) {
    let gi = s.slice(giStart, giEnd);
    for (const [en, fr] of Object.entries(cad.poi)) {
      const from = "label:" + JSON.stringify(en) + ",";
      if (!gi.includes(from)) continue;
      gi = gi.replace(from, () => 'get label(){return ' + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "},");
      p++;
    }
    s = s.slice(0, giStart) + gi + s.slice(giEnd);
  }
  log("Atlas : " + p + " lieux en français");
  // Statut des unités du tableau des services : trois libellés anglais tirés d'un tableau, choisis
  // par une fonction de hachage. On enveloppe le résultat plutôt que de traduire le tableau, qui
  // sert aussi de source à la répartition.
  const mGu = s.match(/function (\w+)\(e,a,t\)\{const i=Math\.floor\(a\/6e5\);return (\w+)\[Math\.floor\((\w+)\(e,i,t\+100\)\*\2\.length\)\]\}/);
  if (mGu) {
    s = s.replace(mGu[0], () => "function " + mGu[1] + "(e,a,t){const i=Math.floor(a/6e5);const v=" + mGu[2] +
      "[Math.floor(" + mGu[3] + "(e,i,t+100)*" + mGu[2] + ".length)];return " + L + '==="fr"?(' +
      JSON.stringify(cad.unitStatus) + "[v]||v):v}");
    log("code : statuts des unités du tableau des services en français");
  } else log("info : fonction des statuts d'unité introuvable, correctif ignoré");
  return s;
}

// ---------------------------------------------------------------------------
// Textes visibles restés en anglais et typographie française (audit du 26/09/2026, M7 et mineurs)
// ---------------------------------------------------------------------------
// Les trois fonctions hdfr…Fr ci-dessous s'exécutent DANS LE JEU : patchTextesVisibles les recopie
// telles quelles en tête du bundle (Function.toString). Elles ne dépendent que de leurs arguments et
// ne sont appelées qu'en français. scratch/glossaire/test_textes_fr.js les exécute sur le bundle patché.

// Typographie française d'un texte affiché : espace insécable (U+00A0) avant : ; ! ? $ %, à
// l'intérieur des guillemets et après N°, montant avant le $, apostrophe typographique. U+00A0 et
// non l'espace fine U+202F : les polices du jeu (IBM Plex Mono, Inter) n'ont pas U+202F, que
// Chromium prendrait dans une autre police, plus large, et les colonnes des documents en
// monospace se décaleraient. Les milliers de toLocaleString("fr-FR") (U+202F) sont ramenés à
// U+00A0. Posée sur toDisplayString de Vue, elle ne change que l'écran : ni l'historique
// sauvegardé ni ce qui part au modèle.
function hdfrTypoFr(t) {
  const F = "\u00a0";
  return t
    .replace(/\u202f/g, F)
    .replace(/'/g, "\u2019")
    .replace(/([+\u2212-]?)\$(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g,
      (m, signe, n, dec) => signe + n.replace(/,/g, F) + (dec ? "," + dec : "") + F + "$")
    .replace(/(\d)[ \u00a0](?=\d{3}(?:[ \u00a0\u202f]\d{3})*[ \u00a0\u202f][$%])/g, "$1" + F)
    .replace(/(\d)[ \u00a0]([$%])/g, "$1" + F + "$2")
    .replace(/[ \u00a0\u202f]+([:;!?\u00bb])/g, F + "$1")
    .replace(/([\p{L}\p{N})\]\u2019"\u201d\u2026\u00bb])([;!?])(?=[\s;!?)\]"\u201d\u00bb]|$)/gu, "$1" + F + "$2")
    .replace(/([\p{L})\]\u2019"\u201d])(:)(?=\s)/gu, "$1" + F + "$2")
    .replace(/\u00ab[ \u00a0\u202f]*/g, "\u00ab" + F)
    .replace(/(\S)\u00bb/g, "$1" + F + "\u00bb")
    .replace(/([Nn]\u00b0)[ \u00a0\u202f]*(?=[\d{])/g, "$1" + F);
}

// Libellé du relevé des transactions. Le jeu enregistre le texte anglais dans la sauvegarde : on le
// traduit à l'affichage. T : cad_fr.json « transactions » (clé finissant par « : » = préfixe suivi
// d'un nom), prime(nom) : nom d'une prime traduit par le dictionnaire du jeu.
function hdfrTxFr(t, T, prime) {
  if (typeof t !== "string") return t;
  if (Object.prototype.hasOwnProperty.call(T, t)) return T[t];
  for (const p of Object.keys(T)) if (p.endsWith(": ") && t.startsWith(p)) return T[p] + prime(t.slice(p.length));
  return t;
}

// Fiches RPD-NET générées par le jeu (adresses, personnes, véhicules, dossiers) : copie traduite.
// T : cad_fr.json « rpdnet » (« m|f » = forme masculine|féminine), M : modèles de véhicules
// (« nom|genre »), G : prénoms féminins. Les identifiants et les renvois entre fiches ne changent
// pas, les mots-clés anglais restent pour la recherche.
function hdfrNetFr(liste, T, M, G) {
  const a = (x) => Object.prototype.hasOwnProperty.call(T, x) ? T[x] : x;
  const accord = (x, fem) => { const p = String(x).split("|"); return p[fem && p.length > 1 ? 1 : 0]; };
  const adresse = (x) => String(x).replace(/^Flat (\d+), /, "Appt $1, ");
  const vehicule = (x) => {
    const w = String(x).split(" ");
    if (w.length < 3 || !M[w[w.length - 1]]) return x;
    const [nom, genre] = M[w.pop()].split("|"), marque = w.pop();
    return nom[0].toUpperCase() + nom.slice(1) + " " + marque + " " + accord(a(w.join(" ")), genre === "f");
  };
  return liste.map((r) => {
    const fem = r.kind === "person" && G[String(r.title).split(" ")[0]] === "f";
    const o = { ...r, keywords: [...(r.keywords || [])] };
    const mot = (x) => { if (!o.keywords.includes(x)) o.keywords.push(x); };
    if (r.kind === "address") { o.title = adresse(r.title); if (o.title !== r.title) mot(r.title.toLowerCase()); }
    if (r.kind === "vehicle") { o.sub = vehicule(r.sub); mot(o.sub.toLowerCase()); }
    if (r.kind === "case") {
      const [inf, ...reste] = String(r.sub).split(" · ");
      o.sub = [a(inf), ...reste].join(" · ");
      mot(a(inf).toLowerCase());
    }
    if (r.kind === "person") {
      const m = String(r.sub).match(/^DOB (\S+) · (.+)$/);
      if (m) o.sub = (fem ? "Née le " : "Né le ") + m[1] + " · " + accord(a(m[2]), fem);
    }
    o.fields = (r.fields || []).map((f) => {
      let v = f.v;
      if (f.k === "ADDRESS" || f.k === "REGISTERED AT") v = adresse(v);
      else if (f.k === "VEHICLE") { const i = String(v).indexOf(" · "); if (i > 0) v = v.slice(0, i + 3) + vehicule(v.slice(i + 3)); }
      else if (f.k === "CASE") v = String(v).replace(/^(\S+) · (.+) \(([^()]+)\)$/, (x, n, inf, dec) => n + " · " + a(inf) + " (" + a(dec) + ")");
      else if (f.k === "OIC") v = String(v).replace(/^DC (.+) \(badge (\d+)\)$/, "Insp. $1, matricule $2");
      else v = accord(a(v), fem);
      if (f.k === "DISTINGUISHING MARKS") mot(String(v).split(",")[0]);
      return { ...f, k: a(f.k), v };
    });
    return o;
  });
}

function patchTextesVisibles(s, L) {
  const tables = lire("cad_fr.json");
  const faits = [], manques = [];
  // Remplacement ancré sur un motif du code, compte exact exigé (1 par défaut) : sinon rien ne
  // change et le correctif est signalé absent.
  function remplacer(nom, re, build, attendu = 1) {
    const n = (s.match(new RegExp(re.source, "g")) || []).length;
    if (n !== attendu) { manques.push(nom + " (" + n + "/" + attendu + ")"); return null; }
    const m = s.match(re);
    s = s.slice(0, m.index) + build(m) + s.slice(m.index + m[0].length);
    faits.push(nom);
    return m;
  }

  // Aides communes, en tête du bundle. hdfrFr() protège aussi les appels faits avant la déclaration
  // de la langue (toDisplayString sert dès le chargement).
  const aides = [hdfrTypoFr, hdfrTxFr, hdfrNetFr].map(String).join("\n") + "\n" +
    "var hdfrTC=new Map(),hdfrNC=new WeakMap(),hdfrTxT=" + JSON.stringify(tables.transactions || {}) +
    ",hdfrNetT=" + JSON.stringify(tables.rpdnet || {}) + ",hdfrNetM=" + JSON.stringify(tables.rpdnetModeles || {}) +
    ",hdfrNetG=" + JSON.stringify(tables.rpdnetPrenoms || {}) + ";\n" +
    "function hdfrFr(){try{return " + L + '==="fr"}catch(_){return!1}}\n' +
    "function hdfrTypo(e){if(!hdfrFr())return e;let r=hdfrTC.get(e);if(r===void 0){r=hdfrTypoFr(e);if(hdfrTC.size>4e3)hdfrTC.clear();hdfrTC.set(e,r)}return r}\n" +
    "function hdfrTx(t,R,LU){if(!hdfrFr())return t;return hdfrTxFr(t,hdfrTxT,x=>{const b=LU.find(o=>o.label===x);if(!b)return x;" +
    'const k="bounty."+b.id+".label",v=R(k);return v&&v!==k?v:x})}\n' +
    "function hdfrNet(l){if(!hdfrFr())return l;let r=hdfrNC.get(l);if(!r){r=hdfrNetFr(l,hdfrNetT,hdfrNetM,hdfrNetG);hdfrNC.set(l,r)}return r}\n";
  s = aides + s;

  // 1. Typographie à l'affichage : toDisplayString de Vue (« {{ }} » des gabarits).
  const mAff = remplacer("typographie française à l'affichage",
    /,(\w+)=e=>(\w+)\(e\)\?e:e==null\?"":/,
    (m) => "," + m[1] + "=e=>" + m[2] + "(e)?hdfrTypo(e):e==null?\"\":");
  const AFF = mAff ? mAff[1] : null;

  // 2. Relevé des transactions (Dossier personnel) : libellé traduit, montant « +50 $ ».
  const mT = s.match(/(\w+\(\w+\))\("cf\.txLedger"\)/);
  const mLu = s.match(/(\w+)=\[\{id:"evidence-5",label:/);
  if (mT && mLu)
    remplacer("relevé des transactions",
      /n\("span",(\w+),(\w+)\((\w+)\.reason\),1\),n\("span",(\{class:\w+\(\["tx-amt",\{debit:\3\.amount<0\}\]\)\}),\2\(\3\.amount<0\?"−":"\+"\)\+"\$"\+\2\(Math\.abs\(\3\.amount\)\),3\)/,
      (m) => {
        const [, cls, l, H, attr] = m;
        return "n(\"span\"," + cls + "," + l + "(hdfrTx(" + H + ".reason," + mT[1] + "," + mLu[1] + ")),1),n(\"span\"," + attr + "," +
          l + "(" + H + ".amount<0?\"−\":\"+\")+(" + L + '==="fr"?' + l + "(Math.abs(" + H + '.amount).toLocaleString("fr-FR"))+"\\u00a0$":"$"+' +
          l + "(Math.abs(" + H + ".amount))),3)";
      });
  else manques.push("relevé des transactions (ancres)");

  // 3. Montants composés à l'anglaise hors dictionnaire : « "$"+l(x) » et « "+$"+l(x) ».
  if (AFF) {
    let n = 0;
    for (const signe of ["", "+"]) {
      const debut = JSON.stringify(signe + "$") + "+" + AFF + "(";
      let i;
      while ((i = s.indexOf(debut)) >= 0) {
        let j = i + debut.length, d = 1;
        for (; j < s.length && d; j++) { if (s[j] === "(") d++; else if (s[j] === ")") d--; }
        const x = s.slice(i + debut.length, j - 1);
        s = s.slice(0, i) + "(" + L + '==="fr"?' + JSON.stringify(signe) + "+" + AFF + "(" + x + ')+"\\u00a0$":' +
          JSON.stringify(signe + "$") + "+\u0000" + AFF + "(" + x + "))" + s.slice(j);
        n++;
      }
    }
    s = s.split("+\u0000").join("+");
    if (n) faits.push("montants avec $ (" + n + ")"); else manques.push("montants avec $");
  }
  // Solde de la barre des tâches : « $ » dans une pastille, puis le nombre.
  remplacer("solde de la barre des tâches",
    /n\("span",\{class:"tb-sign"\},"\$",-1\)\),(\w+)\((\w+)\(([\w().]+)\.balance\.toLocaleString\(\)\),1\)/,
    (m) => 'n("span",{class:"tb-sign"},' + L + '==="fr"?"":"$",-1)),' + m[1] + "(" + m[2] + "(" + L + '==="fr"?' + m[3] +
      '.balance.toLocaleString("fr-FR")+"\\u00a0$":' + m[3] + ".balance.toLocaleString()),1)");

  // 4. Menu Démarrer : « 3 clues found · 5 files read ».
  remplacer("compteurs du menu Démarrer",
    /(\w+)\((\w+\(\w+\)\.discoveredClues\.length)\)\+" clue"\+\1\(\2!==1\?"s":""\)\+" found",1\),n\("span",null,\1\((\w+\(\w+\)\.openedFiles\.length)\)\+" file"\+\1\(\3!==1\?"s":""\)\+" read"/,
    (m) => {
      const [, l, c, f] = m;
      const fr = (x, mot, part) => l + "(" + x + ')+" ' + mot + '"+(' + x + '>1?"s":"")+" ' + part + '"+(' + x + '>1?"s":"")';
      return "(" + L + '==="fr"?' + fr(c, "indice", "trouvé") + ":" + m[0].slice(0, m[0].indexOf('" found"') + 8) + "),1),n(\"span\",null,(" +
        L + '==="fr"?' + fr(f, "document", "lu") + ":" + m[0].slice(m[0].indexOf(l + "(" + f + ")")) + ")";
    });

  // 5. Capture du tableau d'enquête (image jointe au courriel de clôture) : bandeau et cartouche.
  remplacer("capture du tableau : bandeau de la victime",
    /(\w+)\.fillText\("D E C E A S E D",/,
    (m) => m[1] + ".fillText(" + L + '==="fr"?"D É C È S":"D E C E A S E D",');
  remplacer("capture du tableau : cartouche",
    /`CASE #\$\{(\((\w+)\.activeCaseId\?\?""\)\.replace\(\/\\D\/g,""\)\|\|"-")\} · CLOSED`/,
    (m) => "(" + L + '==="fr"?`AFFAIRE N°\\u00a0${' + m[1] + "} · CLASSÉE`:" + m[0] + ")");

  // 6. Couleurs de fil (infobulles de la boutique et du tableau).
  const mFil = s.match(/(\w+)=\[\{hex:"#c0392b",tack:"#e74c3c",name:/);
  if (mFil) {
    const fin = s.indexOf("}]", mFil.index);
    let tab = s.slice(mFil.index, fin + 2), k = 0;
    for (const [en, fr] of Object.entries(tables.fil || {})) {
      const de = "name:" + JSON.stringify(en) + "}";
      if (!tab.includes(de)) continue;
      tab = tab.replace(de, "get name(){return " + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "}}");
      k++;
    }
    s = s.slice(0, mFil.index) + tab + s.slice(fin + 2);
    (k ? faits : manques).push("couleurs de fil (" + k + ")");
  } else manques.push("couleurs de fil");

  // 7. Durées composées à l'anglaise (« 2h 5m » : temps de l'affaire en cours, arrosage de la plante).
  {
    const re = /`\$\{(\w+)\}h \$\{(\w+)\}m`:`\$\{\2\}m`/g;
    const n = (s.match(re) || []).length;
    s = s.replace(re, (m, h, mn) => "(" + L + '==="fr"?`${' + h + "}\\u00a0h\\u00a0${" + mn + "}\\u00a0min`:" + m.split(":`")[0] + "):(" +
      L + '==="fr"?`${' + mn + "}\\u00a0min`:`${" + mn + "}m`)");
    (n ? faits : manques).push("durées h et min (" + n + ")");
  }

  // 8. Fiches RPD-NET générées : la liste passe par hdfrNet (copie traduite, gardée par liste).
  remplacer("fiches RPD-NET générées",
    /(for\(const \w+ of\[\.\.\.\w+\.value,\.\.\.\w+\.value,\.\.\.)(\w+)\(\)\]\)/,
    (m) => m[1] + "hdfrNet(" + m[2] + "())])");

  log("textes visibles en français : " + faits.join(", ") + (manques.length ? " | ATTENTION, non trouvés : " + manques.join(", ") : ""));
  return s;
}

// Courriel « affaire classée » (fonction uc du bundle) : le chef d'accusation n'était résolu qu'en
// anglais, arabe ou chinois, et le récapitulatif était composé à l'anglaise (« AFFAIRE: », « 30m »,
// « +$50 »). Les remplacements sont limités au corps de cette fonction.
function patchCaseClosedMail(s, L) {
  // Le courriel « affaire classée » ne résout le chef d'accusation qu'en arabe et en chinois, et
  // compose son récapitulatif à l'anglaise. Ancrage sur les motifs, jamais sur les noms minifiés.
  const mCharge = s.match(/(\w+)=(\w+)\.charge\?\w+\(\)\?\2\.charge\.ar:\w+\(\)\?\2\.charge\.zh:\2\.charge\.en:""/);
  if (!mCharge) { log("info : courriel d'affaire classée introuvable dans cette version, correctif ignoré"); return s; }
  let start = s.lastIndexOf("function ", mCharge.index);
  let stop = s.indexOf("pendingResults=null}", mCharge.index);
  if (start < 0 || stop < 0) { log("info : bornes du courriel d'affaire classée introuvables, correctif ignoré"); return s; }
  stop += "pendingResults=null}".length;
  let f = s.slice(start, stop);
  const before = f;

  f = f.replace(/(\w+)=(\w+)\.charge\?\w+\(\)\?\2\.charge\.ar:\w+\(\)\?\2\.charge\.zh:\2\.charge\.en:""/,
    (m, v, o) => v + "=" + o + ".charge?(" + o + ".charge[" + L + "]??" + o + '.charge.en):""');

  // Deux-points à la française dans les libellés du récapitulatif.
  const mDiff = f.match(/(\w+)=r\("difficulty\."\+\(\w+\[\w+\.difficulty\?\?0\]\?\?"Unknown"\)\),/);
  if (mDiff) f = f.replace(mDiff[0], () => mDiff[0] + "hdfrS=" + L + '==="fr"?" : ":": ",');

  // Unités et montants : « 30 min », « 100 % », « +50 $ ».
  f = f.replace(/\$\{(\w+)\.timeMinutes\}m/, (m, b) => "${" + b + ".timeMinutes}${" + L + '==="fr"?" min":"m"}');
  f = f.replace(/\$\{(\w+)\.evidencePct\}%/, (m, b) => "${" + b + ".evidencePct}${" + L + '==="fr"?" %":"%"}');
  f = f.replace(/\+\$\$\{(\w+)\.reward\.toLocaleString\(\)\}/, (m, b) =>
    "${" + L + '==="fr"?"+"+' + b + '.reward.toLocaleString("fr-FR")+" $":"+$"+' + b + ".reward.toLocaleString()}");
  f = f.replace(/\+\$\$\{(\w+)\.streakBonus\}/, (m, b) =>
    "${" + L + '==="fr"?"+"+' + b + '.streakBonus+" $":"+$"+' + b + ".streakBonus}");

  // Les deux-points des libellés, une fois les montants recomposés.
  f = f.split('")}: ${').join('")}${hdfrS}${');
  f = f.split('})}: ${').join('})}${hdfrS}${');

  const faits = ["charge[" + L + "]", "hdfrS=", '" min"', '" %"', 'toLocaleString("fr-FR")', ".streakBonus+"].filter(t => f.includes(t)).length;
  const restants = (f.match(/\}: \$\{/g) || []).length;
  if (f === before || faits < 6 || restants) log("ATTENTION : courriel d'affaire classée partiellement patché (" + faits + "/6, deux-points restants : " + restants + ")");
  else log("code : courriel d'affaire classée, chef d'accusation en français et typographie française");
  return s.slice(0, start) + f + s.slice(stop);
}
// Noms déclarés par une instruction « const a=…,b=… » minifiée (préchauffage du greffier) : virgules
// de premier niveau, hors parenthèses, crochets, accolades, chaînes et gabarits (${…} compris).
// null si l'instruction n'a pas cette forme.
function declarateurs(code) {
  if (!code.startsWith("const ")) return null;
  const noms = [];
  let i = 6, debut = 6;
  const pile = []; // ouvrants en cours : ( [ { ou ` (gabarit), « $ » pour un ${ dans un gabarit
  const fin = () => { const m = code.slice(debut, i).match(/^\s*([A-Za-z_$][\w$]*)=/); if (!m) throw new Error("déclarateur"); noms.push(m[1]); };
  try {
    for (; i < code.length; i++) {
      const c = code[i], haut = pile[pile.length - 1];
      if (haut === "`") {
        if (c === "\\") i++;
        else if (c === "`") pile.pop();
        else if (c === "$" && code[i + 1] === "{") { pile.push("$"); i++; }
        continue;
      }
      if (c === '"' || c === "'") { for (i++; i < code.length && code[i] !== c; i++) if (code[i] === "\\") i++; continue; }
      if (c === "`") pile.push("`");
      else if (c === "(" || c === "[" || c === "{") pile.push(c);
      else if (c === ")" || c === "]") pile.pop();
      else if (c === "}") pile.pop(); // ferme { ou ${
      else if (c === "," && !pile.length) { fin(); debut = i + 1; }
    }
    if (pile.length) return null;
    fin();
  } catch (e) { return null; }
  return noms;
}
function grabDict(s, anchor) {
  const i = s.indexOf(anchor);
  if (i < 0) die("ancre introuvable : " + anchor);
  let pos = i, depth = 0;
  while (pos > 0) { const c = s[pos]; if (c === "}") depth++; else if (c === "{") { if (depth === 0) break; depth--; } pos--; }
  let pos2 = i; depth = 0;
  while (pos2 < s.length) { const c = s[pos2]; if (c === "{") depth++; else if (c === "}") { if (depth === 0) break; depth--; } pos2++; }
  return new Function("return (" + s.slice(pos, pos2 + 1) + ")")();
}

// ---------------------------------------------------------------------------
// 3 : processus principal (choix du modèle + iGPU)
// ---------------------------------------------------------------------------
function patchLocalAI() {
  const file = path.join(EXTRACT, "desktop", "dist", "localAI.js");
  let s = fs.readFileSync(file, "utf8");
  if (s.startsWith(MARKER)) die("localAI.js déjà patché dans l'extraction");

  const anchorConst = "const SMART_MIN_VRAM_MB = 10000;";
  if (!s.includes(anchorConst)) die("ancre SMART_MIN_VRAM_MB introuvable");
  s = s.replace(anchorConst, () => anchorConst + `
// ── [HomicideDeskFR] override par fichier de configuration ─────────────────
//   <userData>\\localai-override.json : {"model": "homicide-gemma12b", "igpu": true}
//   model : nom d'un modèle présent dans resources\\ollama-models (ex. homicide-gemma12b, gemma3:4b)
//           Fichier absent ou sans « model » : choix automatique du jeu, inchangé.
//   igpu  : true pour activer la puce graphique intégrée (Vulkan). Par défaut : désactivée.
function hdfrOverride() {
    try {
        const p = path_1.default.join(electron_1.app.getPath('userData'), 'localai-override.json');
        const v = fs_1.default.existsSync(p) ? JSON.parse(fs_1.default.readFileSync(p, 'utf8')) || {} : {};
        hdfrOverrideVu = '';
        return v;
    }
    catch (err) {
        // [langue] lu à chaque question : la même erreur n'est journalisée qu'une fois (audit)
        const vu = String(err && err.message || err);
        if (vu !== hdfrOverrideVu) console.error('[localAI] localai-override.json illisible :', err);
        hdfrOverrideVu = vu;
        return {};
    }
}
let hdfrOverrideVu = '';
function hdfrModelExists(modelsDir, name) {
    const [repo, tag] = String(name).split(':');
    return fs_1.default.existsSync(path_1.default.join(modelsDir, 'manifests', 'registry.ollama.ai', 'library', repo, tag || 'latest'));
}
// [HomicideDeskFR] cache de préfixe de Gemma 3 en français (sonde du 26/09/2026,
// scratch/vo/sonde_cache.py). Gemma 3 lit 29 couches sur 34 par une fenêtre glissante de 1 024
// jetons : par défaut llama-server n'en garde que la fin et, dès que le prompt diverge avant la fin
// du cache (réplique raccourcie par l'arrêt anticipé et ge(), changement de suspect), il copie un
// point de sauvegarde de 116 Mo (2 à 3 s sur la puce intégrée) ou relit tout (10 à 15 s).
//  - LLAMA_ARG_SWA_FULL : cache complet (+576 Mo), reprise possible à n'importe quel jeton. Il
//    supprime aussi les points de sauvegarde (server-context.cpp:1151), inutile d'ajouter
//    CTX_CHECKPOINTS=0, qui seul fait relire tout le prompt au retour sur un suspect. Le masque de
//    fenêtre de 1 024 jetons reste appliqué : aucun jeton changé en décodage glouton (80/80).
//  - LLAMA_ARG_CACHE_RAM 2048 : plafond des prompts gardés en mémoire (8 192 Mo par défaut), sans
//    effet sur le calcul.
// Mesures du 26/09 : relecture 2,9 → 0,5 s au tour suivant, 2,3 → 0,09 s au retour, écriture +3 %.
// Ollama ne pose pas ces options en ligne de commande, llama-server les lit dans l'environnement.
// Gemma 4B en français seulement, {"cache": false} dans localai-override.json les retire.
const HDFR_ENV_CACHE = { LLAMA_ARG_SWA_FULL: '1', LLAMA_ARG_CACHE_RAM: '2048' };
// [langue] Modèle choisi pour une session française (audit D2, 26/09/2026) : dossier du magasin si
// Gemma 4B a été pris parce que la DERNIÈRE session était française. La première question dans une
// autre langue rend alors au studio son propre choix (Qwen 4B ou Gemma 12B), pour tout le reste du
// lancement : hors français, le jeu doit se comporter comme l'original. Seules les variables de
// cache de hdfrEnvMoteur restent, posées au démarrage du moteur, sans effet sur un modèle sans
// fenêtre glissante (Qwen). hdfrSansFr : pickModel sans la règle française.
let hdfrModeleFr = '', hdfrSansFr = false;
function hdfrEnvMoteur(model) {
    if (model !== 'homicide-gemma4b' || hdfrLireCtx().lang !== 'fr' || hdfrOverride().cache === false) return {};
    return HDFR_ENV_CACHE;
}`);

  const anchorPick = "async function pickModel(modelsDir) {";
  if (!s.includes(anchorPick)) die("ancre pickModel introuvable");
  s = s.replace(anchorPick, () => anchorPick + `
    const hdfr = hdfrOverride();
    if (hdfr.model) {
        if (hdfrModelExists(modelsDir, hdfr.model)) {
            console.log('[localAI] [HomicideDeskFR] modèle imposé par localai-override.json : ' + hdfr.model);
            return hdfr.model;
        }
        console.error('[localAI] [HomicideDeskFR] modèle demandé introuvable dans le magasin du jeu : ' + hdfr.model + ' (retour au choix automatique)');
    }
    // [HomicideDeskFR] session française (hdfr-contexte.json, écrit par l'installateur puis à la
    // première question en français de chaque session) : Gemma 3 4B, installé par outils/modele.js,
    // joue mieux les suspects en français que Qwen 3 4B. Une carte qui tient le Gemma 12B du studio le garde.
    if (!hdfrSansFr && hdfrLireCtx().lang === 'fr' && hdfrModelExists(modelsDir, 'homicide-gemma4b')) {
        const vramFr = await detectVramMB();
        if (!(vramFr >= SMART_MIN_VRAM_MB && bundledModelExists(modelsDir, MODEL_SMART))) {
            console.log('[localAI] [HomicideDeskFR] session française : homicide-gemma4b');
            hdfrModeleFr = modelsDir;
            return 'homicide-gemma4b';
        }
    }`);

  const anchorEnv = "OLLAMA_NUM_PARALLEL: '1',\n            },";
  if (!s.includes(anchorEnv)) die("ancre env OLLAMA_NUM_PARALLEL introuvable");
  s = s.replace(anchorEnv, () => `OLLAMA_NUM_PARALLEL: '1',
                // [HomicideDeskFR] puce graphique intégrée via Vulkan, sur demande explicite seulement
                ...(hdfrOverride().igpu === true ? { OLLAMA_IGPU_ENABLE: '1' } : {}),
                // [HomicideDeskFR] cache de préfixe de Gemma 3 en français (voir hdfrEnvMoteur)
                ...hdfrEnvMoteur(MODEL),
            },`);

  log("localAI.js : modèle et iGPU pilotables par un fichier facultatif");

  // Fenêtre de contexte du français (consensus de l'équipe du 24/09/2026,
  // scratch/equipe/debat_fenetre/CONSENSUS.md). Le français coûte environ 20 % de jetons de plus que
  // l'anglais à contenu égal : Adrian Cove (006), toutes pièces en main, pèse 4 169 jetons Qwen
  // contre 3 405 en VO, dans une fenêtre de 4 096. Au débordement, Qwen renvoie HTTP 400 et le jeu
  // se replie sur le serveur en ligne du studio, Gemma jette le milieu du prompt et oublie qui il est.
  // Le rendu signale la langue (opts.hdfrLang, voir patchBundle). En français seulement :
  //  - fenêtre 6 144 (5 120 si le modèle ne tient pas entier en mémoire graphique), passée par
  //    /api/chat, la seule route qui respecte num_ctx (mesuré : /v1 l'ignore) ;
  //  - la même fenêtre pour l'interrogatoire, le greffier et le préchargement (un changement de
  //    fenêtre recharge le modèle : 6 à 9 s, et 35 s pour la question suivante) ;
  //  - un filet qui retire les plus vieux échanges avant tout débordement, jamais le prompt
  //    système ni la question en cours.
  //  Toute autre langue suit le code du studio à l'identique.
  const anchorAsk = "async function ask(systemPrompt, messages, opts = {}) {\n    await ensureServer();";
  if (!s.includes(anchorAsk)) die("ancre ask() introuvable dans localAI.js");
  // Critère d'arrêt anticipé : une seule source, arret_fr.js (validée par scratch/vo/test_arret_anticipe.js).
  const arretFichier = fs.readFileSync(path.join(HERE, "arret_fr.js"), "utf8");
  const arretSrc = arretFichier.slice(arretFichier.indexOf("function hdfrPeutArreter"), arretFichier.indexOf("module.exports")).trim();
  if (!arretSrc.startsWith("function hdfrPeutArreter")) die("critère d'arrêt introuvable dans arret_fr.js");
  log("localAI.js : arrêt anticipé " + (HDFR_GE ? "actif en français" : "désactivé (ge() non reconnue)"));
  s = s.replace(anchorAsk, () => `// ── [HomicideDeskFR] fenêtre de contexte du français ──────────────────────
const HDFR_CTX = 6144, HDFR_CTX_PETITE = 5120, HDFR_CAR_PAR_JETON = 3.0, HDFR_RESERVE = 320;
const HDFR_CIBLE_FILET = 0.7;
let hdfrCtxSession = 0, hdfrMemoireVue = false;
// [langue] Langue mémorisée pour le lancement suivant (audit D3, 26/09/2026) : à la première question
// française de la session, et de nouveau après toute question dans une autre langue, qui l'efface.
// Avant, seule la vérification de la mémoire graphique l'écrivait, une fois, et pas du tout quand
// /api/ps ne listait pas le modèle : le lancement suivant partait alors sur Qwen.
let hdfrLangueEcrite = false;
function hdfrMemoriserFr() {
    if (hdfrLangueEcrite) return;
    hdfrLangueEcrite = true;
    const c = hdfrLireCtx();
    if (c.lang !== 'fr') hdfrEcrireCtx({ lang: 'fr', num_ctx: hdfrCtx() });
}
function hdfrFichierCtx() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'hdfr-contexte.json');
}
function hdfrLireCtx() {
    try { return JSON.parse(fs_1.default.readFileSync(hdfrFichierCtx(), 'utf8')) || {}; }
    catch { return {}; }
}
function hdfrEcrireCtx(v) {
    try { fs_1.default.writeFileSync(hdfrFichierCtx(), JSON.stringify(v)); }
    catch (err) { console.error('[localAI] [HomicideDeskFR] contexte non mémorisé :', err); }
}
/** Fenêtre à demander en français : réglage du joueur, sinon mémoire de la session précédente. */
function hdfrCtx() {
    const force = Number(hdfrOverride().num_ctx);
    if (Number.isFinite(force) && force >= 2048) return force;
    if (!hdfrCtxSession) hdfrCtxSession = Number(hdfrLireCtx().num_ctx) || HDFR_CTX;
    return hdfrCtxSession;
}
/** Après le premier chargement : un modèle coupé entre carte graphique et processeur
 *  (0 < size_vram < size) passe à la petite fenêtre pour la suite. Tout en processeur
 *  (size_vram = 0) ou tout en carte : rien ne change. Un réglage du joueur prime. */
async function hdfrVerifierMemoire() {
    if (hdfrMemoireVue) return;
    hdfrMemoireVue = true;
    try {
        if (Number.isFinite(Number(hdfrOverride().num_ctx))) {
            hdfrEcrireCtx({ lang: 'fr', num_ctx: hdfrCtx() });
            return;
        }
        const ps = await (await fetch(baseUrl + '/api/ps')).json();
        const m = (ps.models || []).find(x => x.name === MODEL || x.model === MODEL || String(x.name).split(':')[0] === MODEL);
        if (!m) return;
        const partage = m.size_vram > 0 && m.size_vram < m.size;
        const ctx = partage && hdfrCtx() > HDFR_CTX_PETITE ? HDFR_CTX_PETITE : hdfrCtx();
        if (ctx !== hdfrCtxSession) console.log('[localAI] [HomicideDeskFR] modèle à cheval entre carte et processeur, fenêtre ' + ctx);
        hdfrCtxSession = ctx;
        hdfrEcrireCtx({ lang: 'fr', num_ctx: ctx });
    }
    catch (err) { console.error('[localAI] [HomicideDeskFR] mémoire graphique non vérifiée :', err); }
}
/** Filet : retire les plus vieux messages, par paires, tant que l'estimation dépasse la fenêtre
 *  moins la réserve de réponse. 3,0 caractères par jeton : mesuré 3,11 à 3,23 en français (Qwen). */
function hdfrFilet(systemPrompt, messages, ctx) {
    const cout = t => Math.ceil(String(t || '').length / HDFR_CAR_PAR_JETON) + 8;
    const budget = ctx - HDFR_RESERVE;
    let msgs = messages.slice();
    const total = () => cout(systemPrompt) + msgs.reduce((n, m) => n + cout(m.content), 0);
    let retires = 0;
    // Par blocs (25/09/2026) : une fois la fenêtre atteinte, retirer jusqu'à 70 % du budget, et non
    // un échange par tour, qui décalait le début de la conversation et forçait à tout relire.
    const cible = total() > budget ? HDFR_CIBLE_FILET * budget : budget;
    while (total() > cible && msgs.length > 1) {
        msgs = msgs.slice(msgs.length > 2 ? 2 : 1);
        retires++;
    }
    if (retires) console.log('[localAI] [HomicideDeskFR] filet : ' + retires + ' vieil(s) échange(s) retiré(s) pour tenir dans ' + ctx + ' jetons');
    if (total() > budget) console.error('[localAI] [HomicideDeskFR] prompt trop long même seul : ~' + total() + ' jetons pour ' + ctx);
    return msgs;
}
// ── [HomicideDeskFR] arrêt anticipé (25/09/2026) ─────────────────────────────
// Le rendu (ge) n'affiche que les 4 premières phrases, 460 caractères au plus : ce que le modèle
// écrit ensuite est jeté (31 % de l'écriture de Gemma 4B en français, mesuré). La réplique est donc
// lue en flux et coupée dès que l'affichage ne peut plus changer : même texte à l'écran, au
// caractère près (validé sur 627 répliques). Null si ge() du jeu n'est pas celle validée.
const HDFR_GE = ${JSON.stringify(HDFR_GE)};
let hdfrSeq = 0; // numéro de la dernière demande française entrée dans la file
// dernière demande lue par le moteur (préfixe), et quand : au-delà de 20 min, le modèle a pu être
// déchargé (KEEP_ALIVE 30 min), on ne présume plus rien
let hdfrLu = { cle: '', t: 0 };
const HDFR_LU_MS = 20 * 60 * 1000;
// Préchauffage en cours (son AbortController) : une vraie demande l'interrompt au lieu d'attendre
// sa fin (mesure du 27/09 : au clic sur le mandat, la requête du greffier attendait la fin d'une
// lecture de 11 à 37 s avant de relire elle-même). Couper la connexion fait abandonner le moteur.
let hdfrChauffeEnCours = null;
${arretSrc}
async function hdfrAskFr(systemPrompt, messages, opts) {
    const ctx = hdfrCtx();
    const msgs = hdfrFilet(systemPrompt, messages, ctx);
    // [greffier] Préchauffage inutile (1.2.3) : même prompt système et mêmes messages avant le
    // dernier que la dernière demande lue par le moteur, qui les garde donc en cache. Le rendu
    // peut ainsi réévaluer souvent (frappe, signature) sans rien coûter au moteur. Une nouvelle
    // tentative (hdfrReessai) n'est jamais écartée.
    const hdfrCle = JSON.stringify([systemPrompt, msgs.slice(0, -1)]);
    if (opts.hdfrPrechauffe && !opts.hdfrReessai && hdfrCle === hdfrLu.cle && Date.now() - hdfrLu.t < HDFR_LU_MS) return '';
    // jamais pour une sortie structurée (juge du mandat) : elle doit arriver entière. Ni pour un
    // SMS (hdfrArret false, posé par le rendu) : ge() ne raccourcit que l'interrogatoire (audit m4).
    const arret = !!HDFR_GE && opts.format === undefined && opts.hdfrArret !== false;
    const res = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(opts.hdfrSignal ? { signal: opts.hdfrSignal } : {}),
        body: JSON.stringify({
            model: MODEL,
            stream: arret,
            keep_alive: KEEP_ALIVE,
            messages: [{ role: 'system', content: systemPrompt }, ...msgs],
            ...(opts.format !== undefined ? { format: opts.format } : {}),
            options: {
                num_ctx: ctx,
                num_predict: opts.maxTokens ?? 400,
                temperature: opts.temperature ?? 0.8,
            },
        }),
    });
    if (!res.ok) {
        hdfrLu = { cle: '', t: 0 };
        throw new Error('ollama HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
    }
    hdfrLu = { cle: hdfrCle, t: Date.now() };
    if (!arret) {
        const data = await res.json();
        void hdfrVerifierMemoire();
        return (data.message?.content ?? '').trim();
    }
    // Flux NDJSON d'Ollama : un objet par ligne. Couper la lecture ferme la connexion, et le
    // moteur abandonne la génération en cours.
    const lecteur = res.body.getReader(), dec = new TextDecoder();
    let acc = '', reste = '', coupe = false, fini = false;
    try {
        lecture: for (;;) {
            const { value, done } = await lecteur.read();
            if (done) {
                // dernière ligne sans retour à la ligne : la lire quand même avant de conclure
                if (!reste.trim()) break;
                reste += '\\n';
            }
            else reste += dec.decode(value, { stream: true });
            let i;
            while ((i = reste.indexOf('\\n')) >= 0) {
                const ligne = reste.slice(0, i).trim();
                reste = reste.slice(i + 1);
                if (!ligne) continue;
                const m = JSON.parse(ligne);
                if (m.error) throw new Error('ollama : ' + m.error);
                acc += m.message?.content ?? '';
                if (m.done) { fini = true; break lecture; }
                if (hdfrPeutArreter(acc, HDFR_GE.a2, HDFR_GE.fd)) { coupe = true; break lecture; }
            }
        }
    }
    finally {
        try { await lecteur.cancel(); } catch { /* flux déjà fermé */ }
    }
    // Flux fermé sans objet final (done), sans erreur et sans arrêt anticipé : la réplique est
    // tronquée (banc du 26/09, « Je ne « cache »). Une seule nouvelle tentative, puis une erreur
    // franche : le jeu se rabat alors sur son propre repli au lieu d'afficher une réplique coupée.
    if (!coupe && !fini) {
        // [langue] un préchauffage coupé n'est pas relancé (audit D5) : il ne sert qu'au cache, et
        // le relancer occupait le moteur une seconde fois pendant que le joueur tape sa question
        if (opts.hdfrPrechauffe) {
            console.log('[localAI] [HomicideDeskFR] préchauffage interrompu sans fin de réponse, abandonné');
            return '';
        }
        if (!opts.hdfrReessai) {
            console.log('[localAI] [HomicideDeskFR] flux interrompu sans fin de réponse, nouvelle tentative');
            return hdfrAskFr(systemPrompt, messages, { ...opts, hdfrReessai: true });
        }
        throw new Error('ollama : flux interrompu sans fin de réponse');
    }
    if (coupe) console.log('[localAI] [HomicideDeskFR] arrêt anticipé après ' + acc.length + ' caractères');
    void hdfrVerifierMemoire();
    return acc.trim();
}
` + anchorAsk + `
    if (opts.hdfrLang === 'fr') {
        hdfrMemoriserFr();
        // Préchauffage (rendu patché) : inutile dès qu'une demande plus récente attend derrière lui.
        const hdfrMoi = ++hdfrSeq;
        // Une vraie demande interrompt le préchauffage en cours : il rend '' et la file avance.
        if (!opts.hdfrPrechauffe && hdfrChauffeEnCours) {
            console.log('[localAI] [HomicideDeskFR] préchauffage interrompu par une demande');
            hdfrChauffeEnCours.abort();
        }
        const lancer = () => {
            if (!opts.hdfrPrechauffe) return hdfrAskFr(systemPrompt, messages, opts);
            if (hdfrMoi !== hdfrSeq) return '';
            const hdfrC = new AbortController();
            hdfrChauffeEnCours = hdfrC;
            return hdfrAskFr(systemPrompt, messages, { ...opts, hdfrSignal: hdfrC.signal })
                .catch((err) => {
                    if (!hdfrC.signal.aborted) throw err;
                    hdfrLu = { cle: '', t: 0 }; // lecture inachevée : rien de sûr en cache
                    return '';
                })
                .finally(() => { if (hdfrChauffeEnCours === hdfrC) hdfrChauffeEnCours = null; });
        };
        const result = queue.then(lancer, lancer);
        queue = result.catch(() => undefined);
        return result;
    }
    // Autre langue après une session française : le préchargement suivant reprend le réglage du studio.
    hdfrLangueEcrite = false;
    if (hdfrLireCtx().lang === 'fr') hdfrEcrireCtx({});
    if (hdfrModeleFr) {
        const dossier = hdfrModeleFr;
        hdfrModeleFr = '';
        hdfrSansFr = true;
        try { MODEL = await pickModel(dossier); }
        finally { hdfrSansFr = false; }
        console.log('[localAI] [HomicideDeskFR] question dans une autre langue : modèle du studio ' + MODEL);
    }`);

  // Préchargement : si la dernière session était en français, charger tout de suite à la bonne
  // fenêtre, sinon la première question paierait un rechargement.
  const anchorWarm = "body: JSON.stringify({ model: MODEL, prompt: '', keep_alive: KEEP_ALIVE }),";
  if (!s.includes(anchorWarm)) die("ancre du préchargement introuvable dans localAI.js");
  s = s.replace(anchorWarm, () => "body: JSON.stringify({ model: MODEL, prompt: '', keep_alive: KEEP_ALIVE,\n" +
    "                    // [HomicideDeskFR] même fenêtre que la dernière session française\n" +
    "                    ...(hdfrLireCtx().lang === 'fr' ? { options: { num_ctx: hdfrCtx() } } : {}) }),");
  log("localAI.js : fenêtre " + 6144 + " et filet anti-débordement en français");

  s = MARKER + "\n" + s;
  fs.writeFileSync(file, s);
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

// ---------------------------------------------------------------------------
// Les réécritures publiables sont cases/<id>.fr.flat.json (nos textes). Les fichiers dérivés du
// jeu (.en.json, .fr.orig.json, .fr.json) ne sont pas distribués : on les régénère ici depuis la
// copie locale de l'original si nécessaire.
function prepareCases() {
  const dir = path.join(HERE, "cases");
  if (!fs.existsSync(dir)) return;
  // Une affaire « neuve » n'a pas de traduction d'origine à reconstruire : son objet français est
  // déjà écrit dans .fr.json par l'atelier, il n'y a rien à préparer.
  const neuve = (id) => {
    const m = path.join(dir, id + ".meta.json");
    try { return JSON.parse(fs.readFileSync(m, "utf8")).neuve === true; } catch (e) { return false; }
  };
  const tous = fs.readdirSync(dir).filter(f => f.endsWith(".fr.flat.json")).map(f => f.replace(".fr.flat.json", ""));
  const existe = (id, ext) => fs.existsSync(path.join(dir, id + ext));
  const flats = tous.filter(id => !neuve(id));
  const missing = flats.filter(id => !existe(id, ".fr.orig.json") || !existe(id, ".fr.json"));
  // Une affaire neuve se construit depuis son plat, mais les cellules non traduites se rebouchent
  // depuis la VO (.en.json). Ni l'un ni l'autre n'est publié : chez un joueur, tout est à faire.
  const neuves = tous.filter(id => neuve(id) && !existe(id, ".fr.json"));
  const sansVO = neuves.filter(id => !existe(id, ".en.json"));
  if (!missing.length && !neuves.length) return;
  if (missing.length || sansVO.length) {
    log("préparation des affaires (extraction depuis l'original) : " + [...missing, ...sansVO].join(", "));
    execFileSync(process.execPath, [path.join(HERE, "cases_extract.js"), ASAR_ORIG], { stdio: "inherit" });
  }
  for (const id of missing) execFileSync(process.execPath, [path.join(HERE, "cases_build.js"), id], { stdio: "inherit" });
  for (const id of neuves) {
    if (!existe(id, ".en.json")) { log("ATTENTION : VO de " + id + " introuvable dans le jeu, affaire laissée en anglais"); continue; }
    execFileSync(process.execPath, [path.join(HERE, "cases_build_neuve.js"), id], { stdio: "inherit" });
  }
}

// Le fichier de configuration n'est jamais créé par le patch. L'imposer à tous court-circuitait la
// détection du studio, qui réserve Gemma 12B aux cartes NVIDIA d'au moins 10 Go pour qu'il ne
// déborde pas sur le processeur. On se contente de dire ce qui s'appliquera.
function reportOverrideFile() {
  if (fs.existsSync(OVERRIDE_PATH)) log("configuration personnelle trouvée, elle s'appliquera : " + fs.readFileSync(OVERRIDE_PATH, "utf8").replace(/\s+/g, " ").trim());
  else log("aucune configuration personnelle : le jeu choisit lui-même son modèle, comme sans le patch");
}

// ---------------------------------------------------------------------------
// 5 : feuille de style. Colonnes de libellés à largeur fixe, calibrées sur l'anglais : sur le
//     sachet de scellés (44 px), « AFFAIRE » et « CHAÎNE » se coupent sur deux lignes, et sur la
//     table d'empreintes (60 px) le libellé du taux de correspondance. Élargies, sans effet visible
//     en anglais (les libellés courts gardent leur place).
// ---------------------------------------------------------------------------
const CSS_FIXES = [
  [/\.bag-k\[(data-v-[a-z0-9]+)\]\{width:44px;/, ".bag-k[$1]{width:70px;"],
  [/\.fp-match-label\[(data-v-[a-z0-9]+)\]\{([^}]*)width:60px;/, ".fp-match-label[$1]{$2width:92px;"],
];
function patchStyles() {
  const html = fs.readFileSync(path.join(EXTRACT, "dist", "index.html"), "utf8");
  const m = html.match(/href="\/assets\/(index-[^"]+\.css)"/);
  if (!m) { log("info : feuille de style introuvable, libellés non élargis"); return; }
  const file = path.join(EXTRACT, "dist", "assets", m[1]);
  let c = fs.readFileSync(file, "utf8");
  let n = 0;
  for (const [re, to] of CSS_FIXES) {
    if (!re.test(c)) { log("info : règle CSS absente (version du jeu différente ?) : " + re.source.slice(0, 30)); continue; }
    c = c.replace(re, to); n++;
  }
  fs.writeFileSync(file, c);
  log("feuille de style : " + n + " colonnes de libellés élargies");
}

async function apply() {
  if (!fs.existsSync(ASAR)) die("app.asar introuvable : " + ASAR);
  if (isPatched(ASAR)) die("app.asar est déjà patché. Utiliser --restore d'abord, ou rien à faire.");
  // [publication] seul un original sain peut devenir la sauvegarde (M8)
  const abime = asarAbime(ASAR);
  if (abime) dieSteam("app.asar du jeu est abîmé : " + abime);
  // sauvegarde de l'original (une seule fois par version : si app.asar.orig existe déjà mais que
  // Steam a livré un nouvel app.asar, on écrase la sauvegarde par le nouvel original)
  fs.copyFileSync(ASAR, ASAR_ORIG);
  log("original sauvegardé : " + ASAR_ORIG);

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
  // [publication] dossier de travail (environ 2 Go) effacé même après un échec ou une interruption
  process.on("exit", () => { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* verrouillé */ } });
  for (const sig of ["SIGINT", "SIGHUP", "SIGBREAK"]) process.on(sig, () => process.exit(130));
  log("extraction de app.asar (environ 800 Mo, patience)…");
  asarLib.uncacheAll(); // l'archive a pu changer sur le disque depuis sa dernière lecture
  await asarExtract(ASAR, EXTRACT);

  prepareCases();
  patchRenderer();
  patchStyles();
  patchLocalAI();

  log("réempaquetage…");
  await asarPack(EXTRACT, OUT);
  // contrôle : même jeu de fichiers « unpacked » que l'original
  const listOrig = asarList(ASAR);
  const listNew = asarList(OUT);
  const unp = t => t.filter(l => String(l).startsWith("unpack")).sort().join("\n");
  if (unp(listOrig) !== unp(listNew)) die("le jeu de fichiers unpacked diffère de l'original, installation annulée");
  const norm = t => new Set(t.map(l => String(l).replace(/^(pack|unpack)\s*:\s*/, "")).filter(Boolean));
  const so = norm(listOrig), sn = norm(listNew);
  const onlyOrig = [...so].filter(x => !sn.has(x)), onlyNew = [...sn].filter(x => !so.has(x));
  if (onlyOrig.length || onlyNew.length) die("jeu de fichiers différent de l'original (manquants : " + onlyOrig.slice(0, 5).join(", ") + " | en trop : " + onlyNew.slice(0, 5).join(", ") + "), installation annulée");
  const abimeOut = asarAbime(OUT); // [publication] archive produite relue avant de remplacer le jeu
  if (abimeOut) die("archive patchée défectueuse (" + abimeOut + "), installation annulée");

  fs.copyFileSync(OUT, ASAR);
  log("app.asar patché installé (" + (fs.statSync(ASAR).size / 1e6).toFixed(0) + " Mo)");
  reportOverrideFile();
  // Tout le dossier de travail, archive patchée comprise : 861 Mo que le joueur ne doit pas
  // retrouver dans son dossier de téléchargements.
  fs.rmSync(WORK, { recursive: true, force: true });
  log("terminé. Lancer le jeu et choisir le français dans les paramètres.");
}

function restore() {
  // [publication] une archive illisible n'est ni patchée ni originale : Steam seul sait la remettre (M8)
  const abimeJeu = fs.existsSync(ASAR) ? asarAbime(ASAR) : null;
  if (abimeJeu) dieSteam("app.asar du jeu est abîmé : " + abimeJeu);
  // Après une mise à jour Steam, app.asar est la NOUVELLE version d'origine et app.asar.orig
  // l'ancienne. Restaurer à ce moment réinstallerait un jeu périmé par-dessus la mise à jour.
  if (fs.existsSync(ASAR) && !isPatched(ASAR))
    die("app.asar n'est pas patché (mise à jour Steam ou restauration déjà faite) : c'est déjà l'original, " +
      "et la sauvegarde app.asar.orig peut dater d'une version précédente. Rien n'a été touché.");
  if (!fs.existsSync(ASAR_ORIG)) dieSteam("le jeu est patché mais la sauvegarde app.asar.orig a disparu");
  const abimeOrig = asarAbime(ASAR_ORIG);
  if (abimeOrig || isPatched(ASAR_ORIG)) dieSteam("la sauvegarde app.asar.orig est inutilisable : " + (abimeOrig || "elle est patchée"));
  fs.copyFileSync(ASAR_ORIG, ASAR);
  // @electron/asar garde l'en-tête de chaque archive lue : sans cette purge, une extraction dans le
  // même processus (--reinstaller) lirait le nouveau fichier avec les positions de l'ancien.
  asarLib.uncacheAll();
  log("app.asar d'origine restauré (la sauvegarde est conservée)");
}

// [publication] « Retirer le patch FR » : le jeu redevient exactement celui de Steam, sauvegarde
// comprise. Elle n'est effacée qu'une fois app.asar relu sain et non patché. Rien à retirer (mise à
// jour Steam passée) : la sauvegarde, périmée, est effacée aussi, code 2.
function retirer() {
  const abimeJeu = fs.existsSync(ASAR) ? asarAbime(ASAR) : "fichier absent";
  if (abimeJeu) dieSteam("app.asar du jeu est abîmé : " + abimeJeu);
  const rien = !isPatched(ASAR);
  if (!rien) restore();
  asarLib.uncacheAll();
  if (asarAbime(ASAR) || isPatched(ASAR)) dieSteam("app.asar n'est pas redevenu l'original");
  if (fs.existsSync(ASAR_ORIG)) { fs.rmSync(ASAR_ORIG, { force: true }); log("sauvegarde app.asar.orig effacée"); }
  if (rien) { log("app.asar n'est pas patché : rien à retirer"); process.exit(CODE_RIEN); }
  log("jeu d'origine remis, sauvegarde effacée");
}

function check() {
  log("jeu : " + GAME);
  log("app.asar : " + (fs.existsSync(ASAR) ? (isPatched(ASAR) ? "PATCHÉ" : "original") : "absent"));
  log("sauvegarde app.asar.orig : " + (fs.existsSync(ASAR_ORIG) ? "présente" : "absente"));
  log("configuration : " + (fs.existsSync(OVERRIDE_PATH) ? fs.readFileSync(OVERRIDE_PATH, "utf8").trim() : "absente (" + OVERRIDE_PATH + ")"));
}

const arg = process.argv[2];
if (arg === "--restore") restore();
else if (arg === "--retirer") retirer();
else if (arg === "--check") check();
else if (!arg) apply().catch(err => die(String(err && err.stack || err)));
// Mode de l'installateur en double-clic : déjà patché (par une version précédente du patch, par
// exemple), on remet d'abord l'original de CETTE version du jeu, puis on applique.
else if (arg === "--reinstaller") {
  if (fs.existsSync(ASAR) && isPatched(ASAR)) { log("patch déjà présent : remise de l'original avant réinstallation"); restore(); }
  apply().catch(err => die(String(err && err.stack || err)));
}
else die("argument inconnu : " + arg);
