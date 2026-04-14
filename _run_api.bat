@echo off
chcp 65001 > nul
title API Server
cd /d "%~dp0"
call "%~dp0config.bat"
set PORT=3001
set NODE_ENV=development
echo API Server starting on port 3001...
node "%~dp0artifacts\api-server\dist\index.mjs"
pause
