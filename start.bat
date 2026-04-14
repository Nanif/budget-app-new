@echo off
chcp 65001 > nul
title ניהול תקציב אישי

echo.
echo  ===================================
echo   ניהול תקציב אישי - מפעיל אפליקציה
echo  ===================================
echo.

REM טעינת הגדרות
if not exist "%~dp0config.bat" (
    echo שגיאה: קובץ config.bat חסר!
    echo נא לוודא שהקובץ config.bat נמצא בתיקיית הפרויקט.
    pause
    exit /b 1
)
call "%~dp0config.bat"

if "%SUPABASE_DATABASE_URL%"=="" (
    echo שגיאה: SUPABASE_DATABASE_URL חסר בקובץ config.bat
    pause
    exit /b 1
)

REM בדיקה שpnpm מותקן
where pnpm > nul 2>&1
if %errorlevel% neq 0 (
    echo מתקין pnpm...
    call npm install -g pnpm
    if %errorlevel% neq 0 (
        echo שגיאה בהתקנת pnpm. ודא ש-Node.js מותקן.
        pause
        exit /b 1
    )
    echo.
)

REM התקנת תלויות בפעם הראשונה
if not exist "%~dp0node_modules" (
    echo מתקין רכיבים - זה לוקח כמה דקות בפעם הראשונה...
    call pnpm install
    echo.
)

REM בנייה של שרת ה-API
if not exist "%~dp0artifacts\api-server\dist\index.mjs" (
    echo מכין את שרת ה-API...
    call pnpm --filter api-server run build
    echo.
)

REM הפעלת שרת ה-API בחלון נפרד
echo מפעיל שרת API...
start "API Server - אל תסגור" cmd /k "call \"%~dp0_run_api.bat\""

REM המתנה שהשרת יעלה
timeout /t 4 /nobreak > nul

REM הפעלת ממשק המשתמש בחלון נפרד
echo מפעיל ממשק משתמש...
start "Budget App - אל תסגור" cmd /k "call \"%~dp0_run_ui.bat\""

REM המתנה ופתיחת הדפדפן
echo ממתין לטעינה...
timeout /t 8 /nobreak > nul
echo פותח דפדפן...
start "" "http://localhost:3000"

echo.
echo  =========================================
echo   האפליקציה פועלת ב: http://localhost:3000
echo   לסגירה: סגור את שני החלונות הכהים
echo  =========================================
echo.
pause
