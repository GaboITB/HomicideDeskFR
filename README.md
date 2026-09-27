# HomicideDeskFR

Patch de localisation française pour le jeu Steam **Homicide Desk** (Shu'la Lab, app 4935210) :
documents d'enquête réécrits en français naturel depuis la version anglaise, dictionnaire
d'interface complété et corrigé, fil du commissariat, radio, terminal de régulation, météo, courriel
de clôture et papier 3D en français, meilleur français dans les interrogatoires. Usage local, hors
ligne. Les traductions sont aussi offertes au studio pour intégration, dans un paquet séparé.

**Ce dépôt ne contient aucun texte du jeu.** Les textes du studio que le patch doit retrouver
(personnalités anglaises, lignes de règles, phrases de la VF d'origine gardées telles quelles) y
sont désignés par une empreinte, pas recopiés. Le patch les retrouve dans votre propre copie du
jeu au moment de l'installation.

## Pour les joueurs

### Ce que le patch change

| | Version française d'origine | Avec le patch |
|---|---|---|
| Textes des affaires | traduction mot à mot, 890 textes restés en anglais | 7 affaires réécrites en français naturel, relues face à l'anglais |
| Pièces à conviction | seul le nom était traduit | nom, description et document complet en français |
| Radio, météo, terminal, fil du commissariat | en anglais | en français |
| Ce que lit le modèle qui joue les suspects | 75 % d'anglais, les suspects changent de langue | 100 % français, 32 fiches de personnages traduites |
| Suspects | lâchent parfois leur secret sans preuve | les faits cachés n'arrivent qu'avec la pièce qui les révèle |
| Délai de réponse (puce graphique intégrée) | 12,6 s par réplique, jusqu'à 68 s | 7,9 s, 10,6 s sur l'affaire la plus lourde, rythme de la version anglaise |
| Stress quand vous accusez | seuls les mots anglais comptaient | « menti », « preuve », « dette »… comptent comme en anglais |
| Icônes de réaction | neutres sur 67 % des répliques | 1 % |

En option, l'installateur propose **Gemma 3 4B** (3,3 Go, téléchargé une seule fois), qui joue les
suspects bien mieux en français que le modèle livré. Une carte graphique qui fait déjà tourner le
modèle 12B du jeu le garde.

### Installer

1. Téléchargez `HomicideDeskFR-1.2.3.zip` dans les **Releases** de ce dépôt.
2. Clic droit, « Extraire tout ». Si le dossier obtenu en contient un second du même nom,
   ouvrez-le : les deux fichiers à double-cliquer sont dedans.
3. Fermez le jeu, puis double-cliquez sur **« Installer le patch FR »**.
4. Lancez le jeu et choisissez « Français » dans les paramètres.
5. **Gardez le dossier du patch** : il sert à le retirer et à le remettre après une mise à jour.

Windows 10 ou 11, environ 3,3 Go libres pendant l'installation si le jeu et le patch sont sur le
même disque (2,3 Go rendus à la fin), chiffre calculé et vérifié par l'installateur. Rien à
installer d'autre, rien à taper. **« Retirer le patch FR »**, ou « Vérifier l'intégrité des
fichiers » dans Steam, remet le jeu d'origine. Après une mise à jour du jeu par Steam, relancez
« Installer le patch FR ».

### Nouveautés de la 1.2.3 (27/09/2026)

La 1.2.2 n'a jamais été publiée : la 1.2.3 la remplace et reprend tout son contenu.

- **Mandat d'arrêt validé plus vite** : le parquet lit le dossier pendant que vous rédigez votre
  conclusion. Mesuré sur la puce intégrée : de 24 à 46 s d'attente après la signature à 7 à 15 s,
  et un peu plus rapide qu'avant même si vous signez tout de suite.

- **Réponses plus rapides avec Gemma 4B** : le moteur garde en mémoire tout ce qu'il a déjà lu
  (cache complet de Gemma 3, `LLAMA_ARG_SWA_FULL`). Mesuré sur la puce intégrée : relecture d'un
  tour au même suspect de 2,8 à 3,1 s ramenée à 0,56 à 0,73 s, retour sur un suspect de 5,0 s à 2,7 s.
- **Préchauffage avec l'historique** : en revenant sur un suspect, le moteur relit sa conversation
  pendant que vous tapez, sous la forme exacte du tour suivant.
- **Répliques coupées relancées** : une réplique interrompue par le moteur (flux fermé sans fin)
  est redemandée une fois, au lieu de s'afficher tronquée comme si elle était complète.
- **Capitaine Morrison partout** : plus de « commissaire Morrison ».
- **Question unique** : la question du tour partait deux fois au modèle (défaut du jeu, VO
  comprise). En français, elle n'est plus envoyée qu'une fois.
- **Installation plus sûre** : une archive du jeu abîmée ou tronquée est reconnue (empreinte de
  chaque fichier) et ne remplace plus jamais la sauvegarde, le joueur est envoyé vers la
  vérification de Steam. « Retirer le patch FR » remet le jeu, efface la sauvegarde, puis
  seulement Gemma 4B. Place calculée sur le jeu du joueur, dossier de travail effacé même après un
  échec, erreur imprévue expliquée en français.
- **« Je vous ai vu… » met la pression au coupable** : la tournure est reconnue sous toutes ses
  formes naturelles (« je vous ai vu », « un témoin vous a vue », « nous vous avons vus »…) et ne
  stresse plus que le coupable de l'affaire. « Vous devez de l'argent » compte aussi.
- **Préchauffage plus juste** : plus de lecture perdue sur le premier suspect à l'ouverture, ni
  pour un suspect sous avocat ou relâché. Le moteur lit dès le choix du suspect, l'épinglage d'une
  pièce et la frappe de la question, avec l'humeur que la question donnera au suspect.
- **Les autres langues ne sont plus touchées** : hors français, le jeu envoie de nouveau au modèle
  exactement le texte du studio (fiches, règles, SMS, greffier).
- **Mise à jour du jeu** : si Steam change le code du jeu au point qu'un repère essentiel du patch
  manque, l'installation s'arrête proprement et laisse le jeu d'origine, au lieu de s'appliquer à
  moitié.
- **Textes** : relevé du compte, 680 fiches RPD-NET générées, compteurs du menu Démarrer, couleurs
  de fil et capture du tableau en français. « Affaires internes », « comité de contrôle »,
  difficulté « Capitaine », grades dans l'ordre français, « occasion » au lieu d'« opportunité »,
  espaces insécables à l'écran, montants en « 120 $ ». Recherche RPD-NET sans accents obligatoires.
- **SMS de Whitmore** : ses réponses ne sont plus coupées en pleine phrase.

### Questions fréquentes

- **Les autres langues sont-elles touchées ?** Non. L'anglais et les neuf autres langues restent
  identiques au jeu d'origine, jusqu'au texte envoyé au modèle (fiches des personnages, règles,
  SMS, greffier) : vérifié à chaque version sur 52 interrogatoires rejoués contre le jeu d'origine.
- **Les voix ?** Les enregistrements sont joués en anglais et ne sont pas traduisibles. Leurs
  transcriptions sont en français.
- **Un problème ?** Ouvrez une *issue* avec le fichier `journal.txt` du dossier du patch et
  `%APPDATA%\detective-os\launch.log`.

### English summary

Fan-made French localisation patch for **Homicide Desk**: the seven cases rewritten in natural
French from the English original, the missing interface and surfaces translated, a fully French
prompt for the local model that plays the suspects, faster replies (12,6 s to 7,9 s per reply on
an integrated GPU), and the English-only stress keywords and reaction gestures given French
equivalents. Download the zip from Releases, run `Installer le patch FR.bat`. No game text is
distributed. Not affiliated with Shu'la Lab LLC.

## Constat (septembre 2026)

- Le jeu est une application **Electron** (`resources\app.asar`) avec un moteur **Ollama embarqué**
  et deux modèles livrés : `homicide-qwen4b` (Qwen3 4B, 2,5 Go) et `homicide-gemma12b`
  (Gemma 3 12B, 8,1 Go).
- Les textes fixes (interface, dossiers des 7 affaires) sont traduits en dur. Le français des
  dossiers était une traduction mot à mot de l'anglais, et 74 chaînes d'interface n'avaient pas de
  version française. Plusieurs surfaces n'existaient qu'en anglais (radio, terminal, météo, lieux de
  l'Atlas, date du bureau, tampons du papier) et le courriel de clôture affichait le chef
  d'accusation en anglais.
- Les **réponses des suspects sont générées en direct** par le modèle local. Le jeu choisit lui-même
  son modèle : Gemma 12B si `nvidia-smi` annonce au moins 10 Go de mémoire vidéo, Qwen 4B sinon
  (le patch ajoute Gemma 4B pour le français, voir plus bas).
  Avec le prompt d'origine, anglais à 75 %, les personnages répondaient dans un français
  approximatif (genre faux, anglicismes, calques) ou changeaient de langue en pleine phrase.

## Ce que fait le patch

1. Remplace les documents des 7 affaires par une réécriture en français naturel, faite depuis la
   version anglaise et relue chaîne par chaîne face à elle (`cases/case-XXX.fr.flat.json`, 2 195
   chaînes, les noms propres, cellules de tableaux et dates étant verrouillés). Les indices,
   codes, heures et mécaniques sont inchangés. Les transcriptions des messages vocaux sont faites
   depuis la bande audio.
2. Ajoute les 74 chaînes françaises manquantes (`fr_additions.json`) et corrige 71 entrées du
   dictionnaire existant (`fr_overrides.json`).
3. Traduit ce qui n'existait qu'en anglais : fil du commissariat (`chatter_fr.json`), appels radio
   (`radio_fr.json`), météo (`weather_fr.json`), terminal de régulation, lieux de l'Atlas et statuts
   d'unité (`cad_fr.json`), date du bureau, en-têtes et tampons du papier 3D, mots du mini-jeu
   ROT-13 du labo (mots valides dans les deux langues).
4. Corrige le courriel « affaire classée » (chef d'accusation dans la langue de l'interface,
   typographie française des montants et pourcentages).
5. **Met en français tout le prompt envoyé au modèle**, et pas seulement la consigne de langue :
   les 32 personnalités des personnages (`prompts_fr.json`), les six blocs de règles écrits dans le
   code (`litteraux_fr.json`), les en-têtes et les humeurs assemblés à la volée, le contact SMS du
   service du personnel et le greffier du procureur (`fragments_fr.json`). Chaque texte est choisi
   au moment de l'envoi, selon la langue : les autres langues reçoivent celui du studio. Le modèle recevait
   jusque-là une consigne française noyée dans 75 % d'anglais, et répondait en anglais ou mélangeait
   les deux langues dans une même phrase. La consigne elle-même est renforcée (accord au genre du
   personnage, pas d'anglicismes, vouvoiement).
6. **Donne au modèle de quoi bien jouer en français** (`localAI.js`, français seulement, les autres
   langues suivent le code du studio) :
   - fenêtre de contexte de 6 144 jetons au lieu de 4 096, par la route `/api/chat` (la route `/v1`
     du jeu ignore ce réglage). Le français coûte environ 20 % de jetons de plus que l'anglais, et
     Adrian Cove (006), toutes pièces en main, débordait la fenêtre avant la première question.
     5 120 si le modèle ne tient pas entier en mémoire graphique.
   - un filet qui retire les plus vieux échanges avant tout débordement, sans jamais toucher la
     fiche du personnage ni la question en cours.
   - le suspect ne connaît que les pièces déjà posées devant lui, et non plus toutes celles ramassées.
   - **Gemma 3 4B**, si le joueur accepte de le télécharger à l'installation (environ 3,3 Go, par
     `outils/modele.js` et le moteur Ollama du jeu) : à la lecture des interrogatoires, il joue les
     suspects bien mieux que Qwen 3 4B. Il reçoit le gabarit et les réglages du `homicide-gemma12b`
     du studio. Une carte d'au moins 10 Go garde le Gemma 12B du jeu. Sans Gemma 4B, le jeu garde
     son choix d'origine.
   Le choix et la fenêtre se mémorisent dans `%APPDATA%\detective-os\hdfr-contexte.json`.
7. **Répond plus vite, sans changer ce qui s'affiche** (1.2.0, français seulement) :
   - arrêt anticipé (`arret_fr.js`) : le jeu n'affiche que les 4 premières phrases d'une réplique,
     le modèle est donc arrêté dès que l'affichage ne peut plus changer. Texte affiché identique
     au caractère près (vérifié sur 1 457 répliques), environ 30 % d'écriture en moins.
   - préchauffage : le moteur lit la fiche du suspect dès l'ouverture de l'interrogatoire, et le
     prompt qui contiendra une pièce dès qu'on l'épingle, pendant que le joueur tape sa question.
   - fiche stable et historique complet : le moteur réutilise ce qu'il a déjà lu au lieu de tout
     relire à chaque pièce posée ou à chaque tour (la coupe du jeu à 10 messages décalait tout).
   - un personnage ne connaît les faits qu'il cache qu'une fois posée la pièce qui les révèle
     (`[[SI:E4]]…[[/SI]]` dans `prompts_fr.json`, « E4+E7 » les deux, « E4|E7 » l'une ou l'autre) :
     une consigne de les taire ne suffit pas à un petit modèle. 15 personnages sont concernés.
8. **Rend au français les mécaniques écrites pour l'anglais** (1.2.1, `mecaniques_fr.json`) :
   - stress : le jeu ajoute 8 points par mot-clé tapé (« prove », « lied », « debt »…), mais
     cherche les mots anglais. En français, un motif par mot-clé (« prouver », « menti »,
     « dette »…), même barème. Sur 48 questions en paires : 174 points en anglais, 110 en
     français avant, 166 après.
   - icônes de réaction : le jeu reconnaît les gestes anglais (« shrugs », « sighs »). En
     français, un motif par icône (« hausse les épaules », « soupire »…). Icônes neutres :
     67 % des répliques avant, 1 % après.

### Réglage facultatif du modèle (joueurs avertis)

Qui veut forcer un modèle ou essayer la puce graphique intégrée crée lui-même le fichier
`%APPDATA%\detective-os\localai-override.json` :

```json
{ "model": "homicide-gemma12b", "igpu": true }
```

- `model` : un modèle présent dans `resources\ollama-models`. Le jeu livre `homicide-qwen4b` et
  `homicide-gemma12b`, le patch ajoute `homicide-gemma4b` si le joueur l'a accepté. Un modèle
  absent renvoie au choix automatique. **Attention** :
  Gemma 12B pèse 8,1 Go et, sans carte d'au moins 10 Go, il déborde sur le processeur et les
  réponses deviennent très lentes. C'est précisément ce que la détection du jeu évite.
- `igpu` : `true` active la puce graphique intégrée (Vulkan) pour le moteur Ollama du jeu. Absent
  ou `false` : comportement d'origine. Non testé sur les portables à deux cartes graphiques.
- `num_ctx` : impose la fenêtre de contexte des sessions françaises (par défaut 6 144, ou 5 120
  si le modèle ne tient pas entier en mémoire graphique).

Supprimer le fichier rend la main au jeu.

### Ce qui change aussi dans les autres langues

Tout le reste ne s'active qu'en français. Deux retouches valent pour toutes les langues, sans effet
visible hors du français : les dix mots du mini-jeu ROT-13 du labo, remplacés par des mots valides
en anglais comme en français, et deux colonnes de libellés élargies dans la feuille de style.

## Installation

**Pour jouer, rien à installer ni à taper.** Décompresser le zip (clic droit, « Extraire tout »),
fermer le jeu, puis double-cliquer sur **« Installer le patch FR »**. Le patch trouve le jeu dans
Steam (y compris sur une autre bibliothèque ou un autre disque), vérifie qu'il est fermé et qu'il
reste assez de place, installe, propose Gemma 4B (voir « Ce que fait le patch », point 6), puis
dit quoi faire. **« Retirer le patch FR »** remet le jeu
d'origine. Le mode d'emploi pour les joueurs est `LISEZ-MOI.txt`, à la racine du zip.

Sous le capot : les deux fichiers `.bat` lancent `outils/installateur.ps1` (Windows PowerShell 5.1,
présent sur tout Windows 10 et 11) avec le Node portable du paquet (`node/node.exe`, archive
officielle de nodejs.org dont l'empreinte est vérifiée). Les dépendances sont déjà dans
`node_modules`. Le détail de chaque installation est écrit dans `journal.txt`.

**Windows seulement.** L'installateur calcule la place sur le jeu du joueur et la vérifie avant de
commencer : deux fois `app.asar` et `app.asar.unpacked` pour le dossier de travail (pic mesuré de
2,1 Go, 2,3 Go demandés, rendus à la fin) et une fois `app.asar` pour la copie d'origine du jeu
(0,8 Go, `resources\app.asar.orig`, 1 Go demandé), soit 3,3 Go sur un même disque. Une archive du
jeu abîmée ou tronquée (empreintes SHA-256 de l'en-tête) arrête tout avant la moindre écriture.
Gemma 4B demande environ 4 Go de plus sur le disque du jeu et une connexion Internet, une seule
fois. Sans connexion, le patch s'installe quand même et le jeu garde Qwen 4B.

### À la main (développeurs)

Depuis ce dossier, avec [Node.js](https://nodejs.org) 22.12 ou plus récent :

```powershell
npm install                     # une seule fois, inutile avec le paquet joueur
$env:HD_GAME_DIR = "C:\Program Files (x86)\Steam\steamapps\common\Homicide Desk"   # votre dossier
node patch.js                   # applique le patch (sauvegarde l'original en app.asar.orig)
node patch.js --reinstaller     # idem, en remettant d'abord l'original si le jeu est déjà patché
node patch.js --check           # état : original ou PATCHÉ
node patch.js --restore         # remet le jeu d'origine
node patch.js --retirer         # idem, puis efface app.asar.orig (« Retirer le patch FR »)
node verify.js                  # contrôle du contenu de l'archive installée
node audit.js                   # compare les textes réécrits à l'anglais (nombres, heures, codes)
```

**Après chaque mise à jour Steam** du jeu, `app.asar` est remplacé et le jeu redevient celui
d'origine : relancer simplement « Installer le patch FR » (ou `node patch.js`). Après une mise à
jour, la sauvegarde date de la version précédente : `--restore` refuse de la remettre, et « Retirer
le patch FR » dit qu'il n'y a rien à retirer et efface cette sauvegarde périmée.
Une « vérification de l'intégrité des fichiers » dans Steam retire aussi le patch. Ne jamais lancer
`patch.js` pendant que le jeu tourne.

Si le studio modifie une affaire, le patch la laisse telle quelle avec un message **ATTENTION** et
traduit tout le reste. Signalez ce message avec la version du jeu.

## Délai de réponse (même machine, puce intégrée, 25/09/2026)

Interrogatoire de 12 tours de Tommy Vale (000), délai moyen par tour : jeu d'origine en anglais
(Qwen 4B) 7,6 s, patch 1.1.0 12,6 s, patch 1.2.0 7,9 s. Pire tour : 24,3 s, 24,8 s et 10,7 s.
Sur processeur seul : 19,9 s, 26,3 s et 11,1 s. Cas le plus lourd, Adrian Cove (006), 10 tours et
trois pièces posées, Gemma 4B : patch 1.1.0 22,6 s par tour (pire 68,0 s), patch 1.2.0 10,6 s
(pire 13,9 s). Qualité jugée à l'aveugle, dont par l'auteur sur
ses propres questions : 1.2.0 préférée à 1.1.0.

## Mesures (Core Ultra 7 155U, puce Intel intégrée, 32 Go, 24/09/2026)

Moteur Ollama du jeu, prompt réel des personnages après patch, jetons comptés avec le tokenizer
de chaque modèle (les estimations des versions précédentes sous-comptaient d'environ 12 %).

### Fenêtre de contexte

Adrian Cove (affaire 006), toutes pièces en main, avant la première question :

| | Jetons (Qwen 4B) | Fenêtre du jeu (4 096) | Fenêtre du patch (6 144) |
|---|---|---|---|
| VO anglaise | 3 405 | 83 % | |
| VF, sans les correctifs de fenêtre | 4 483 | **déborde** | |
| VF avec le patch | 4 027 | déborde encore | 66 % |

Le français coûte environ 20 % de jetons de plus que l'anglais à contenu égal. Au débordement,
Qwen 4B ne répond pas (erreur du moteur) et le jeu se replie sur le serveur en ligne du studio,
Gemma jette le milieu du prompt et le suspect oublie qui il est. Contre-épreuve sur la même série
de 12 questions : fenêtre de 4 096 sans filet, le moteur jette tout l'historique à chaque tour et
chaque réponse prend 60 à 90 s. Avec le patch, l'historique est conservé et une réponse prend 7 à
18 s.

### Qwen 4B contre Gemma 4B

Batterie de 117 échanges (Dana Brook, Sophie Ward, Adrian Cove, 3 graines chacun), 0 erreur du
moteur pour les deux modèles, dans les conditions du patch :

| | Qwen 4B (choix du studio) | Gemma 4B (proposé par le patch) |
|---|---|---|
| Fautes graves relevées automatiquement | 29 | 62 |
| Réponses avec de l'anglais (questions posées en anglais) | 0 | 5 |
| Temps médian d'une réponse | 8,4 s | 8,6 s |

Les fautes relevées comptent tout nom ou fait absent de la fiche du personnage : elles pénalisent
l'improvisation. À la lecture des réponses côte à côte, Gemma 4B joue nettement mieux : suspects
plus vivants, réactions justes aux pièces présentées, là où Qwen 4B répond dans un français plat
et parfois absurde. D'où le choix de le proposer aux joueurs francophones.

Le jeu précharge le modèle au lancement, et directement à la bonne fenêtre après une première
session française.

## Fichiers

Données :

- `cases/case-00X.fr.flat.json` : nos textes des 7 affaires, chemin dans l'objet `fr` → texte. Un
  texte identique à la VF du studio n'y figure pas, le patch le reprend de votre copie du jeu.
- `cases/case-00X.meta.json` : identifiant de l'affaire (le reste est régénéré à l'installation).
- `fr_additions.json`, `fr_overrides.json` : dictionnaire d'interface (ajouts, corrections).
- `chatter_fr.json`, `radio_fr.json`, `weather_fr.json`, `cad_fr.json` : surfaces hors dictionnaire.
- `prompts_fr.json`, `litteraux_fr.json`, `fragments_fr.json`, `inline_fr.json`, `code_fr.json` :
  ce qui est écrit dans le code du jeu, personnalités des personnages et blocs de règles du modèle
  compris.

Les empreintes ont la forme `#hdfr:<longueur>:<somme>:<SHA-256>`. Une phrase du studio reprise dans
un de nos textes y apparaît comme `{"_hdfr": ["#hdfr:…", " notre texte "]}`. `ancres.js` les
résout contre votre jeu. Si le studio change un texte, son empreinte ne correspond plus : le patch
le signale par un message **ATTENTION** et garde le texte du studio à cet endroit.

Scripts :

- `patch.js` : application, restauration, contrôle. `verify.js` : inspection d'un `app.asar`.
- `ancres.js` : empreintes des textes du jeu et leur résolution.
- `audit.js` : non-régression des réécritures (nombres, heures, codes, marqueurs, calques).
- `mechanics.js` : cartographie de la mécanique de chaque enquête depuis la version anglaise.
- `cases_extract.js` → `cases_sheet.js` → édition du `.fr.flat.json` → `cases_rewrap.js`
  (68 caractères) → `cases_build.js` → `cases_inject.js` (appelé par `patch.js`).
- Journal du jeu : `%APPDATA%\detective-os\launch.log` (ligne « model tier picked », et « modèle
  imposé par localai-override.json » si le réglage facultatif est présent).
- Sauvegarde de l'original : `resources\app.asar.orig` (861 Mo).

## Diffusion

- **Ce paquet (joueurs)** : scripts, données en empreintes, documentation. Les extractions du jeu
  (`cases/*.en.json`, `*.fr.orig.json`, `*.fr.json`, `*.sheet.txt`, `.work/`) ne sont jamais
  publiées : `patch.js` les régénère tout seul depuis votre copie au premier lancement.
- **Jamais publié** : un `app.asar` patché (c'est le code du jeu), ni les extractions.
- **Paquet studio** : les mêmes traductions, rangées dans les structures du jeu et accompagnées de
  notes techniques, sont envoyées à Shu'la Lab LLC (canal officiel : Discord
  `discord.gg/BsfKqmXKJm`, lien de la page Steam) pour une intégration officielle.

## Licence

- **Scripts** (`*.js`) : licence MIT, voir `LICENSE`.
- **Fichiers de données** (`cases/`, `*_fr.json`, `fr_additions.json`, `fr_overrides.json`) : ce
  sont des traductions de textes d'Homicide Desk, dont les droits appartiennent à Shu'la Lab LLC.
  Ils sont fournis gratuitement, pour un usage avec une copie du jeu acquise légalement, et offerts
  au studio sans condition. La licence MIT ne s'applique pas à eux. À la demande du studio, ils
  seront retirés.
- Aucun fichier ni aucun texte du jeu n'est distribué : les textes du studio dont le patch a besoin
  sont désignés par empreinte et retrouvés dans la copie installée par le joueur.
- Projet de fan, sans lien avec Shu'la Lab LLC.

## Limites connues

- L'intégrité de l'archive n'est pas vérifiée par l'exécutable (fuse désactivé), c'est ce qui
  rend le patch possible. Une future version du jeu peut l'activer : le jeu refuserait alors
  l'archive patchée, `node patch.js --restore` remet l'original.
- Les bandes audio (messages vocaux, extrait d'antenne) n'existent qu'en anglais et en arabe. La
  transcription française s'affiche après l'écoute.
- Les réponses des suspects sont générées par un modèle local. Le prompt qu'il reçoit est
  entièrement français, mais la qualité du français produit dépend du modèle, que le jeu choisit
  selon la carte graphique. Trois comportements viennent du moteur du jeu et non de la traduction :
  un suspect nie même devant la preuve (consigne voulue par le studio), une pièce qu'on ne lui a
  pas posée sur la table ne lui est connue que par son nom et 140 caractères de description (en
  français, le patch ne lui transmet plus que les pièces déjà présentées, et une pièce présentée
  lui arrive en entier), et il ne peut rien affirmer hors de sa fiche.
- Les chaînes ajoutées reprennent la typographie du jeu (apostrophe droite dans les affaires,
  typographique dans le dictionnaire), sans tiret cadratin, retiré du jeu par le studio le 06/09.
