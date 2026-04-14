@echo off
chcp 65001 > nul
title Budget App UI
echo Frontend starting on http://localhost:3000 ...
cd /d "%~dp0"
pnpm --filter budget-app exec vite --config vite.config.local.ts
pause
