@echo off
chcp 65001 > nul
title Frontend - Budget App
cd /d "%~dp0artifacts\budget-app"
echo Frontend starting on http://localhost:3000 ...
echo Proxy: /api  --^>  http://localhost:3001
pnpm exec vite --config vite.config.local.ts
pause
