// Modèle Gemma 3 4B pour les joueurs francophones (décision du 24/09/2026).
//
// Le studio livre homicide-qwen4b (toutes machines) et homicide-gemma12b (cartes d'environ 10 Go).
// À la lecture des interrogatoires, Gemma 3 4B joue nettement mieux les suspects en français que
// Qwen 3 4B. Ce script l'ajoute au magasin de modèles du jeu, avec le moteur Ollama fourni par le
// jeu, sous le nom homicide-gemma4b : le modèle officiel gemma3:4b du registre Ollama, avec le
// gabarit et les réglages que le studio donne à homicide-gemma12b (relus sur la copie du joueur).
// localAI.js patché le choisit ensuite pour les sessions françaises (voir patch.js).
//
//   node outils/modele.js installer <dossier du jeu>   télécharge (environ 3,3 Go) et crée le modèle
//   node outils/modele.js retirer   <dossier du jeu>   supprime homicide-gemma4b et gemma3:4b
//   node outils/modele.js etat      <dossier du jeu>   dit si le modèle est présent
//
// Code de sortie 0 : réussi (ou rien à faire). 1 : échec, le jeu garde le modèle du studio.
"use strict";
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const NOM = "homicide-gemma4b";
const SOURCE = "gemma3:4b";
const MODELE_STUDIO = "homicide-gemma12b"; // réglages et gabarit de référence
const REGLAGES_SECOURS = { num_ctx: 4096, temperature: 0.8, repeat_penalty: 1.15, top_k: 64, top_p: 0.95, stop: ["<end_of_turn>"] };

const [action, jeu] = process.argv.slice(2);
if (!["installer", "retirer", "etat"].includes(action) || !jeu) {
  console.error("usage : node outils/modele.js installer|retirer|etat <dossier du jeu>");
  process.exit(2);
}
const RUNTIME = path.join(jeu, "resources", "ollama-runtime");
const MODELES = path.join(jeu, "resources", "ollama-models");
const EXE = path.join(RUNTIME, "ollama.exe");
const USERDATA = path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "detective-os");
const CONTEXTE = path.join(USERDATA, "hdfr-contexte.json");

const dire = (t) => console.log(t);
function echec(t) { console.error("ERREUR : " + t); process.exit(1); }

function portLibre() {
  return new Promise((ok, ko) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); });
    s.on("error", ko);
  });
}

let serveur = null, base = "";
async function demarrer() {
  if (!fs.existsSync(EXE)) echec("moteur du jeu introuvable : " + EXE);
  if (!fs.existsSync(MODELES)) echec("magasin de modèles du jeu introuvable : " + MODELES);
  const port = await portLibre();
  base = "http://127.0.0.1:" + port;
  // Même environnement que le jeu (localAI.js, ensureServer).
  serveur = spawn(EXE, ["serve"], {
    cwd: RUNTIME, windowsHide: true, stdio: ["ignore", "ignore", "pipe"],
    env: { ...process.env, OLLAMA_HOST: "127.0.0.1:" + port, OLLAMA_MODELS: MODELES,
      OLLAMA_MAX_LOADED_MODELS: "1", OLLAMA_NUM_PARALLEL: "1" },
  });
  serveur.stderr.on("data", () => {});
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base + "/api/tags")).ok) return; } catch { /* pas encore prêt */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  arreter();
  echec("le moteur du jeu n'a pas démarré");
}
function arreter() {
  if (!serveur) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(serveur.pid), "/T", "/F"], { windowsHide: true });
  else serveur.kill();
  serveur = null;
}
process.on("exit", arreter);

async function api(chemin, corps, methode = "POST") {
  const r = await fetch(base + chemin, { method: methode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps) });
  if (!r.ok) throw new Error(chemin + " HTTP " + r.status + " : " + (await r.text()).slice(0, 200));
  return r;
}
async function present(nom) {
  const t = await (await fetch(base + "/api/tags")).json();
  return (t.models || []).some((m) => m.name === nom || m.name === nom + ":latest" || m.model === nom);
}

// Le gabarit et les réglages du modèle Gemma du studio, lus sur la copie du joueur.
async function reglagesStudio() {
  try {
    const d = await (await api("/api/show", { model: MODELE_STUDIO })).json();
    const reglages = {};
    for (const ligne of String(d.parameters || "").split("\n")) {
      const m = ligne.trim().match(/^(\S+)\s+(.+)$/);
      if (!m) continue;
      const v = m[2].trim().replace(/^"(.*)"$/, "$1");
      if (m[1] === "stop") (reglages.stop = reglages.stop || []).push(v);
      else reglages[m[1]] = Number.isFinite(Number(v)) ? Number(v) : v;
    }
    if (d.template && Object.keys(reglages).length) return { template: d.template, parameters: reglages, origine: MODELE_STUDIO };
  } catch { /* modèle du studio absent de cette version : réglages connus */ }
  return { template: null, parameters: REGLAGES_SECOURS, origine: "réglages connus du 24/09/2026" };
}

