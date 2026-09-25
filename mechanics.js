// Cartographie de la mécanique de chaque enquête depuis la VO : déblocages, verrous, terrain,
// questions conditionnées, scripts, points de rupture des suspects. Sert à vérifier que la VF
// donne les mêmes prises au joueur. Usage : node mechanics.js [case-001]
"use strict";
const fs = require("fs");
const path = require("path");
const DIR = path.join(__dirname, "cases");
const only = process.argv[2];

function keysInventory(o, acc = new Set(), p = "") {
  if (Array.isArray(o)) o.forEach(v => keysInventory(v, acc, p + "[]"));
  else if (o && typeof o === "object") for (const k of Object.keys(o)) { acc.add(p + "." + k); keysInventory(o[k], acc, p + "." + k); }
  return acc;
}
function short(s, n = 110) { s = String(s).replace(/\s+/g, " "); return s.length > n ? s.slice(0, n) + "…" : s; }

for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".en.json")).sort()) {
  const id = f.replace(".en.json", "");
  if (only && id !== only) continue;
  const c = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8"));
  const variants = [c, ...(c.variants || [])];
  console.log("\n############ " + id + " · " + c.title + " (" + variants.length + " variante(s)) ############");
  console.log("guilty:", c.guiltySuspectId, "| accuseThreshold:", c.accuseThreshold, "| requiredEvidenceToAccuse:", JSON.stringify(c.requiredEvidenceToAccuse), "| requiredInterrogations:", JSON.stringify(c.requiredInterrogations));
  for (const v of variants) {
    if (v !== c) console.log("--- variante", v.id, "guilty:", v.guiltySuspectId, "required:", JSON.stringify(v.requiredEvidenceToAccuse));
    console.log("\n[PIÈCES]");
    for (const e of v.evidence || []) {
      const flags = [];
      if (e.foundAtScene) flags.push("scène");
      if (e.unlockedByQuestionId) flags.push("débloquée par question " + e.unlockedByQuestionId);
      if (e.scriptGated) flags.push("script");
      if (e.evidenceType) flags.push(e.evidenceType);
      if (e.viewerType) flags.push(e.viewerType);
      if (e.fieldLocationId || e.fieldLocation || e.atlasLocationId) flags.push("TERRAIN → " + (e.fieldLocationId || e.fieldLocation || e.atlasLocationId));
      if (e.lockCode || e.combination || e.lockCombination || e.code) flags.push("VERROU code=" + (e.lockCode || e.combination || e.lockCombination || e.code));
      if (e.requiresItemId || e.requiresTool) flags.push("outil requis=" + (e.requiresItemId || e.requiresTool));
      if (e.uvText) flags.push("UV");
      if (e.hotspots) flags.push(e.hotspots.length + " zones cliquables");
      if (e.handwritingCompare) flags.push("comparaison d'écriture, clés=" + Object.keys(e.handwritingCompare.findings || {}).join("/"));
      if (e.forensicsReport) flags.push("labo");
      if (e.clue) flags.push("indice " + e.clue.id);
      if (e.deferredClue) flags.push("indice différé " + e.deferredClue.id);
      console.log("  " + e.id + " « " + e.name + " » : " + flags.join(", "));
      for (const k of Object.keys(e)) if (!["id", "name", "description", "presentationMessage", "fileContent", "foundAtScene", "unlockedByQuestionId", "scriptGated", "evidenceType", "viewerType", "clue", "spreadsheetRows", "objectModel", "objectIcon", "forensicsReport", "audioTranscript", "audioFile", "phoneRecords", "hotspots", "handwritingCompare", "deferredClue", "mediaClips", "emailAccount", "emailSubject", "emailThread", "uvText", "lockedHint", "lockHint", "fieldHint", "forensicsMedia", "inspectHintKey", "audioSrc", "videoSrc", "imageSrc", "image"].includes(k)) console.log("      · " + k + " = " + short(JSON.stringify(e[k]), 140));
    }
    console.log("\n[FICHIERS avec mécanique]");
    (function walk(nodes) { for (const n of nodes || []) { const extra = Object.keys(n).filter(k => !["id", "name", "type", "children", "evidenceId", "viewerType"].includes(k)); if (extra.length) console.log("  " + n.id + " « " + n.name + " » : " + extra.map(k => k + "=" + short(JSON.stringify(n[k]), 120)).join(" | ")); walk(n.children); } })(v.files);
    console.log("\n[QUESTIONS]");
    for (const [sid, sd] of Object.entries(v.suspectData || {})) {
      for (const q of sd.questions || []) console.log("  " + sid + " / " + q.id + " : « " + short(q.displayText, 70) + " » stress+" + q.stressIncrease + (q.requiredEvidenceIds && q.requiredEvidenceIds.length ? " requiert " + q.requiredEvidenceIds.join(",") : "") + (q.evidenceToUnlockId ? " → débloque " + q.evidenceToUnlockId : "") + (q.hideAfterAsked ? " (une fois)" : ""));
      const sp = sd.systemPrompt || "";
      const crack = sp.match(/CRACK POINTS[\s\S]*?(?=\n\n[A-Z]{3,}|$)/);
      if (crack) console.log("     rupture : " + short(crack[0].replace(/\n/g, " / "), 400));
      const voice = sp.match(/VOICE[^\n]*\n?[^\n]*/);
      if (voice) console.log("     voix : " + short(voice[0], 220));
    }
    console.log("\n[SCRIPTS]");
    for (const s of v.script || []) console.log("  " + s.id + " : déclencheur " + JSON.stringify(s.trigger) + " → " + (s.actions || []).map(a => a.kind + (a.evidenceId ? ":" + a.evidenceId : "") + (a.fileId ? ":" + a.fileId : "") + (a.emailId ? ":" + a.emailId : "") + (a.clue ? ":indice " + a.clue.id : "")).join(", "));
    for (const k of ["phoneNumbers", "atlas", "fieldLocations", "locks", "unlockableApps", "onboarding"]) if (v[k]) console.log("\n[" + k + "] " + short(JSON.stringify(v[k]), 600));
  }
  console.log("\n[INVENTAIRE DES CLÉS] " + [...keysInventory(c)].filter(k => !/description|presentationMessage|fileContent|name$|body|subject|from|timestamp|label|detail|text|title|tagline/.test(k)).slice(0, 80).join(" "));
}
