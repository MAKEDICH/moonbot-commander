@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Local Setup
color 0E

echo.
echo ============================================================
echo     MoonBot Commander - Local Setup
echo ============================================================
echo.

REM Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Python not installed
    echo Install from: https://www.python.org/
    pause
    exit /b 1
)
echo [OK] Python found

REM Check Node.js
echo [2/4] Checking Node.js...
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [ERROR] Node.js not installed
    echo Install from: https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

echo.
echo [3/4] Setting up Backend...
cd backend

if not exist .env (
    if exist .env.example copy .env.example .env >nul
)

echo Installing packages...
python -m pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
echo [OK] Packages installed

echo Initializing...
python init_security.py
python migrate_add_password.py >nul 2>&1
python migrate_add_recovery_codes.py >nul 2>&1
python migrate_add_2fa.py >nul 2>&1
python migrate_add_2fa_attempts.py >nul 2>&1
python migrate_scheduled_commands_full.py >nul 2>&1
python migrate_add_timezone.py >nul 2>&1
python migrate_add_scheduler_settings.py >nul 2>&1
python migrate_add_display_time.py >nul 2>&1
python migrate_add_udp_listener.py >nul 2>&1
echo [OK] Backend ready

cd ..

echo.
echo [4/4] Setting up Frontend...
cd frontend

echo Cleaning old cache...
if exist "dist" rmdir /s /q dist >nul 2>&1
if exist "node_modules\.vite" rmdir /s /q node_modules\.vite >nul 2>&1
if exist ".vite" rmdir /s /q .vite >nul 2>&1
echo [OK] Cache cleaned

echo Installing packages...
call npm install
if !errorlevel! neq 0 (
    echo [ERROR] Failed
    pause
    exit /b 1
)
echo [OK] Frontend ready

cd ..

echo.
echo ============================================================
echo            Setup Complete - Ready to Start
echo ============================================================
echo.
echo Application configured but NOT started yet
echo.
echo Next steps:
echo   1. Start application: LOCAL-START.bat
echo   2. Open browser: http://localhost:3000
echo   3. Register your account
echo.
echo Note: LOCAL-START.bat will open 3 separate windows
echo       for monitoring Backend, Scheduler, and Frontend
echo.
pause
endlocal
