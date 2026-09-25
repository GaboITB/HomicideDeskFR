# Installateur en double-clic du patch français de Homicide Desk.
# Lancé par « Installer le patch FR.bat » ou « Retirer le patch FR.bat », avec le Node portable
# fourni dans le paquet : le joueur n'a rien à installer ni à taper.
#
#   -Action installer   trouve le jeu, vérifie qu'il est fermé et la place disque, applique le patch
#   -Action retirer     remet le jeu d'origine
#   -Action detecter    affiche le dossier du jeu trouvé, sans rien modifier
#   -Jeu "<dossier>"    impose le dossier du jeu au lieu de le chercher dans Steam
#
# HDFR_SANS_PAUSE=1 supprime les attentes au clavier (tests automatiques).
param(
  [ValidateSet('installer', 'retirer', 'detecter')] [string]$Action = 'installer',
  [string]$Jeu = ''
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
try { $Host.UI.RawUI.WindowTitle = 'Patch français de Homicide Desk' } catch {}

$ICI = Split-Path -Parent $PSScriptRoot           # le dossier « fichiers »
$NODE = Join-Path $ICI 'node\node.exe'
$PATCH = Join-Path $ICI 'patch.js'
$JOURNAL = Join-Path $ICI 'journal.txt'
$APPID = '4935210'
$SansPause = $env:HDFR_SANS_PAUSE -eq '1'

function Attendre-Fin {
  if (-not $SansPause) { Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer cette fenêtre' | Out-Null }
}
function Etape([int]$n, [int]$total, [string]$texte) {
  Write-Host ''
  Write-Host ("Étape {0} sur {1} : {2}" -f $n, $total, $texte) -ForegroundColor Cyan
}
function Echec([string]$texte) {
  Write-Host ''
  Write-Host $texte -ForegroundColor Red
  if (Test-Path $JOURNAL) { Write-Host "Le détail se trouve dans : $JOURNAL" }
  Attendre-Fin
  exit 1
}
function Journal([string]$ligne) {
  Add-Content -LiteralPath $JOURNAL -Value $ligne -Encoding UTF8
}

# --- où est le jeu ? ------------------------------------------------------------------------------
# Steam note son dossier dans le registre, puis ses bibliothèques (un jeu peut être sur un autre
# disque) dans libraryfolders.vdf. Le manifeste appmanifest_<appid>.acf dit dans laquelle est le jeu.
function Trouver-Jeu {
  $racines = @()
  foreach ($cle in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam', 'HKLM:\SOFTWARE\Valve\Steam') {
    try {
      $p = Get-ItemProperty -LiteralPath $cle -ErrorAction Stop
      foreach ($nom in 'SteamPath', 'InstallPath') { if ($p.$nom) { $racines += ($p.$nom -replace '/', '\') } }
    } catch {}
  }
  $bibliotheques = @($racines)
  foreach ($steam in $racines) {
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
      $texte = Get-Content -LiteralPath $vdf -Raw -Encoding UTF8
      foreach ($m in [regex]::Matches($texte, '"path"\s+"([^"]+)"')) {
        $bibliotheques += ($m.Groups[1].Value -replace '\\\\', '\')
      }
    }
  }
  foreach ($bib in ($bibliotheques | Select-Object -Unique)) {
    $acf = Join-Path $bib "steamapps\appmanifest_$APPID.acf"
    if (-not (Test-Path -LiteralPath $acf)) { continue }
    $dossier = 'Homicide Desk'
    $m = [regex]::Match((Get-Content -LiteralPath $acf -Raw -Encoding UTF8), '"installdir"\s+"([^"]+)"')
    if ($m.Success) { $dossier = $m.Groups[1].Value }
    $chemin = Join-Path $bib ('steamapps\common\' + $dossier)
    if (Test-Path -LiteralPath (Join-Path $chemin 'resources\app.asar')) { return $chemin }
  }
  return $null
}

function Choisir-Jeu {
  Add-Type -AssemblyName System.Windows.Forms
  $d = New-Object System.Windows.Forms.FolderBrowserDialog
  $d.Description = "Homicide Desk n'a pas été trouvé automatiquement. Choisissez son dossier, celui qui contient « Homicide Desk.exe »."
  $d.ShowNewFolderButton = $false
  if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { return $d.SelectedPath }
  return $null
}

function Est-JeuValide([string]$chemin) {
  return $chemin -and (Test-Path -LiteralPath (Join-Path $chemin 'resources\app.asar'))
}

# --- le jeu doit être fermé ----------------------------------------------------------------------
# Les processus lancés depuis le dossier du jeu. Un « Homicide Desk.exe » dont Windows ne donne pas
# le chemin (lancé en administrateur) compte aussi, par prudence.
function Processus-Du-Jeu([string]$chemin) {
  $dossier = $chemin.TrimEnd('\') + '\'
  Get-CimInstance Win32_Process | Where-Object {
    if ($_.ExecutablePath) { $_.ExecutablePath.StartsWith($dossier, [StringComparison]::OrdinalIgnoreCase) }
    else { $_.Name -eq 'Homicide Desk.exe' }
  }
}

function Octets-Libres([string]$chemin) {
  $racine = [IO.Path]::GetPathRoot((Resolve-Path -LiteralPath $chemin).Path)
  return (New-Object IO.DriveInfo($racine)).AvailableFreeSpace
}

# --- lancement de patch.js, écran et journal -----------------------------------------------------
function Lancer-Patch([string]$argument) {
  $env:HD_GAME_DIR = $script:DossierJeu
  $attention = 0
  $ErrorActionPreference = 'Continue'   # les messages de Node sur stderr ne sont pas des pannes
  # Le détail technique va au journal. À l'écran : un compteur sur une ligne, et seulement les
  # avertissements et les erreurs en clair.
  $n = 0
  $tours = '|/-\'
  & $NODE $PATCH $argument 2>&1 | ForEach-Object {
    $ligne = "$_"
    Journal $ligne
    $n++
    if ($ligne -match 'ATTENTION|ERREUR') {
      Write-Host ''
      if ($ligne -match 'ATTENTION') { $attention++; Write-Host $ligne -ForegroundColor Yellow }
      else { Write-Host $ligne -ForegroundColor Red }
    } else {
      Write-Host ("`r  {0} travail en cours : {1} opérations" -f $tours[$n % 4], $n) -NoNewline -ForegroundColor DarkGray
    }
  }
  $code = $LASTEXITCODE
  Write-Host ("`r  Terminé. Le détail est dans journal.txt").PadRight(78) -ForegroundColor DarkGray
  $ErrorActionPreference = 'Stop'
  return @{ Code = $code; Attention = $attention }
}

# --- modèle Gemma 4B (outils/modele.js), facultatif ----------------------------------------------
# Téléchargé par le moteur Ollama du jeu depuis le registre Ollama. Sans lui, le jeu garde son
# modèle d'origine. HDFR_GEMMA=0 ou 1 répond à la question sans clavier (tests automatiques).
function Ligne-Info([string]$titre, [string]$texte) {
  Write-Host ('    {0,-10} ' -f $titre) -NoNewline -ForegroundColor DarkGray
  Write-Host $texte
}

$FR = [Globalization.CultureInfo]::GetCultureInfo('fr-FR')
# Barre de téléchargement redessinée sur place (retour chariot), avec vitesse et temps restant.
# Le journal ne garde qu'une ligne tous les 10 %.
function Dessiner-Barre([int]$pc, [double]$fait, [double]$total, [double]$vitesse) {
  $largeur = 24
  $plein = [Math]::Min($largeur, [Math]::Floor($largeur * $pc / 100))
  $barre = ([string][char]0x2588) * $plein + ([string][char]0x2591) * ($largeur - $plein)
  $texte = '  {0} {1,3} %  {2} / {3} Go' -f $barre, $pc, ($fait / 1e9).ToString('0.00', $FR), ($total / 1e9).ToString('0.00', $FR)
  if ($vitesse -gt 0 -and $fait -lt $total) {
    $texte += '  {0} Mo/s' -f ($vitesse / 1e6).ToString('0.0', $FR)
    $s = ($total - $fait) / $vitesse
    if ($s -ge 90) { $texte += '  encore {0} min' -f [Math]::Ceiling($s / 60) }
    else { $texte += '  encore {0} s' -f [Math]::Max(1, [Math]::Ceiling($s)) }
  }
  Write-Host ("`r" + $texte.PadRight(78)) -NoNewline -ForegroundColor Cyan
  $script:BarreActive = $true
  $palier = [Math]::Floor($pc / 10) * 10
  if ($palier -gt $script:PalierJournal) {
    $script:PalierJournal = $palier
    Journal ("téléchargement : {0} % ({1} Go)" -f $pc, ($fait / 1e9).ToString('0.00', $FR))
  }
}
function Fermer-Barre {
  if ($script:BarreActive) { Write-Host ''; $script:BarreActive = $false }
}

function Lancer-Modele([string]$action) {
  $ErrorActionPreference = 'Continue'
  $debut = Get-Date
  Journal ("modele.js {0} : début {1:HH:mm:ss}" -f $action, $debut)
  $env:HDFR_BARRE = '1'
  $script:BarreActive = $false
  $script:PalierJournal = -1
  & $NODE (Join-Path $ICI 'outils\modele.js') $action $script:DossierJeu 2>&1 | ForEach-Object {
    $ligne = "$_"
    if ($ligne -match '^@@progres (\d+) (\d+) (\d+) (\d+)') {
      Dessiner-Barre ([int]$Matches[1]) ([double]$Matches[2]) ([double]$Matches[3]) ([double]$Matches[4])
    } elseif ($ligne -eq '@@fin') {
      Fermer-Barre
    } elseif ($ligne -match '^@@journal (.*)$') {
      Journal $Matches[1]
    } else {
      Fermer-Barre
      Journal $ligne
      if ($ligne -match 'ERREUR') { Write-Host $ligne -ForegroundColor Yellow }
      elseif ($ligne -match 'est prêt|déjà installé') { Write-Host $ligne -ForegroundColor Green }
      else { Write-Host $ligne }
    }
  }
  $code = $LASTEXITCODE
  Fermer-Barre
  Remove-Item Env:HDFR_BARRE -ErrorAction SilentlyContinue
  $ErrorActionPreference = 'Stop'
  Journal ("modele.js {0} : fin {1:HH:mm:ss}, code {2}, durée {3:N1} min" -f $action, (Get-Date), $code, ((Get-Date) - $debut).TotalMinutes)
  return $code
}

# Mémoire de la plus grosse carte NVIDIA en Mo, 0 sans carte NVIDIA : même mesure que le jeu
# (localAI.js, detectVramMB : nvidia-smi, 8 secondes au plus). HDFR_VRAM_MO l'impose (tests).
function Memoire-Carte-Mo {
  if ($env:HDFR_VRAM_MO) { return [int]$env:HDFR_VRAM_MO }
  $smi = Get-Command 'nvidia-smi' -ErrorAction SilentlyContinue
  if (-not $smi) { return 0 }
  try {
    $psi = New-Object Diagnostics.ProcessStartInfo $smi.Source, '--query-gpu=memory.total --format=csv,noheader,nounits'
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.CreateNoWindow = $true
    $p = [Diagnostics.Process]::Start($psi)
    $sortie = $p.StandardOutput.ReadToEndAsync()
    if (-not $p.WaitForExit(8000)) { try { $p.Kill() } catch {} ; return 0 }
    if ($p.ExitCode -ne 0) { return 0 }
    $tailles = @($sortie.Result -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ })
    if ($tailles.Count -eq 0) { return 0 }
    return ($tailles | Measure-Object -Maximum).Maximum
  } catch { return 0 }
}

# =================================================================================================
Set-Content -LiteralPath $JOURNAL -Value ("Patch français de Homicide Desk, {0}, action : {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $Action) -Encoding UTF8

Write-Host ''
Write-Host '   ██████╗  █████╗ ██████╗  ██████╗ ██╗      █████╗ ██████╗ ███████╗' -ForegroundColor Cyan
Write-Host '  ██╔════╝ ██╔══██╗██╔══██╗██╔═══██╗██║     ██╔══██╗██╔══██╗██╔════╝' -ForegroundColor Cyan
Write-Host '  ██║  ███╗███████║██████╔╝██║   ██║██║     ███████║██████╔╝███████╗' -ForegroundColor Cyan
Write-Host '  ██║   ██║██╔══██║██╔══██╗██║   ██║██║     ██╔══██║██╔══██╗╚════██║' -ForegroundColor DarkCyan
Write-Host '  ╚██████╔╝██║  ██║██████╔╝╚██████╔╝███████╗██║  ██║██████╔╝███████║' -ForegroundColor DarkCyan
Write-Host '   ╚═════╝ ╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═════╝ ╚══════╝' -ForegroundColor DarkCyan
$version = try { (Get-Content -Raw -LiteralPath (Join-Path $ICI 'package.json') | ConvertFrom-Json).version } catch { '' }
Write-Host ''
Write-Host ('  Patch français de Homicide Desk' + $(if ($version) { "  ·  version $version" } else { '' })) -ForegroundColor White
Write-Host '  Projet de fan, gratuit, sans lien avec Shu''la Lab' -ForegroundColor DarkGray

if ((Test-Path -LiteralPath $NODE) -and -not (Test-Path -LiteralPath $PATCH)) {
  # patch.js seul a disparu alors que node.exe est là : un antivirus a pu le mettre de côté.
  Journal "patch.js absent alors que node.exe est présent : mis de côté par un antivirus ?"
  $conseil = if ($Action -eq 'retirer') {
    "Pour remettre le jeu d'origine sans ce fichier : dans Steam, clic droit sur Homicide Desk, Propriétés, Fichiers installés, « Vérifier l'intégrité des fichiers »."
  } else {
    "Pour le récupérer : Sécurité Windows, Protection contre les virus et menaces, Historique de protection, choisissez l'élément « patch.js », puis Actions, Restaurer. Ou décompressez à nouveau le zip."
  }
  Echec ("Le fichier « patch.js » a disparu du dossier du patch. Un antivirus a pu le mettre de côté par " +
    "précaution : ce script ne fait que traduire le jeu.`n" + $conseil)
}
if (-not (Test-Path -LiteralPath $NODE) -or -not (Test-Path -LiteralPath $PATCH)) {
  Echec "Des fichiers du patch manquent. Supprimez ce dossier, décompressez à nouveau le fichier zip (clic droit, « Extraire tout »), puis relancez."
}

$total = if ($Action -eq 'installer') { 5 } else { 3 }

Etape 1 $total 'recherche du jeu'
$script:DossierJeu = $null
if ($Jeu) {
  if (-not (Est-JeuValide $Jeu)) { Echec "Le dossier indiqué ne contient pas Homicide Desk : $Jeu" }
  $script:DossierJeu = (Resolve-Path -LiteralPath $Jeu).Path
} else {
  $script:DossierJeu = Trouver-Jeu
  if (-not $script:DossierJeu) {
    Write-Host "Homicide Desk n'a pas été trouvé dans Steam. Une fenêtre va s'ouvrir pour que vous indiquiez son dossier." -ForegroundColor Yellow
    $choix = Choisir-Jeu
    if (-not $choix) { Echec "Aucun dossier choisi : l'installation est annulée, rien n'a été modifié." }
    if (-not (Est-JeuValide $choix)) { Echec "Ce dossier ne contient pas Homicide Desk (il doit contenir « Homicide Desk.exe » et un sous-dossier « resources »)." }
    $script:DossierJeu = $choix
  }
}
Write-Host "Jeu trouvé : $($script:DossierJeu)"
Journal "jeu : $($script:DossierJeu)"
if ($Action -eq 'detecter') { exit 0 }

Etape 2 $total 'vérification que le jeu est fermé'
while (Processus-Du-Jeu $script:DossierJeu | Where-Object { $_.Name -eq 'Homicide Desk.exe' }) {
  if ($SansPause) { Echec 'Homicide Desk est ouvert. Fermez-le, puis relancez.' }
  Write-Host 'Homicide Desk est ouvert. Fermez complètement le jeu,' -ForegroundColor Yellow
  Read-Host 'puis appuyez sur Entrée' | Out-Null
}
# Le moteur d'IA du jeu survit parfois à sa fermeture (et Steam croit alors le jeu encore lancé).
foreach ($p in (Processus-Du-Jeu $script:DossierJeu)) {
  Journal ("arrêt d'un processus resté ouvert : {0} ({1})" -f $p.Name, $p.ProcessId)
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Milliseconds 500
Write-Host 'Le jeu est fermé.'

if ($Action -eq 'installer') {
  Etape 3 $total "vérification de la place disponible"
  $Go = 1GB
  $iciLibre = Octets-Libres $ICI
  $jeuLibre = Octets-Libres $script:DossierJeu
  Journal ("place libre : patch {0:N1} Go, jeu {1:N1} Go" -f ($iciLibre / $Go), ($jeuLibre / $Go))
  if ($iciLibre -lt 2.2 * $Go) { Echec ("Il faut environ 2,2 Go libres sur le disque où se trouve ce dossier, il n'y en a que {0:N1}. Libérez de la place ou déplacez le dossier du patch sur un autre disque." -f ($iciLibre / $Go)) }
  if ($jeuLibre -lt 1 * $Go) { Echec ("Il faut environ 1 Go libre sur le disque du jeu pour sa copie de sauvegarde, il n'y en a que {0:N1}." -f ($jeuLibre / $Go)) }
  Write-Host 'Place suffisante.'

  Etape 4 $total 'installation du patch (1 à 5 minutes, ne fermez pas cette fenêtre)'
  $r = Lancer-Patch '--reinstaller'
  if ($r.Code -ne 0) {
    Echec ("L'installation n'a pas abouti. Votre jeu est resté (ou revenu) tel que Steam l'a installé.`n" +
      "S'il ne démarrait plus : dans Steam, clic droit sur Homicide Desk, Propriétés, Fichiers installés, « Vérifier l'intégrité des fichiers ».")
  }
  Write-Host ''
  Write-Host "Le patch français est installé." -ForegroundColor Green

  Etape 5 $total "modèle d'IA pour le français (facultatif)"
  $gemmaMsg = ''
  # Présence lue directement dans le magasin du jeu : instantané, sans démarrer le moteur.
  $bibliotheque = Join-Path $script:DossierJeu 'resources\ollama-models\manifests\registry.ollama.ai\library'
  $manifeste = Join-Path $bibliotheque 'homicide-gemma4b\latest'
  # Le jeu préfère Gemma 12B (livré par le studio) dès que la carte a 10 000 Mo : SMART_MIN_VRAM_MB.
  $carteMo = Memoire-Carte-Mo
  $gemma12 = ($carteMo -ge 10000) -and (Test-Path -LiteralPath (Join-Path $bibliotheque 'homicide-gemma12b\latest'))
  Journal "Carte NVIDIA : $carteMo Mo, Gemma 12B utilisable : $gemma12"
  if (Test-Path -LiteralPath $manifeste) {
    $null = Lancer-Modele 'installer'   # déjà présent : remet la préférence française sans rien télécharger
  } elseif ($gemma12) {
    Write-Host ("Votre carte graphique ({0:N0} Go) fait tourner Gemma 12B, le meilleur modèle livré avec le jeu." -f ($carteMo / 1024))
    Write-Host 'Le jeu le choisit tout seul : Gemma 4B ne servirait pas, rien à télécharger.' -ForegroundColor Green
    Journal 'Gemma 4B non proposé : Gemma 12B utilisable'
  } else {
    Write-Host 'Les suspects sont joués par une intelligence artificielle qui tourne sur votre ordinateur.'
    Write-Host 'En français, Gemma 4B les rend bien plus vivants et naturels que le modèle d''origine.'
    Write-Host ''
    Ligne-Info 'Taille' '3,3 Go, téléchargés une seule fois'
    Ligne-Info 'Durée' '5 min à 100 Mbit/s, 25 min à 20 Mbit/s, 1 h à 8 Mbit/s'
    Ligne-Info 'Sans lui' 'le jeu garde son modèle d''origine (Qwen 4B), qui fonctionne aussi'
    Ligne-Info 'Plus tard' 'relancez « Installer le patch FR » pour l''ajouter'
    Write-Host ''
    if ($SansPause) { $rep = if ($env:HDFR_GEMMA -eq '0') { 'n' } else { 'o' } }
    else { $rep = Read-Host 'Télécharger Gemma 4B ? O = oui, N = non (Entrée = oui)' }
    Journal "Gemma 4B demandé : $rep"
    if ($rep -match '^\s*[nN]') {
      $gemmaMsg = 'Gemma 4B non installé : vous pourrez relancer « Installer le patch FR » plus tard pour l''ajouter.'
    } elseif ((Octets-Libres $script:DossierJeu) -lt 4 * $Go) {
      $gemmaMsg = ("Pas assez de place sur le disque du jeu pour Gemma 4B (il faut environ 4 Go, il y en a {0:N1}). Le jeu garde son modèle d'origine." -f ((Octets-Libres $script:DossierJeu) / $Go))
    } elseif ((Lancer-Modele 'installer') -ne 0) {
      $gemmaMsg = "Gemma 4B n'a pas pu être installé (connexion Internet ?). Le patch fonctionne avec le modèle d'origine, et vous pourrez relancer « Installer le patch FR » plus tard."
    }
  }
  if ($gemmaMsg) { Write-Host $gemmaMsg -ForegroundColor Yellow }

  Write-Host ''
  Write-Host "C'est fait ! Le patch français est installé." -ForegroundColor Green
  if ($r.Attention) {
    Write-Host "Quelques textes n'ont pas pu être traduits, sans doute parce que le jeu a été mis à jour. Tout le reste l'est." -ForegroundColor Yellow
    Write-Host "Pour le signaler, joignez le fichier : $JOURNAL" -ForegroundColor Yellow
  }
  Write-Host ''
  Write-Host '  1. Lancez Homicide Desk depuis Steam.'
  Write-Host '  2. Dans les paramètres du jeu, choisissez « Français ».'
  Write-Host ''
  Write-Host "Après une mise à jour du jeu par Steam, le patch disparaît : relancez simplement « Installer le patch FR »."
  Attendre-Fin
  exit 0
}

# --- retirer --------------------------------------------------------------------------------------
Etape 3 $total 'remise du jeu d''origine'
# Gemma 4B d'abord, s'il a été ajouté par le patch : rend environ 3,3 Go (sans effet sinon).
$null = Lancer-Modele 'retirer'
$r = Lancer-Patch '--restore'
if ($r.Code -eq 0) {
  Write-Host ''
  Write-Host "C'est fait : le jeu est revenu à sa version d'origine." -ForegroundColor Green
  Attendre-Fin
  exit 0
}
$detail = Get-Content -LiteralPath $JOURNAL -Raw -Encoding UTF8
if ($detail -match "n'est pas patché") {
  Write-Host ''
  Write-Host "Le patch n'est pas installé (ou Steam l'a déjà retiré lors d'une mise à jour) : rien à faire." -ForegroundColor Green
  Attendre-Fin
  exit 0
}
Echec ("Le jeu n'a pas pu être remis d'origine automatiquement.`n" +
  "Dans Steam : clic droit sur Homicide Desk, Propriétés, Fichiers installés, « Vérifier l'intégrité des fichiers ». Steam remet alors le jeu d'origine.")
