@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist "config.bat" (
    echo ERROR: config.bat not found in %~dp0
    pause
    exit /b 1
)

call config.bat

if "%SUPABASE_DATABASE_URL%"=="" (
    echo ERROR: SUPABASE_DATABASE_URL is not set in config.bat
    pause
    exit /b 1
)

where pnpm > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    call npm install -g pnpm
)

if not exist "node_modules" (
    echo Running pnpm install...
    call pnpm install
)

if not exist "artifacts\api-server\dist\index.mjs" (
    echo Building API server...
    call pnpm --filter api-server run build
)

start "API Server" cmd /k "cd /d "%~dp0" && call config.bat && set PORT=3001 && set NODE_ENV=production && node artifacts\api-server\dist\index.mjs"

timeout /t 4 /nobreak > nul

start "Frontend" cmd /k "cd /d "%~dp0" && pnpm --filter budget-app exec vite --config artifacts/budget-app/vite.config.local.ts"

timeout /t 8 /nobreak > nul

start "" "http://localhost:3000"
