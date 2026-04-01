@echo off
title GhostPilot Setup
cd /d "%~dp0"
echo Installing dependencies...
call npm install
echo.
echo Done! Launching GhostPilot...
echo.
echo  Alt+Shift+G  =  Toggle show/hide
echo  Alt+Shift+H  =  Panic hide
echo  Alt+Shift+1  =  ChatGPT
echo  Alt+Shift+2  =  Claude
echo  Alt+Shift+3  =  Google
echo  Alt+Shift+4  =  Gemini
echo  Alt+Shift+R  =  Reload
echo  Alt+Shift+Up/Down = Opacity
echo.
set ELECTRON_RUN_AS_NODE=
node_modules\electron\dist\electron.exe .
