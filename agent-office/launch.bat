@echo off
title Agent Office Dashboard
cd /d "%~dp0"
echo.
echo   Agent Office Dashboard
echo   Starting server on http://localhost:3747 ...
echo.
start "" "http://localhost:3747"
node server.js
