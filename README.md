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
| Texte affiché en anglais | 30 % du texte, et les affaires 005 et 006 jamais traduites | 0 % : les 7 affaires réécrites ou traduites en français naturel, relues face à l'anglais |
| Pièces à conviction | seul le nom était traduit (000 à 004) | nom, description et document complet en français |
| Radio, météo, terminal, fil du commissariat, base RPD-NET, relevé du compte | en anglais | en français |
| Ce que lit le modèle qui joue les suspects | 86,5 % d'anglais, et la question du tour envoyée deux fois | français, question envoyée une fois, 32 fiches de personnages traduites |
| Faits cachés des suspects | donnés au modèle dès la première question (110 sur 110 mesurés) | 1 sur 110 : chaque fait n'arrive qu'avec la pièce qui le révèle |
| Stress quand vous accusez | seuls les mots anglais comptaient : 0 point sur 48 questions françaises | 56 points (64 en anglais), « je vous ai vu » pèse sur le coupable |
| Icônes de réaction | neutres sur 98,7 % des gestes français | 1 % |
| Dates | bureau sans lien avec l'affaire, affaire 001 datée de 2024 | date et heure de l'affaire en cours, affaire 001 en 2020 |
| Attente par réplique, sur processeur (cas courant) | 38,6 s en moyenne, jusqu'à 168 s, 53 s en partie complète | 17,0 s en moyenne, jusqu'à 54 s, 13 s en partie complète |
| Mandat d'arrêt (accusation correcte, processeur) | 118 à 127 s, et refusé 2 fois sur 2 | 47 à 72 s, accepté 3 fois sur 3 |

Chiffres mesurés le 27/09/2026 sur le vrai code des deux versions (jeu Steam build 25152927 contre
patch 1.2.4), à méthode identique : détail et méthode dans « Étude comparative » plus bas. Avec la
puce graphique activée (réglage facultatif), les attentes sont encore divisées par 2 à 3.

En option, l'installateur propose **Gemma 3 4B** (3,3 Go, téléchargé une seule fois), qui joue les
suspects bien mieux en français que le modèle livré. Une carte graphique qui fait déjà tourner le
modèle 12B du jeu le garde.

### Installer

1. Téléchargez `HomicideDeskFR-1.2.4.zip` dans les **Releases** de ce dépôt.
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

### Nouveautés de la 1.2.4 (27/09/2026)

Les 1.2.2 et 1.2.3 n'ont jamais été publiées : la 1.2.4 les remplace et reprend tout leur contenu.

- **Dates cohérentes** : pendant une affaire, le bureau affiche la date et l'heure de l'affaire, puis le
  temps s'écoule normalement (sauvegarde comprise). L'affaire 001, seule de la série en 2024 dans la
  version d'origine, est ramenée en 2020 avec toutes ses pièces. Plusieurs dates et heures
  contradictoires entre documents sont corrigées (courriels envoyés avant la découverte du corps,
  créneau du meurtre, nuits supprimées, photo du hall), toutes déclarées au studio.

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
- **Détails corrigés** : bracelet de la montre Longines en cuir noir comme le modèle 3D, « interrogatoire »
  pour les suspects et « audition » pour les témoins, certificat d'habilitation tamponné « HABILITÉ »
  et non plus « PREUVE », en-tête « POLICE DE RAVENPORT » reconnu sur les documents.

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
prompt for the local model that plays the suspects (the original sends 86,5 % English and hands
every hidden fact to the model up front), replies about twice as fast on a plain CPU (38,6 s to
17,0 s on average), consistent dates, and the English-only stress keywords and reaction gestures
given French equivalents. Download the zip from Releases, run `Installer le patch FR.bat`. No game text is
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
  Avec le prompt d'origine, anglais à 86,5 % (mesuré sur 52 interrogatoires), les personnages répondaient dans un français
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
   - préchauffage : le moteur lit ce que la question enverra dès que le joueur choisit un suspect,
     épingle une pièce ou tape sa question, avec l'humeur que la question provoquera. Une vraie
     question interrompt tout préchauffage en cours. Le dossier du mandat d'arrêt est lu pendant la
     rédaction de la conclusion.
   - cache complet du moteur (`LLAMA_ARG_SWA_FULL`, Gemma 4B) : il reprend là où il en était, y
     compris au retour sur un suspect déjà interrogé. Aucun jeton changé (80 sur 80 en décodage
     glouton).
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

## Étude comparative : VF du studio contre patch 1.2.4 (27/09/2026)

Le jeu a été réinstallé proprement depuis Steam (build 25152927, archive identique à l'octet près à
celle du studio) pour servir de référence. Chaque mesure est faite **à méthode identique des deux
côtés**, sur le **vrai code** du jeu : un harnais charge le `bundle.js` et le `localAI.js` réels
(celui du studio, puis celui du patch), joue les scénarios comme un joueur, et parle au vrai moteur
Ollama livré avec le jeu. Machine : Core Ultra 7 155U, 32 Go, puce Intel intégrée.

### Texte affiché et texte envoyé au modèle

