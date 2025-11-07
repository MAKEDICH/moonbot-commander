@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Local Start
color 0B

echo.
echo ============================================================
echo       MoonBot Commander - Local Start
echo ============================================================
echo.

REM Check if setup was executed
if not exist "backend\main.py" (
    echo [ERROR] Backend not found!
    echo.
    echo Please run LOCAL-SETUP.bat first
    echo.
    pause
    exit /b 1
)

if not exist "backend\.env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please run LOCAL-SETUP.bat first
    echo.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] Frontend not found!
    echo.
    echo Please run LOCAL-SETUP.bat first
    echo.
    pause
    exit /b 1
)

echo.
echo [0/3] Cleaning up old processes...
echo.

REM Check and kill old Python processes
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    echo   [OK] Python processes stopped
) else (
    echo   [INFO] No old Python processes
)

REM Check and kill old Node.js processes
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    echo   [OK] Node.js processes stopped
) else (
    echo   [INFO] No old Node.js processes
)

timeout /t 2 /nobreak >nul

echo Cleaning frontend cache...
cd frontend
if exist ".vite" rmdir /s /q .vite >nul 2>&1
cd ..
echo [OK] Cleanup complete

echo.
echo Starting services in separate windows...
echo.

set "PROJECT_DIR=%CD%"

echo [1/3] Starting Backend...
start "MoonBot Backend" cmd /k "cd /d "%PROJECT_DIR%\backend" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Scheduler...
start "MoonBot Scheduler" cmd /k "cd /d "%PROJECT_DIR%\backend" && python scheduler.py"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend...
start "MoonBot Frontend" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo            Application Started
echo ============================================================
echo.
echo Frontend: http://localhost:3000
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo [!] Do not close the 3 CMD windows
echo.
echo To stop: Close the 3 windows or use KILL-ALL-PROCESSES.bat
echo.
pause
endlocal
