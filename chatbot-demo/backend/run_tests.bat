@echo off
echo ===================================================
echo   Lancement des Tests de Regression Chatbot Externe
echo ===================================================
cd /d "%~dp0"
if not exist node_modules (
    echo Dossier node_modules non trouve. Installation des dependances...
    call npm install
)
echo Lancement de la suite de tests Express/Node...
call npm test
echo ===================================================
pause
