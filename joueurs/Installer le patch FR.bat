@echo off
chcp 65001 >nul
title Patch français de Homicide Desk
rem Double-clic : installe le patch français. Tout le travail est fait par fichiers\outils\installateur.ps1.
if not exist "%~dp0fichiers\outils\installateur.ps1" goto pas_decompresse
rem PSModulePath vide : lancé depuis un terminal PowerShell 7, Windows PowerShell 5.1 hériterait
rem des modules de la version 7, qu'il ne sait pas charger. Vide, il reprend ses chemins par défaut.
set "PSModulePath="
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0fichiers\outils\installateur.ps1" -Action installer %*
exit /b %errorlevel%

:pas_decompresse
echo.
echo  Ce fichier doit être lancé depuis le dossier décompressé du patch.
echo.
echo  1. Fermez cette fenêtre.
echo  2. Faites un clic droit sur le fichier zip du patch, puis « Extraire tout ».
echo  3. Dans le dossier obtenu, double-cliquez sur « Installer le patch FR ».
echo.
pause
exit /b 1
