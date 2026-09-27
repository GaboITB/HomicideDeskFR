# HomicideDeskFR

**Patch français** du jeu Steam **Homicide Desk** (Shu'la Lab, app 4935210) : les 7 affaires en
français naturel, toute l'interface traduite, des suspects qui répondent en vrai français, et des
réponses deux fois plus rapides. Gratuit, local, hors ligne. Projet de fan, sans lien avec le studio.

**Ce dépôt ne contient aucun texte du jeu.** Les textes du studio dont le patch a besoin sont
désignés par une empreinte et retrouvés dans votre propre copie du jeu à l'installation.

## Pour les joueurs

### Ce que le patch change

| | Version française d'origine | Avec le patch 1.3.0 |
|---|---|---|
| Texte affiché en anglais | 30 %, et les affaires 005 et 006 jamais traduites | 0 % |
| Ce que lit le modèle qui joue les suspects | 86,5 % d'anglais, question envoyée deux fois | tout en français, question envoyée une fois |
| Secrets des suspects | tous donnés au modèle dès la 1re question (110 sur 110) | révélés seulement par la bonne pièce (1 sur 110) |
| Stress quand vous accusez en français | 0 point (seuls les mots anglais comptaient) | 56 points sur 48 questions (64 en anglais) |
| Icônes de réaction | neutres sur 98,7 % des gestes | 1 % |
| Dates | bureau sans lien avec l'affaire, affaire 001 en 2024 | date et heure de l'affaire, tout en 2020 |
| Attente par réplique, processeur | 38,6 s en moyenne, jusqu'à 168 s | 17,0 s, jusqu'à 54 s |
| Attente par réplique, puce graphique intégrée | non utilisée par le jeu | 9,4 s, activée automatiquement |
| Mandat d'arrêt correct | 118 à 127 s, refusé | 47 à 72 s sur processeur, 8,5 s sur la puce, accepté |

Mesuré le 27/09/2026 sur le vrai code des deux versions, à méthode identique (détail dans
« Étude comparative »).

### Installer

1. Téléchargez `HomicideDeskFR-1.3.0.zip` dans les **Releases**, puis clic droit, « Extraire tout ».
2. Fermez le jeu et double-cliquez sur **« Installer le patch FR »** (s'il y a deux dossiers
   imbriqués du même nom, ouvrez le second).
3. Lancez le jeu et choisissez « Français » dans les paramètres.
4. **Gardez le dossier** : il sert à retirer le patch et à le remettre après une mise à jour Steam.

Windows 10 ou 11, environ 3,3 Go libres pendant l'installation (2,3 Go rendus à la fin).
L'installateur propose **Gemma 3 4B** (3,3 Go, une seule fois), qui joue les suspects bien mieux
en français que le modèle livré. **« Retirer le patch FR »** ou « Vérifier l'intégrité des fichiers »
dans Steam remet le jeu d'origine. Après une mise à jour du jeu, relancez l'installation.

### Puce graphique intégrée (expérimental)

Sans carte graphique dédiée, le moteur d'IA du jeu calcule tout au processeur. En français, le
patch essaie la puce graphique intégrée au premier lancement (moins d'une minute, une seule fois)
et ne la garde que si elle est plus rapide. Au moindre souci, même en pleine partie, il revient au
processeur et s'en souvient. Avec une carte dédiée (NVIDIA, AMD, Intel Arc), rien ne change.

Mesuré sur une seule machine (Intel Core Ultra 7 155U) : tour type de 23,5 s à 10 s. **Vos retours
décideront de la garder** : ouvrez une *issue* avec votre processeur et le fichier
`%APPDATA%\detective-os\launch.log` (lignes « puce graphique »).

### Réglages facultatifs

Créez `%APPDATA%\detective-os\localai-override.json`, par exemple `{ "igpu": false }` :

- `igpu` : `false` interdit la puce graphique, `true` la force (toutes langues, sans essai).
- `model` : impose un modèle présent dans `resources\ollama-models` (`homicide-qwen4b`,
  `homicide-gemma12b`, ou `homicide-gemma4b` ajouté par le patch). Gemma 12B demande une carte
  d'au moins 10 Go.
- `num_ctx` : fenêtre de contexte en français (6 144 par défaut).

Supprimer le fichier rend la main au patch.

### Nouveautés de la 1.3.0 (27/09/2026)

Les 1.2.2 à 1.2.4 n'ont jamais été publiées, la 1.3.0 reprend tout leur contenu.

- **Puce graphique intégrée** essayée et utilisée automatiquement, avec retour au processeur.
- **Plus rapide** : le moteur garde tout ce qu'il a lu (cache complet de Gemma 3), prépare la réponse
  pendant que vous choisissez, épinglez ou tapez, et lit le dossier du mandat pendant votre
  rédaction. Une réplique coupée par le moteur est redemandée.
- **Dates cohérentes** : le bureau suit l'affaire, l'affaire 001 est ramenée en 2020, les dates
  contradictoires entre documents sont corrigées (déclaré au studio).
- **Mécaniques** : la question n'est plus envoyée deux fois, « je vous ai vu » met la pression au
  coupable seul, « vous devez de l'argent » compte comme une dette.
- **Textes** : relevé du compte, 680 fiches RPD-NET, menu Démarrer et tableau d'enquête en français,
  Capitaine Morrison partout, « affaires internes », grades dans l'ordre français, typographie
  française à l'écran, certificat tamponné « HABILITÉ », montre Longines en cuir noir.
- **Autres langues** : elles retrouvent exactement le texte du studio.
- **Installation plus sûre** : archive du jeu abîmée détectée sans rien modifier, arrêt propre si une
  mise à jour Steam casse un repère du patch, place disque calculée, erreurs expliquées en français.

### Questions fréquentes

- **Les autres langues sont-elles touchées ?** Non : vérifié à chaque version sur 52
  interrogatoires rejoués contre le jeu d'origine.
- **Les voix ?** En anglais (non traduisibles), avec une transcription française.
- **Un problème ?** Ouvrez une *issue* avec `journal.txt` (dossier du patch) et `launch.log`.

### English summary

Fan-made French patch for **Homicide Desk**: all seven cases in natural French, the
whole interface translated, a fully French prompt for the local model (the original sends 86,5 %
English and hands every hidden fact to the model up front), replies about twice as fast (38,6 s to
17,0 s on a CPU), automatic integrated-GPU use with a safe fallback, and consistent dates. Download
the zip from Releases, run `Installer le patch FR.bat`. No game text is distributed. Shu'la Lab is
welcome to reuse anything here, free of charge and without any condition.

## Étude comparative : VF du studio contre le patch (27/09/2026)

Jeu réinstallé depuis Steam (build 25152927, identique à l'octet près à celui du studio). Un harnais
charge le vrai code du jeu, celui du studio puis celui du patch, joue les mêmes scénarios et parle
au vrai moteur Ollama du jeu. Machine : Core Ultra 7 155U, 32 Go, puce Intel intégrée.

### Texte et mécaniques (52 scénarios, sans dépendre du modèle)

| Mesure | VF du studio | Patch |
|---|---|---|
| Texte affiché en anglais (hors fiches RPD-NET générées) | 30,2 % | 0,1 % (noms propres) |
| Affaires 005 et 006 en français | non | oui (932 chaînes) |
| Mots anglais dans le prompt envoyé au modèle | 86,5 % | 0,4 % |
| Question envoyée au modèle | 2 fois | 1 fois |
| Faits cachés dans le prompt avant leur pièce | 110 sur 110 | 1 sur 110 |
| Pièces listées au modèle à la 1re question | toutes celles ramassées (11,5) | celles déjà montrées |
| Stress des mots-clés, 48 questions françaises | 0 | 56 |
| Icônes neutres sur des gestes français | 98,7 % | 1 % |
| Typographie fautive, dates au format anglais | 111 et 42 | 0 et 0 |

### Vitesse (vrai moteur, 2 tirages, 24 scénarios de 4 affaires)

| Configuration | Attente moyenne / médiane / pire | Partie complète | Mandat d'arrêt |
|---|---|---|---|
| **VF du studio** (Qwen 4B, processeur) | 38,6 / 21,4 / 168,5 s | 53,1 s | 118 à 127 s, refusé |
| **Patch** (Gemma 4B, processeur) | **17,0 / 12,8 / 53,7 s** | **13,3 s** | **47 à 72 s, accepté** |
| Contrôle : studio sur puce graphique | 13,9 s | 19,0 s | 38 s |
| Contrôle : patch avec Qwen 4B, puce | 10,8 s | 8,9 s | 10,8 s, refusé |
| **Patch sur puce graphique** (1.3.0) | **9,4 s** | **7,6 s** | **8,5 s, accepté** |

- **Le code du patch**, à modèle égal : 0 réplique avec de l'anglais au lieu de 33 sur 158, 0 fuite
  de secret au lieu de 11. C'est le patch, et non le modèle, qui corrige la langue et les fuites.
- **Le modèle** : Qwen 4B refuse l'accusation correcte au mandat, avec ou sans patch. Gemma 4B
  l'accepte, va un peu plus vite et utilise moins de mémoire (6,3 Go contre 8,8 Go).
- **Qualité des répliques** : studio et patch ne sont pas comparables à l'aveugle (l'anglais du
  studio se reconnaît). Entre Gemma et Qwen à code égal, un jugement automatisé étalonné n'a pas
  départagé les modèles (p = 0,069). Les tests de l'auteur, francophone natif, donnent Gemma
  nettement meilleur en français naturel.
- **Coût** : environ 4,2 Go de disque (copie d'origine du jeu 0,86 Go, Gemma 4B 3,34 Go facultatif).
- **Limites** : une seule machine, affaires 000, 002 et 004 non jouées sur le moteur, deux tirages
  par scénario.

## Pour les développeurs

### Comment ça marche

Le jeu est une application Electron (`resources\app.asar`) avec un moteur Ollama embarqué. Le patch
modifie `bundle.js` et `localAI.js` dans l'archive, en français seulement :

1. **Textes** : 7 affaires réécrites depuis l'anglais (`cases/*.fr.flat.json`, 1 845 textes affichés
   changés sur 2 343), dictionnaire complété et corrigé (`fr_additions.json`, `fr_overrides.json`),
   surfaces hors dictionnaire (`chatter_fr.json`, `radio_fr.json`, `weather_fr.json`, `cad_fr.json`),
   textes du code (`code_fr.json`, `inline_fr.json`).
2. **Prompt du modèle** : 32 fiches de personnages (`prompts_fr.json`), règles et fragments
   (`litteraux_fr.json`, `fragments_fr.json`), choisis au moment de l'envoi selon la langue.
3. **Secrets** : un fait caché n'entre dans le prompt qu'avec la pièce qui le révèle
   (`[[SI:E4]]…[[/SI]]`, « E4+E7 » les deux, « E4|E7 » l'une ou l'autre).
4. **Moteur** : route `/api/chat`, fenêtre de 6 144 jetons avec un filet contre le débordement,
   historique complet, arrêt anticipé dès que l'affichage est fixé (`arret_fr.js`), préchauffages,
   cache complet (`LLAMA_ARG_SWA_FULL`), puce graphique automatique avec filet.
5. **Mécaniques** : mots-clés de stress et gestes en français (`mecaniques_fr.json`), horloge du
   bureau calée sur l'affaire.
6. **Robustesse** : chaque repère du code du jeu doit être trouvé exactement une fois, sinon le patch
   s'arrête avant d'écrire, ou désactive proprement la fonction concernée avec un message ATTENTION.

### À la main

Avec [Node.js](https://nodejs.org) 22.12 ou plus récent :

```powershell
npm install
$env:HD_GAME_DIR = "C:\Program Files (x86)\Steam\steamapps\common\Homicide Desk"
node patch.js                   # applique (sauvegarde l'original en app.asar.orig)
node patch.js --reinstaller     # remet l'original puis réapplique
node patch.js --check           # état : original ou PATCHÉ
node patch.js --restore         # remet le jeu d'origine
node patch.js --retirer         # idem, puis efface app.asar.orig
node verify.js                  # contrôle de l'archive installée
node audit.js                   # compare les textes réécrits à l'anglais
```

Ne jamais lancer `patch.js` pendant que le jeu tourne. Journal du jeu :
`%APPDATA%\detective-os\launch.log`. Choix du modèle, de la fenêtre et de la puce mémorisés dans
`%APPDATA%\detective-os\hdfr-contexte.json`.

### Empreintes

Une phrase du studio reprise dans nos textes y figure sous la forme `#hdfr:<longueur>:<somme>:<SHA-256>`,
résolue contre votre jeu par `ancres.js`. Si le studio change un texte, l'empreinte ne correspond
plus : le patch le signale (ATTENTION) et garde le texte du studio.

### Diffusion et licence

- Jamais publié : un `app.asar` patché ni une extraction du jeu.
- **Pour le studio** : tout ce dépôt est à votre disposition, gratuitement et sans condition.
  Reprenez ce qui vous intéresse et intégrez-le à votre guise. `DEVELOPER_NOTES.md` détaille chaque
  choix et chaque correction des affaires. `node release.js` produit aussi les traductions rangées
  dans vos propres structures (`release/studio/`).
- Scripts (`*.js`) : licence MIT (`LICENSE`). Fichiers de données : traductions de textes dont les
  droits appartiennent à Shu'la Lab LLC, fournies gratuitement pour un usage avec une copie légale
  du jeu, retirées à la demande du studio.

### Limites connues

- L'intégrité de l'archive n'est pas vérifiée par l'exécutable du jeu, c'est ce qui rend le patch
  possible. Si une future version l'active, `node patch.js --restore` remet l'original.
- Les bandes audio n'existent qu'en anglais et en arabe (transcription française affichée).
- Les répliques dépendent du modèle local : un suspect nie même devant la preuve (voulu par le
  studio), et le carnet des contradictions cherche des mots de déni anglais, absents en français.
