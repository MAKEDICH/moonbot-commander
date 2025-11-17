@echo off
chcp 65001 > nul
title MoonBot Commander - Rebuild Frontend
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - Rebuild Frontend
echo ============================================================
echo.
echo This will rebuild the production frontend bundle.
echo Use this if:
echo   - You updated source code
echo   - The app is not loading correctly
echo   - You want to force a clean rebuild
echo.
pause

echo.
echo [1/3] Cleaning old build...
cd frontend
if exist "dist" (
    rmdir /s /q dist
    echo   [OK] Old build removed
) else (
    echo   [INFO] No old build found
)

if exist ".vite" (
    rmdir /s /q .vite
    echo   [OK] Vite cache cleaned
)

echo.
echo [2/3] Installing/updating dependencies...
call npm install
if !errorlevel! neq 0 (
    color 0C
    echo.
    echo [ERROR] npm install failed!
    echo.
    cd ..
    pause
    exit /b 1
)
echo   [OK] Dependencies ready

echo.
echo [3/3] Building production bundle...
echo.
echo ============================================================
echo   This will take 1-2 minutes...
echo ============================================================
echo.

call npm run build

if !errorlevel! neq 0 (
    color 0C
    echo.
    echo ============================================================
    echo                  BUILD FAILED!
    echo ============================================================
    echo.
    echo Check the error messages above.
    echo.
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo ============================================================
echo              BUILD COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo The production bundle is ready in: frontend\dist
echo.
echo Next steps:
echo   1. Stop the application if it's running (KILL-ALL-PROCESSES.bat)
echo   2. Start SERVER-START.bat
echo   3. The app will now load MUCH faster over network!
echo.
echo Build size:
dir frontend\dist /s | find "File(s)"
echo.
pause


