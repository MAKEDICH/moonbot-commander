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

REM Security check: Verify .env keys are valid
cd backend
python check_keys.py >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [WARNING] Security keys in .env are invalid or corrupted!
    echo.
    echo This may happen if:
    echo   - .env file was manually edited incorrectly
    echo   - ENCRYPTION_KEY is invalid or placeholder text
    echo   - SECRET_KEY is too short or placeholder text
    echo.
    echo [ACTION] Auto-fixing security keys...
    echo.
    
    REM Backup and delete old database
    if exist moonbot_commander.db (
        echo Backing up old database...
        if exist moonbot_commander.db.old del moonbot_commander.db.old >nul 2>&1
        ren moonbot_commander.db moonbot_commander.db.old >nul 2>&1
        echo [OK] Old database backed up to moonbot_commander.db.old
    )
    
    REM Delete invalid .env
    if exist .env (
        echo Removing invalid .env file...
        del .env >nul 2>&1
        echo [OK] Invalid .env removed
    )
    
    REM Generate new valid keys
    echo Generating new security keys...
    python init_security.py
    
    REM Verify new keys are valid
    python check_keys.py >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to generate valid security keys!
        echo Please run SERVER-SETUP.bat manually
        cd ..
        pause
        exit /b 1
    )
    
    echo [OK] Security keys regenerated successfully
    echo [INFO] You will need to register a new user - old database was incompatible
    echo.
    
    REM Auto-configure CORS for server IP
    echo Configuring CORS...
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
        set SERVER_IP=%%a
        goto ip_found_start
    )
    :ip_found_start
    set SERVER_IP=%SERVER_IP: =%
    
    if defined SERVER_IP (
        findstr /C:"http://!SERVER_IP!:3000" .env >nul 2>&1
        if !errorlevel! neq 0 (
            powershell -Command "(Get-Content .env) -replace 'CORS_ORIGINS=(.+)', \"CORS_ORIGINS=`$1,http://!SERVER_IP!:3000\" | Set-Content .env"
            echo [OK] Added !SERVER_IP! to CORS_ORIGINS
        )
    )
    
    echo.
    echo [OK] Security fixed! Continuing startup...
    echo.
)
cd ..

REM Auto-detect application version
cd backend

echo [0/4] Detecting application version...
echo.

set APP_VERSION=unknown
set MAIN_FILE=main.py

REM Check for schema_versions table in database (v2.0 indicator)
if exist "moonbot_commander.db" (
    python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'\"); result = cursor.fetchone(); conn.close(); exit(0 if result else 1)" >nul 2>&1
    
    if !errorlevel! equ 0 (
        set APP_VERSION=v2.0
        if exist "main_v2.py" (
            set MAIN_FILE=main_v2.py
            echo [DETECTED] Version 2.0 - Using main_v2.py
        ) else (
            set MAIN_FILE=main.py
            echo [DETECTED] Version 2.0 - Using main.py migrated
        )
    ) else (
        set APP_VERSION=v1.0
        set MAIN_FILE=main.py
        echo [DETECTED] Version 1.0 - Using main.py
    )
) else (
    REM No database - check which files exist
    if exist "main_v2.py" (
        set APP_VERSION=v2.0
        set MAIN_FILE=main_v2.py
        echo [DETECTED] Version 2.0 new install - Using main_v2.py
    ) else (
        set APP_VERSION=v1.0
        set MAIN_FILE=main.py
        echo [DETECTED] Version 1.0 new install - Using main.py
    )
)

echo.
echo Application Version: %APP_VERSION%
echo Main File: %MAIN_FILE%
echo.

REM Verify main file exists
if not exist "!MAIN_FILE!" (
    color 0C
    echo [ERROR] Main file not found: !MAIN_FILE!
    echo.
    echo Available files:
    dir /b main*.py
    echo.
    cd ..
    pause
    exit /b 1
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
echo [1/4] Cleaning up old processes...
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

REM Kill old Python processes
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    echo   [OK] Python processes stopped
) else (
    echo   [INFO] No old Python processes
)

REM Kill old Node.js processes
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    echo   [OK] Node.js processes stopped
) else (
    echo   [INFO] No old Node.js processes
)

timeout /t 2 /nobreak >nul
echo [OK] Cleanup complete
echo.

echo Starting services in separate windows...
echo.

set "PROJECT_DIR=%CD%"

echo [2/4] Starting Backend %APP_VERSION%...
start "MoonBot Backend %APP_VERSION% [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\backend" && echo Starting Backend on port 8000... && python -m uvicorn %MAIN_FILE:~0,-3%:app --host 0.0.0.0 --port 8000"
timeout /t 5 /nobreak >nul

echo [3/4] Starting Scheduler...
start "MoonBot Scheduler [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\backend" && echo Starting Scheduler... && python scheduler.py"
timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend...
start "MoonBot Frontend [DO NOT CLOSE]" cmd /k "cd /d "%PROJECT_DIR%\frontend\dist" && echo Starting Frontend on port 3000... && npx serve -s . -l 3000"
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo            Application Started %APP_VERSION%
echo ============================================================
echo.

REM Get server IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set SERVER_IP=%%a
    goto ip_found_end
)
:ip_found_end
set SERVER_IP=%SERVER_IP: =%

if defined SERVER_IP (
    echo Access from network: http://!SERVER_IP!:3000
    echo Backend API:         http://!SERVER_IP!:8000
    echo API Docs:            http://!SERVER_IP!:8000/docs
) else (
    echo Access locally:      http://localhost:3000
    echo Backend API:         http://localhost:8000
    echo API Docs:            http://localhost:8000/docs
)

echo.
echo [!] Do not close the 3 CMD windows
echo.
echo To stop: Close the 3 windows or use KILL-ALL-PROCESSES.bat
echo.
pause
endlocal
