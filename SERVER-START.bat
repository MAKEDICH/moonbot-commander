@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Server Start
color 0B

echo.
echo ============================================================
echo       MoonBot Commander - Server Start
echo ============================================================
echo.

REM Check if setup was executed
if not exist "backend\main.py" (
    echo [ERROR] Backend not found!
    echo.
    echo Please run SERVER-SETUP.bat first
    echo.
    pause
    exit /b 1
)

if not exist "backend\.env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please run SERVER-SETUP.bat first to generate security keys
    echo.
    pause
    exit /b 1
)

REM Security check: Verify .env and database compatibility
cd backend
if exist moonbot_commander.db (
    REM Check if .env was recently modified (within last 5 minutes)
    set "ENV_AGE=0"
    for /f %%i in ('powershell -command "((Get-Date) - (Get-Item .env).LastWriteTime).TotalMinutes"') do set ENV_AGE=%%i
    
    REM If .env is fresh (< 5 minutes) and DB exists, warn about incompatibility
    if !ENV_AGE! LSS 5 (
        echo.
        echo [WARNING] Security Keys Mismatch Detected!
        echo.
        echo Your .env file was recently regenerated, but an old database exists.
        echo This database is encrypted with OLD keys and cannot be decrypted!
        echo.
        echo Options:
        echo   1. If you want to keep OLD data:
        echo      - Restore old .env file from backup
        echo      - Then restart SERVER-START.bat
        echo.
        echo   2. If you want to start FRESH:
        echo      - Press any key to delete old database
        echo      - You will need to re-register and configure servers
        echo.
        pause
        if exist moonbot_commander.db.old del moonbot_commander.db.old >nul 2>&1
        ren moonbot_commander.db moonbot_commander.db.old >nul 2>&1
        echo [OK] Old database renamed to moonbot_commander.db.old
        echo [OK] Fresh database will be created on startup
        echo.
    )
)
cd ..

if not exist "frontend\dist\index.html" (
    echo [ERROR] Frontend dist not found!
    echo.
    echo Please run SERVER-SETUP.bat first
    echo.
    pause
    exit /b 1
)

echo Starting all services in separate windows for monitoring...
echo.

REM Kill old processes
echo [0/3] Cleaning up old processes...
echo.

REM Stop services if exist
sc query "MoonBotBackend" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping Backend Service...
    net stop MoonBotBackend >nul 2>&1
    echo   [OK] Backend service stopped
)

sc query "MoonBotScheduler" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping Scheduler Service...
    net stop MoonBotScheduler >nul 2>&1
    echo   [OK] Scheduler service stopped
)

sc query "MoonBotFrontend" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping Frontend Service...
    net stop MoonBotFrontend >nul 2>&1
    echo   [OK] Frontend service stopped
)

REM Kill remaining processes
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    taskkill /F /IM pythonw.exe >nul 2>&1
    echo   [OK] Python processes stopped
)

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    echo   [OK] Node.js processes stopped
)

timeout /t 2 /nobreak >nul
echo [OK] Cleanup complete
echo.

REM Get current directory
set "PROJECT_DIR=%CD%"

echo [1/3] Starting Backend...
start "MoonBot Backend [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\backend" && echo Starting Backend on 0.0.0.0:8000... && python -m uvicorn main:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Scheduler...
start "MoonBot Scheduler [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\backend" && echo Starting Scheduler... && python scheduler.py"
timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend (Production)...
start "MoonBot Frontend [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\frontend\dist" && echo Starting Frontend on port 3000... && npx serve -s . -l 3000"
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo [OK] All services started in separate windows!
echo ============================================================
echo.
echo You should see 3 new windows:
echo   1. MoonBot Backend [DO NOT CLOSE]
echo   2. MoonBot Scheduler [DO NOT CLOSE]
echo   3. MoonBot Frontend [DO NOT CLOSE]
echo.

REM Get IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%a
    goto showip
)
:showip

echo Open in browser:
echo   http://%IP::=%:3000
echo.
echo [!] Do not close the 3 CMD windows
echo.
echo To stop: Close the 3 windows or use KILL-ALL-PROCESSES.bat
echo.
pause
endlocal
