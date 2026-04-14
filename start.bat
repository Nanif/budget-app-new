@echo off
chcp 65001 > nul
cd /d "%~dp0"

if not exist "config.bat" (
    echo ERROR: config.bat not found in %~dp0
    pause
    exit /b 1
)

call config.bat

if "%SUPABASE_DATABASE_URL%"=="" if "%DB_HOST%"=="" (
    echo ERROR: No DB connection found in config.bat
    echo Please set either SUPABASE_DATABASE_URL or DB_HOST in config.bat
    pause
    exit /b 1
)

where pnpm > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing pnpm...
    call npm install -g pnpm
)

echo Running pnpm install...
call pnpm install

if not exist "artifacts\api-server\dist\index.mjs" (
    echo Building API server...
    call pnpm --filter api-server run build
)

start "API Server" cmd /k "call \"%~dp0_run_api.bat\""

timeout /t 4 /nobreak > nul

start "Frontend" cmd /k "call \"%~dp0_run_ui.bat\""

timeout /t 8 /nobreak > nul

start "" "http://localhost:3000"
