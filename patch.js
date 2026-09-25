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
    frObj = frObj.replace(re, '"' + k + '":' + JSON.stringify(v));
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
  reFix("mots-clés de stress en français",
    /const (\w+)=\["prove","saw you","evidence","lied","access code","bank","will","debt","key","cctv","fired","silverware"\],(\w+)=(\w+)\.toLowerCase\(\);let (\w+)=\1\.filter\((\w+)=>\2\.includes\(\5\)\)\.length\*8;/,
    (m) => m[0].slice(0, m[0].indexOf("let ")) + "let " + m[4] + "=(" + L + '==="fr"?[' +
      meca.stress.map((e) => reFr(e.motif)).join(",") + "].filter(hdfrK=>hdfrK.test(" + m[2] + ")):" +
      m[1] + ".filter(" + m[5] + "=>" + m[2] + ".includes(" + m[5] + "))).length*8;");
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
  reFix("langue transmise au modèle local",
    /\{maxTokens:(\w+)==="judge"\?300:400,temperature:\1==="judge"\?\.2:\.8,format:\1==="judge"\?(\w+):void 0\}/,
    (m) => m[0].slice(0, -1) + ",hdfrLang:" + L + "}");

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
      const notes = "(" + L + '==="fr"?"\\u241e"+(()=>{const hdfrR=[...' + E + ".matchAll(" + RE_SI +
        ")].filter(hdfrX=>hdfrX[1].split(\"|\").some(hdfrO=>hdfrO.split(\"+\").every(hdfrI=>" + SA + ".some(hdfrP=>hdfrP.id===hdfrI)))).map(hdfrX=>hdfrX[2].trim());return hdfrR.length?" +
        JSON.stringify(code.notesDevoile || "Ce que tu peux désormais reconnaître :\n") +
        '+hdfrR.join("\\n"):""})():"")';
      const neuf = "${" + We + "}${" + Ue + "}${" + Ne + "}\n\n${" + r2 + "}${" + Re +
        "}\n\n${" + be + "}`+" + notes + "}";
      s = s.slice(0, debut) + neuf + s.slice(debut + tout.length);
      log("code : fiche stable en français, dévoilements [[SI]] dans le dernier message (V2)");
    }
  } else log("info : assemblage du prompt non trouvé, passages [[SI:…]] gardés sans leurs marqueurs");

  // Fonction d'envoi (Ie) : sépare le prompt de ses notes, les place dans le dernier message (que le
  // jeu ne garde pas dans l'historique), et garde tout l'historique en français (la coupe à 10
  // messages décalait le début de la conversation à chaque tour : relecture complète, mesuré).
  if (CACHE_FR && siFiltre) {
    const mIe = s.match(/async function \w+\(\w+\)\{const (\w+)=(\w+)\.value,(\w+)=(\w+)\.value;if\(!/);
    if (!mIe) die("fonction d'envoi introuvable (architecture CACHE_FR)");
    const [avant, A, , U, MA] = mIe;
    const apres = avant.replace("," + U + "=" + MA + ".value;", ",hdfrP=" + MA + '.value.split("\\u241e"),' + U + '=hdfrP[0],hdfrN=hdfrP[1]||"";');
    s = s.slice(0, mIe.index) + apres + s.slice(mIe.index + avant.length);
    const zone = s.slice(mIe.index, mIe.index + 1500);
    const mHg = zone.match(new RegExp("await (\\w+)\\(" + A + ",(\\w+)," + U + ",(\\w+)\\)"));
    const mSl = zone.match(/\.filter\((\w+)=>\1\.role!=="system"\)\.slice\(-10\)/);
    if (!mHg || !mSl) die("appel du modèle ou coupe de l'historique introuvable (architecture CACHE_FR)");
    let z = zone.replace(mHg[0], "await " + mHg[1] + "(" + A + ",hdfrN?" + JSON.stringify(code.notesEntete || "") +
      "+hdfrN+\"\\n\\n\"+" + mHg[2] + ":" + mHg[2] + "," + U + "," + mHg[3] + ")");
    z = z.replace(mSl[0], mSl[0].replace(".slice(-10)", ".slice(" + L + '==="fr"?-1e3:-10)'));
    s = s.slice(0, mIe.index) + z + s.slice(mIe.index + zone.length);
    log("code : notes dans le dernier message et historique complet en français");
  }

  // Préchauffage (25/09/2026, délai de réponse) : dès qu'un interrogatoire s'ouvre en français, le
  // moteur lit le prompt système du suspect pendant que le joueur tape sa question. Le moteur
  // réutilise ensuite cette lecture : la première réponse ne paie plus tout le prompt à froid.
  // Même calcul que sans préchauffage, fait plus tôt : aucune différence de texte. Une question
  // envoyée pendant la lecture attend son tour dans la file de localAI.js, sans rien perdre.
  // la fonction d'envoi peut déjà avoir été modifiée par l'architecture CACHE_FR (hdfrP=…split)
  const mPrompt = s.match(/async function \w+\(\w+\)\{const (\w+)=(\w+)\.value,(?:\w+=)?(?:hdfrP=)?(\w+)\.value(?:\.split\([^)]*\))?[;,]/);
  const mApi = s.match(/const (\w+)=(\w+)\(\);if\(\1\)try\{const \w+=await \1\.ask\(/);
  const mOuvre = s.match(/Ra\((\w+),(\w+)=>(\w+)\(\2\),\{immediate:!1\}\),Ya\(\(\)=>\3\(\1\.value\)\);/);
  if (mPrompt && mApi && mOuvre) {
    // 800 ms d'attente et même suspect au déclenchement : un joueur qui passe d'un suspect à
    // l'autre n'empile pas de lectures inutiles. localAI.js abandonne en plus tout préchauffage
    // dépassé par une demande plus récente (hdfrPrechauffe).
    const F = mOuvre[1];
    const chauffe = "let hdfrMinuterie=null;function hdfrChauffe(){try{if(" + L + '!=="fr"||!' + F +
      ".value)return;const hdfrQui=" + F + ".value;clearTimeout(hdfrMinuterie);hdfrMinuterie=setTimeout(()=>{try{" +
      "if(" + F + ".value!==hdfrQui)return;const hdfrA=" + mApi[2] + "();if(!hdfrA)return;hdfrA.ask(" +
      mPrompt[3] + '.value.split("\u241e")[0],[{role:"user",content:"…"}],{maxTokens:1,temperature:.8,hdfrLang:"fr",hdfrPrechauffe:!0})' +
      ".catch(()=>{})}catch{}},800)}catch{}}";
    s = s.replace(mOuvre[0], () => mOuvre[0] + chauffe + ";" + "Ra(" + mOuvre[1] + ",()=>hdfrChauffe()),Ya(()=>hdfrChauffe());");
    log("code : préchauffage du prompt à l'ouverture d'un interrogatoire (français)");
  } else log("info : ouverture d'interrogatoire non trouvée, pas de préchauffage");

  // Préchauffage à l'épinglage d'une pièce (25/09/2026, banc : tours avec pièce de 45 à 12 s) :
  // le joueur épingle la pièce PUIS tape sa question. Dès l'épinglage, le moteur lit le prompt
  // qui contiendra cette pièce, avec l'historique déjà connu. Même calcul, fait plus tôt, aucune
  // différence de texte. hdfrEp fait entrer la pièce épinglée dans la liste des pièces montrées le
  // temps de calculer ce prompt, puis revient à null. Tout ou rien : une ancre manque, rien ne change.
  const mEpingle = s.match(/function \w+\(be\)\{var Ee;if\(!\(\w+\.value\|\|\w+\.value\)\)\{if\((\w+)\.value===be\)\{\1\.value=null/);
  const Vp = mEpingle && mEpingle[1];
  // La déclaration de v DANS le composant de l'interrogatoire : la dernière avant la fonction
  // d'épinglage et après le début du composant. Le 25/09, la première du bundle était prise, dans
  // un autre composant : « hdfrEp is not defined » à chaque question, suspects muets.
  let mRef = null;
  if (Vp) {
    const debutComposant = s.lastIndexOf("setup(", mEpingle.index);
    for (const m of s.matchAll(new RegExp("([,{;])" + Vp + "=(\\w+)\\(null\\)", "g")))
      if (m.index > debutComposant && m.index < mEpingle.index) mRef = m;
  }
  const filtreAvant = mEnvoi ? "&&(" + L + '!=="fr"||' + mEnvoi[3] + ".getHistory(" + mEnvoi[2] + ".value).some(" : null;
  const mFiltre = filtreAvant && s.indexOf(filtreAvant);
  if (CACHE_FR && mEpingle && mRef && mPrompt && mApi && mOuvre && mFiltre > 0 && s.split(filtreAvant).length === 2) {
    const [refTout, sep, REF] = mRef;
    // à la position trouvée, pas s.replace : le même texte existe dans un autre composant
    s = s.slice(0, mRef.index) + sep + Vp + "=" + REF + "(null),hdfrEp=" + REF + "(null)" + s.slice(mRef.index + refTout.length);
    // le filtre des pièces montrées : la pièce épinglée compte le temps du préchauffage
    const X = s.slice(s.lastIndexOf(".filter(", mFiltre) + 8).match(/^(\w+)=>/)[1];
    s = s.replace(filtreAvant, "&&(" + L + '!=="fr"||hdfrEp.value===' + X + ".id||" + mEnvoi[3] + ".getHistory(" + mEnvoi[2] + ".value).some(");
    const F = mOuvre[1], ST = mEnvoi[3];
    const chauffePiece = "let hdfrMinuterieP=null;function hdfrChauffePiece(){try{if(" + L + '!=="fr"||!' + Vp + ".value||!" + F +
      ".value)return;const hdfrQui=" + F + ".value,hdfrQuoi=" + Vp + ".value;clearTimeout(hdfrMinuterieP);hdfrMinuterieP=setTimeout(()=>{try{" +
      "if(" + F + ".value!==hdfrQui||" + Vp + ".value!==hdfrQuoi)return;const hdfrA=" + mApi[2] + "();if(!hdfrA)return;" +
      "hdfrEp.value=hdfrQuoi;let hdfrS;try{hdfrS=" + mPrompt[3] + '.value.split("\\u241e")[0]}finally{hdfrEp.value=null}' +
      "const hdfrH=" + ST + '.getHistory(hdfrQui).filter(hdfrM=>hdfrM.role!=="system").map(hdfrM=>({role:hdfrM.role==="player"?"user":"assistant",content:hdfrM.text}));' +
      'hdfrA.ask(hdfrS,[...hdfrH,{role:"user",content:"…"}],{maxTokens:1,temperature:.8,hdfrLang:"fr",hdfrPrechauffe:!0}).catch(()=>{})' +
      "}catch{}},800)}catch{}}";
    const ancre = "Ra(" + F + ",()=>hdfrChauffe()),Ya(()=>hdfrChauffe());";
    if (!s.includes(ancre)) die("préchauffage d'ouverture absent, préchauffage à l'épinglage impossible");
    s = s.replace(ancre, () => ancre + chauffePiece + ";Ra(" + Vp + ",()=>hdfrChauffePiece());");
    log("code : préchauffage du prompt à l'épinglage d'une pièce (français)");
  } else log("info : épinglage des pièces non trouvé, pas de préchauffage à l'épinglage");

  s = patchCaseClosedMail(s, L);

  s = patchInlineFrench(s, L);
  fs.writeFileSync(file, s);
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
  // Chaînes françaises écrites en dur hors dictionnaire (fiches de l'Atlas, tables internes) :
  // remplacement littéral de la chaîne entière, clé « texte actuel » vers « texte voulu ».
  // Les personnalités des personnages (systemPrompt) ne sont pas atteignables par les surcouches
  // d'affaires : la fusion du jeu n'y prend que la première phrase et les questions. On les
  // remplace donc ici, comme n'importe quelle chaîne du bundle.
  const litt = Object.assign(
    lire("litteraux_fr.json"),
    fs.existsSync(path.join(HERE, "prompts_fr.json"))
      ? lire("prompts_fr.json")
      : {}
  );
  let li = 0, liMiss = [];
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
  for (const [avant, voulu] of Object.entries(litt)) {
    // Sans filtre (jeu modifié), un marqueur [[SI:…]] ne doit jamais atteindre le modèle.
    const apres = HDFR_SI_FILTRE ? voulu : voulu.replace(/\[\[SI:[^\]]+\]\]|\[\[\/SI\]\]/g, "");
    const av = formes(avant), ap = formes(apres);
    let fait = 0;
    for (let k = 0; k < av.length; k++) {
      const n = s.split(av[k]).length - 1;
      if (!n) continue;
      s = s.split(av[k]).join(ap[k]);
      fait += n;
    }
    if (!fait) { liMiss.push(avant.slice(0, 34)); continue; }
    li += fait;
  }
  // Fragments de texte anglais fabriqués par le code (en-têtes de blocs du prompt, humeurs).
  // Ce ne sont pas des chaînes entières : on remplace le fragment là où il apparaît, chacun
  // ayant été vérifié unique dans le bundle.
  const frag = lire("fragments_fr.json");
  let fr2 = 0, fragMiss = [];
  for (const [avant, apres] of Object.entries(frag)) {
    const n = s.split(avant).length - 1;
    if (!n) { fragMiss.push(avant.slice(0, 34)); continue; }
    if (n > 1) { fragMiss.push(avant.slice(0, 28) + " (" + n + " occurrences, ignoré)"); continue; }
    s = s.split(avant).join(apres);
    fr2 += n;
  }
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
    s = s.replace(from, "{fr:" + JSON.stringify(fr) + "," + from.slice(1));
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
      gi = gi.replace(from, 'get label(){return ' + L + '==="fr"?' + JSON.stringify(fr) + ":" + JSON.stringify(en) + "},");
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
    s = s.replace(mGu[0], "function " + mGu[1] + "(e,a,t){const i=Math.floor(a/6e5);const v=" + mGu[2] +
      "[Math.floor(" + mGu[3] + "(e,i,t+100)*" + mGu[2] + ".length)];return " + L + '==="fr"?(' +
      JSON.stringify(cad.unitStatus) + "[v]||v):v}");
    log("code : statuts des unités du tableau des services en français");
  } else log("info : fonction des statuts d'unité introuvable, correctif ignoré");
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
  if (mDiff) f = f.replace(mDiff[0], mDiff[0] + "hdfrS=" + L + '==="fr"?" : ":": ",');

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
  s = s.replace(anchorConst, anchorConst + `
// ── [HomicideDeskFR] override par fichier de configuration ─────────────────
//   <userData>\\localai-override.json : {"model": "homicide-gemma12b", "igpu": true}
//   model : nom d'un modèle présent dans resources\\ollama-models (ex. homicide-gemma12b, gemma3:4b)
//           Fichier absent ou sans « model » : choix automatique du jeu, inchangé.
//   igpu  : true pour activer la puce graphique intégrée (Vulkan). Par défaut : désactivée.
function hdfrOverride() {
    try {
        const p = path_1.default.join(electron_1.app.getPath('userData'), 'localai-override.json');
        if (fs_1.default.existsSync(p))
            return JSON.parse(fs_1.default.readFileSync(p, 'utf8')) || {};
    }
    catch (err) {
        console.error('[localAI] localai-override.json illisible :', err);
    }
    return {};
}
function hdfrModelExists(modelsDir, name) {
    const [repo, tag] = String(name).split(':');
    return fs_1.default.existsSync(path_1.default.join(modelsDir, 'manifests', 'registry.ollama.ai', 'library', repo, tag || 'latest'));
}`);

  const anchorPick = "async function pickModel(modelsDir) {";
  if (!s.includes(anchorPick)) die("ancre pickModel introuvable");
  s = s.replace(anchorPick, anchorPick + `
    const hdfr = hdfrOverride();
    if (hdfr.model) {
        if (hdfrModelExists(modelsDir, hdfr.model)) {
            console.log('[localAI] [HomicideDeskFR] modèle imposé par localai-override.json : ' + hdfr.model);
            return hdfr.model;
        }
        console.error('[localAI] [HomicideDeskFR] modèle demandé introuvable dans le magasin du jeu : ' + hdfr.model + ' (retour au choix automatique)');
    }
    // [HomicideDeskFR] session française (hdfr-contexte.json, écrit par l'installateur puis à chaque
    // question en français) : Gemma 3 4B, installé par outils/modele.js, joue mieux les suspects en
    // français que Qwen 3 4B. Une carte qui tient le Gemma 12B du studio le garde.
    if (hdfrLireCtx().lang === 'fr' && hdfrModelExists(modelsDir, 'homicide-gemma4b')) {
        const vramFr = await detectVramMB();
        if (!(vramFr >= SMART_MIN_VRAM_MB && bundledModelExists(modelsDir, MODEL_SMART))) {
            console.log('[localAI] [HomicideDeskFR] session française : homicide-gemma4b');
            return 'homicide-gemma4b';
        }
    }`);

  const anchorEnv = "OLLAMA_NUM_PARALLEL: '1',\n            },";
  if (!s.includes(anchorEnv)) die("ancre env OLLAMA_NUM_PARALLEL introuvable");
  s = s.replace(anchorEnv, `OLLAMA_NUM_PARALLEL: '1',
                // [HomicideDeskFR] puce graphique intégrée via Vulkan, sur demande explicite seulement
                ...(hdfrOverride().igpu === true ? { OLLAMA_IGPU_ENABLE: '1' } : {}),
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
  s = s.replace(anchorAsk, `// ── [HomicideDeskFR] fenêtre de contexte du français ──────────────────────
const HDFR_CTX = 6144, HDFR_CTX_PETITE = 5120, HDFR_CAR_PAR_JETON = 3.0, HDFR_RESERVE = 320;
const HDFR_CIBLE_FILET = 0.7;
let hdfrCtxSession = 0, hdfrMemoireVue = false;
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
${arretSrc}
async function hdfrAskFr(systemPrompt, messages, opts) {
    const ctx = hdfrCtx();
    const msgs = hdfrFilet(systemPrompt, messages, ctx);
    // jamais pour une sortie structurée (juge du mandat) : elle doit arriver entière
    const arret = !!HDFR_GE && opts.format === undefined;
    const res = await fetch(baseUrl + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error('ollama HTTP ' + res.status + ': ' + (await res.text()).slice(0, 200));
    }
    if (!arret) {
        const data = await res.json();
        void hdfrVerifierMemoire();
        return (data.message?.content ?? '').trim();
    }
    // Flux NDJSON d'Ollama : un objet par ligne. Couper la lecture ferme la connexion, et le
    // moteur abandonne la génération en cours.
    const lecteur = res.body.getReader(), dec = new TextDecoder();
    let acc = '', reste = '', coupe = false;
    try {
        lecture: for (;;) {
            const { value, done } = await lecteur.read();
            if (done) break;
            reste += dec.decode(value, { stream: true });
            let i;
            while ((i = reste.indexOf('\\n')) >= 0) {
                const ligne = reste.slice(0, i).trim();
                reste = reste.slice(i + 1);
                if (!ligne) continue;
                const m = JSON.parse(ligne);
                if (m.error) throw new Error('ollama : ' + m.error);
                acc += m.message?.content ?? '';
                if (m.done) break lecture;
                if (hdfrPeutArreter(acc, HDFR_GE.a2, HDFR_GE.fd)) { coupe = true; break lecture; }
            }
        }
    }
    finally {
        try { await lecteur.cancel(); } catch { /* flux déjà fermé */ }
    }
    if (coupe) console.log('[localAI] [HomicideDeskFR] arrêt anticipé après ' + acc.length + ' caractères');
    void hdfrVerifierMemoire();
    return acc.trim();
}
` + anchorAsk + `
    if (opts.hdfrLang === 'fr') {
        // Préchauffage (rendu patché) : inutile dès qu'une demande plus récente attend derrière lui.
        const hdfrMoi = ++hdfrSeq;
        const lancer = () => (opts.hdfrPrechauffe && hdfrMoi !== hdfrSeq) ? '' : hdfrAskFr(systemPrompt, messages, opts);
        const result = queue.then(lancer, lancer);
        queue = result.catch(() => undefined);
        return result;
    }
    // Autre langue après une session française : le préchargement suivant reprend le réglage du studio.
    if (hdfrLireCtx().lang === 'fr') hdfrEcrireCtx({});`);

  // Préchargement : si la dernière session était en français, charger tout de suite à la bonne
  // fenêtre, sinon la première question paierait un rechargement.
  const anchorWarm = "body: JSON.stringify({ model: MODEL, prompt: '', keep_alive: KEEP_ALIVE }),";
  if (!s.includes(anchorWarm)) die("ancre du préchargement introuvable dans localAI.js");
  s = s.replace(anchorWarm, "body: JSON.stringify({ model: MODEL, prompt: '', keep_alive: KEEP_ALIVE,\n" +
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
  // sauvegarde de l'original (une seule fois par version : si app.asar.orig existe déjà mais que
  // Steam a livré un nouvel app.asar, on écrase la sauvegarde par le nouvel original)
  fs.copyFileSync(ASAR, ASAR_ORIG);
  log("original sauvegardé : " + ASAR_ORIG);

  fs.rmSync(WORK, { recursive: true, force: true });
  fs.mkdirSync(WORK, { recursive: true });
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

  fs.copyFileSync(OUT, ASAR);
  log("app.asar patché installé (" + (fs.statSync(ASAR).size / 1e6).toFixed(0) + " Mo)");
  reportOverrideFile();
  // Tout le dossier de travail, archive patchée comprise : 861 Mo que le joueur ne doit pas
  // retrouver dans son dossier de téléchargements.
  fs.rmSync(WORK, { recursive: true, force: true });
  log("terminé. Lancer le jeu et choisir le français dans les paramètres.");
}

function restore() {
  if (!fs.existsSync(ASAR_ORIG)) die("aucune sauvegarde app.asar.orig à restaurer");
  // Après une mise à jour Steam, app.asar est la NOUVELLE version d'origine et app.asar.orig
  // l'ancienne. Restaurer à ce moment réinstallerait un jeu périmé par-dessus la mise à jour.
  if (fs.existsSync(ASAR) && !isPatched(ASAR))
    die("app.asar n'est pas patché (mise à jour Steam ou restauration déjà faite) : c'est déjà l'original, " +
      "et la sauvegarde app.asar.orig peut dater d'une version précédente. Rien n'a été touché.");
  fs.copyFileSync(ASAR_ORIG, ASAR);
  // @electron/asar garde l'en-tête de chaque archive lue : sans cette purge, une extraction dans le
  // même processus (--reinstaller) lirait le nouveau fichier avec les positions de l'ancien.
  asarLib.uncacheAll();
  log("app.asar d'origine restauré (la sauvegarde est conservée)");
}

function check() {
  log("jeu : " + GAME);
  log("app.asar : " + (fs.existsSync(ASAR) ? (isPatched(ASAR) ? "PATCHÉ" : "original") : "absent"));
  log("sauvegarde app.asar.orig : " + (fs.existsSync(ASAR_ORIG) ? "présente" : "absente"));
  log("configuration : " + (fs.existsSync(OVERRIDE_PATH) ? fs.readFileSync(OVERRIDE_PATH, "utf8").trim() : "absente (" + OVERRIDE_PATH + ")"));
}

const arg = process.argv[2];
if (arg === "--restore") restore();
else if (arg === "--check") check();
else if (!arg) apply().catch(err => die(String(err && err.stack || err)));
// Mode de l'installateur en double-clic : déjà patché (par une version précédente du patch, par
// exemple), on remet d'abord l'original de CETTE version du jeu, puis on applique.
else if (arg === "--reinstaller") {
  if (fs.existsSync(ASAR) && isPatched(ASAR)) { log("patch déjà présent : remise de l'original avant réinstallation"); restore(); }
  apply().catch(err => die(String(err && err.stack || err)));
}
else die("argument inconnu : " + arg);
