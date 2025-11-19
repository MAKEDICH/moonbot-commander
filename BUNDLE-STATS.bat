@echo off
chcp 65001 > nul
title Bundle Statistics - MoonBot Commander
color 0B

echo.
echo ============================================================
echo         Bundle Statistics Viewer
echo ============================================================
echo.

REM Проверяем существует ли файл
if exist "frontend\bundle-stats.html" (
    echo [OK] Found bundle-stats.html
    echo.
    echo Opening in browser...
    start "" "frontend\bundle-stats.html"
    echo.
    echo [OK] Bundle statistics opened in browser
) else (
    echo [ERROR] File not found: frontend\bundle-stats.html
    echo.
    echo To generate bundle statistics:
    echo   1. Run SERVER-SETUP.bat or SERVER-START.bat
    echo   2. Or manually: cd frontend ^&^& npm run build
    echo.
    echo Bundle stats will be generated automatically during build
)

echo.
pause






