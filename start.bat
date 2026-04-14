@echo off
chcp 65001 > nul
title ניהול תקציב אישי

echo.
echo  ===================================
echo   ניהול תקציב אישי - מפעיל אפליקציה
echo  ===================================
echo.

REM טעינת הגדרות (כתובת בסיס הנתונים)
if not exist "config.bat" (
    echo שגיאה: קובץ config.bat חסר!
    echo נא לוודא שהקובץ config.bat נמצא באותה תיקייה.
    pause
    exit /b 1
)
call config.bat

REM בדיקה שהגדרות נטענו
if "%SUPABASE_DATABASE_URL%"=="" (
    echo שגיאה: כתובת בסיס הנתונים חסרה בקובץ config.bat
    pause
    exit /b 1
)

REM בדיקה שpnpm מותקן
where pnpm > nul 2>&1
if %errorlevel% neq 0 (
    echo מתקין pnpm...
    call npm install -g pnpm
    echo.
)

REM התקנת תלויות בפעם הראשונה
if not exist "node_modules" (
    echo מתקין את כל הרכיבים - זה לוקח כמה דקות בפעם הראשונה...
    call pnpm install
    echo.
)

REM בנייה של שרת ה-API
if not exist "artifacts\api-server\dist\index.mjs" (
    echo מכין את שרת ה-API...
    cd artifacts\api-server
    call pnpm run build
    cd ..\..
    echo.
)

REM הפעלת שרת ה-API בחלון נפרד
echo מפעיל שרת API...
start "API Server - אל תסגור חלון זה" cmd /k "set SUPABASE_DATABASE_URL=%SUPABASE_DATABASE_URL% && set PORT=3001 && set NODE_ENV=production && node artifacts\api-server\dist\index.mjs"

REM המתנה שהשרת יעלה
timeout /t 4 /nobreak > nul

REM הפעלת ממשק המשתמש בחלון נפרד
echo מפעיל ממשק משתמש...
start "Budget App UI - אל תסגור חלון זה" cmd /k "set PORT=3000 && set BASE_PATH=/ && pnpm --filter budget-app exec vite --config vite.config.local.ts"

REM המתנה ופתיחת הדפדפן
echo ממתין לטעינה...
timeout /t 8 /nobreak > nul
echo פותח את האפליקציה בדפדפן...
start "" "http://localhost:3000"

echo.
echo  ===================================
echo   האפליקציה פועלת!
echo   לסגירה: סגור את שני החלונות הכהים
echo  ===================================
echo.
pause