| Mesure | VF du studio | Patch 1.2.4 |
|---|---|---|
| Texte affiché resté en anglais (hors fiches RPD-NET générées) | 30,2 % des caractères | 0,1 % (faux positifs : noms propres) |
| Affaires 005 et 006 en français | aucune langue autre que l'anglais | traduites entièrement (932 chaînes) |
| Fiches RPD-NET générées (680) | 94 % des mots en anglais | français |
| Mots anglais dans le prompt système envoyé au modèle (52 scénarios) | 86,5 % | 0,4 % (faux positifs) |
| Question du tour envoyée au modèle | 2 fois (184 requêtes sur 184) | 1 fois |
| Pièces listées au modèle dès la 1re question | toutes celles ramassées (11,5 en moyenne) | celles déjà montrées |
| Faits cachés présents dans le prompt avant la pièce qui les révèle | 110 sur 110 | 1 sur 110 (un nom généré par le jeu) |
| Erreurs de typographie (« Serrure: saisie »), dates au format anglais | 111 et 42 | 0 et 0 |

### Mécaniques

| Mesure | VF du studio | Patch 1.2.4 |
|---|---|---|
| Stress gagné par les mots-clés sur 48 questions françaises (anglais : 64) | 0 | 56 |
| « Je vous ai vu… » face au coupable | 0 point | 8 points, et 0 face aux autres (choix de l'auteur) |
| Stress total sur 52 scénarios, départ à 0 | 848 | 1 180 |
| Icônes de réaction neutres sur des gestes français | 98,7 % | 1 % |
| Date du bureau | en anglais, liée au jour réel, identique pour toutes les affaires | date et heure de l'affaire en cours |
| Affaire 001 | datée de 2024, les six autres de 2020 | 2020, jours de la semaine conservés |

Une mécanique reste muette des deux côtés : le carnet qui relève les contradictions cherche des
mots de déni anglais, qu'aucune réplique française ne contient.

### Vitesse (vrai moteur, 5 configurations, 2 tirages chacune, 24 scénarios de 4 affaires)

Sans réglage, le moteur tourne sur le **processeur** : c'est le cas courant, chez le studio comme
avec le patch. La puce graphique intégrée n'est utilisée que si le joueur l'active (réglage
facultatif plus haut).

| Configuration | Attente moyenne / médiane / pire | Partie complète | Mandat d'arrêt |
|---|---|---|---|
| **VF du studio** (Qwen 4B, processeur) | 38,6 / 21,4 / 168,5 s | 53,1 s | 118 à 127 s, accusation correcte refusée |
| **Patch 1.2.4** (Gemma 4B, processeur) | **17,0 / 12,8 / 53,7 s** | **13,3 s** | **47 à 72 s, acceptée** |
| Contrôle : VF du studio sur puce graphique | 13,9 s | 19,0 s | 38 s |
| Contrôle : patch avec Qwen 4B sur puce graphique | 10,8 s | 8,9 s | 10,8 s, refusée |
| Patch 1.2.4 sur puce graphique | 9,4 s | 7,6 s | 8,5 s, acceptée |

Ce que disent les configurations de contrôle :
- **La puce graphique** divise l'attente par 2,5 à 3. C'est le plus gros levier, mais c'est un réglage
  du joueur, pas un effet du patch.
- **Le code du patch, à modèle égal** (Qwen sur la puce) : 0 réplique avec de l'anglais au lieu de
  33 sur 158, 0 fuite de fait caché au lieu de 11, trois fois moins de texte relu par question, mandat
  3,5 fois plus rapide. C'est bien le patch, et non le modèle, qui supprime l'anglais et les fuites.
- **Le modèle** : Qwen 4B refuse l'accusation correcte au mandat, avec ou sans patch. Gemma 4B
  l'accepte. Gemma est aussi un peu plus rapide et utilise moins de mémoire (6,3 Go contre 8,8 Go
  pour le studio en fin de série).

Réplique au joueur type, patch contre studio : 0 contre 45 répliques sur 158 contenant de l'anglais,
0 contre 11 fuites de faits cachés, 0 aveu des deux côtés, 0 erreur du moteur des deux côtés.

### Qualité des répliques

Comparer le studio et le patch **à l'aveugle** est impossible : les répliques du studio se
reconnaissent à leur anglais. Les mesures ci-dessus (langue, fuites, mandat) suffisent à les
départager.

Entre Gemma 4B et Qwen 4B, **à code du patch égal**, un jugement automatisé à l'aveugle et étalonné
(24 scénarios, 2 juges par dossier, deux contrôles « même modèle contre lui-même » non
significatifs, règle de décision fixée avant de voir les notes) n'a **pas départagé** les deux
modèles (p = 0,069). Les tests de l'auteur, francophone natif, donnent Gemma nettement meilleur en
français naturel, et Gemma garde les avantages mesurés : secrets mieux tenus, mandat accepté,
vitesse, mémoire. Gemma 4B reste donc le modèle proposé.

### Ce que le patch coûte

Environ 4,2 Go de disque : la copie d'origine du jeu (0,86 Go) et Gemma 4B (3,34 Go, facultatif).
« Retirer le patch FR » rend tout, sauf un fichier de 28 octets que le jeu ne lit pas.

### Limites de l'étude

Une seule machine. Affaires 000, 002 et 004 non jouées sur le moteur. Deux tirages par scénario.
Le patch sur processeur a été mesuré en dernier, processeur déjà chaud : son gain est plutôt
sous-estimé. Les mesures mécaniques (texte, prompt, faits cachés, stress) ne dépendent pas du
modèle et portent sur les 52 scénarios.

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
et parfois absurde. D'où le choix de le proposer aux joueurs francophones. L'étude du 27/09 (plus haut) confirme ses
avantages mesurables, dont l'accusation correcte acceptée au mandat, que Qwen 4B refuse.

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
