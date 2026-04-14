@echo off
chcp 65001 > nul
title Frontend - Budget App
cd /d "%~dp0"
echo Frontend starting on http://localhost:3000 ...
pnpm --filter budget-app exec vite --config artifacts/budget-app/vite.config.local.ts
pause