// Progression : lancé par l'installateur (HDFR_BARRE=1), une ligne « @@progres pc fait total o/s »
// au plus toutes les 500 ms, que l'installateur dessine en barre. À la main, une ligne tous les 10 %.
const BARRE = process.env.HDFR_BARRE === "1";
const go = (o) => (o / 1e9).toFixed(2).replace(".", ",");
function suiviProgression() {
  const points = []; // [instant ms, octets] des 8 dernières secondes, pour une vitesse lissée
  let dernierEnvoi = 0, dernierPalier = -1;
  return (fait, total) => {
    const t = Date.now();
    points.push([t, fait]);
    while (points.length > 2 && t - points[0][0] > 8000) points.shift();
    const [t0, f0] = points[0];
    const vitesse = t > t0 ? ((fait - f0) * 1000) / (t - t0) : 0;
    const pc = Math.floor((100 * fait) / total);
    if (BARRE) {
      if (t - dernierEnvoi >= 500 || fait >= total) {
        dernierEnvoi = t;
        dire("@@progres " + pc + " " + fait + " " + total + " " + Math.round(vitesse));
      }
    } else if (pc >= dernierPalier + 10 || fait >= total) {
      dernierPalier = pc;
      dire("  " + pc + " % (" + go(fait) + " sur " + go(total) + " Go)");
    }
  };
}

async function telecharger() {
  dire("Téléchargement de Gemma 4B (environ 3,3 Go)…");
  const r = await api("/api/pull", { model: SOURCE, stream: true });
  const lecteur = r.body.getReader();
  const dec = new TextDecoder();
  const suivre = suiviProgression();
  let reste = "", erreur = null, poids = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    reste += dec.decode(value, { stream: true });
    const lignes = reste.split("\n");
    reste = lignes.pop();
    for (const l of lignes) {
      if (!l.trim()) continue;
      const e = JSON.parse(l);
      if (e.error) erreur = e.error;
      // Seule la couche des poids (plusieurs Go) compte, les petites couches passent en un instant.
      if (e.total && e.completed !== undefined && e.total > 1e8) { poids = e.total; suivre(e.completed, e.total); }
    }
  }
  // Ollama envoie sa dernière progression un peu avant la fin de la couche, puis vérifie : un
  // téléchargement réussi se termine donc explicitement à 100 %.
  if (!erreur && poids) suivre(poids, poids);
  if (BARRE) dire("@@fin");
  if (erreur) throw new Error(erreur);
}

async function installer() {
  await demarrer();
  if (await present(NOM)) {
    dire("Gemma 4B est déjà installé dans le jeu, rien à télécharger.");
  } else {
    if (!(await present(SOURCE))) await telecharger();
    const r = await reglagesStudio();
    dire("Préparation du modèle pour le jeu…");
    dire((BARRE ? "@@journal " : "  ") + "réglages repris de : " + r.origine);
    await api("/api/create", { model: NOM, from: SOURCE, ...(r.template ? { template: r.template } : {}), parameters: r.parameters, stream: false });
    if (!(await present(NOM))) throw new Error("le modèle n'apparaît pas après sa création");
  }
  // Le jeu ne connaît pas la langue au démarrage : ce fichier (écrit aussi par localAI.js patché à
  // chaque session française) lui dit de prendre Gemma 4B et la fenêtre française dès le lancement.
  fs.mkdirSync(USERDATA, { recursive: true });
  let ctx = {};
  try { ctx = JSON.parse(fs.readFileSync(CONTEXTE, "utf8")) || {}; } catch { /* absent */ }
  fs.writeFileSync(CONTEXTE, JSON.stringify({ num_ctx: 6144, ...ctx, lang: "fr" }));
  dire("Gemma 4B est prêt : le jeu l'utilisera pour les interrogatoires en français.");
}

async function retirer() {
  await demarrer();
  let n = 0;
  for (const nom of [NOM, SOURCE]) {
    if (await present(nom)) { await api("/api/delete", { model: nom }, "DELETE"); n++; dire("Supprimé : " + nom); }
  }
  if (!n) dire("Gemma 4B n'était pas installé, rien à supprimer.");
}

async function etat() {
  await demarrer();
  dire((await present(NOM)) ? "présent" : "absent");
}

({ installer, retirer, etat })[action]()
  .then(() => { arreter(); process.exit(0); })
  .catch((e) => { arreter(); echec(String(e && e.message || e)); });
