@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Server Mode
color 0B

echo.
echo ============================================================
echo       MoonBot Commander - SERVER MODE
echo ============================================================
echo.
echo   This mode is optimized for VPS/dedicated servers:
echo   - Fixed UDP ports (no ephemeral)
echo   - Keep-alive DISABLED (no NAT)
echo   - Production configuration
echo.
echo ============================================================
echo.

REM Check if setup was executed
if not exist "backend\main.py" (
    if not exist "backend\main_v2.py" (
        echo [ERROR] Backend not found!
        echo.
        echo Please run LOCAL-SETUP.bat first
        echo.
        pause
        exit /b 1
    )
)

if not exist "backend\.env" (
    echo [ERROR] .env file not found!
    echo.
    echo Please run LOCAL-SETUP.bat first to generate security keys
    echo.
    pause
    exit /b 1
)

REM Security check
cd backend
python check_keys.py >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [WARNING] Security keys in .env are invalid!
    echo [ACTION] Auto-fixing security keys...
    echo.
    
    if exist moonbot_commander.db (
        echo Backing up old database...
        if exist moonbot_commander.db.old del moonbot_commander.db.old >nul 2>&1
        ren moonbot_commander.db moonbot_commander.db.old >nul 2>&1
        echo [OK] Old database backed up
    )
    
    if exist .env del .env >nul 2>&1
    python init_security.py
    
    python check_keys.py >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to generate valid security keys!
        cd ..
        pause
        exit /b 1
    )
    
    echo [OK] Security keys regenerated
    echo.
)

REM Auto-detect application version
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
echo Mode: SERVER (Fixed ports, No keep-alive)
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

if not exist "frontend\package.json" (
    echo [ERROR] Frontend not found!
    echo.
    echo Please run LOCAL-SETUP.bat first
    echo.
    pause
    exit /b 1
)

echo.
echo [1/4] Cleaning up old processes...
echo.

REM Check and kill old processes
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    echo   [OK] Python processes stopped
) else (
    echo   [INFO] No old Python processes
)

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

echo [2/4] Starting Backend %APP_VERSION% [SERVER MODE]...
start "MoonBot Backend %APP_VERSION% [SERVER]" cmd /k "cd /d "%PROJECT_DIR%\backend" && set "MOONBOT_MODE=server" && python -m uvicorn %MAIN_FILE:~0,-3%:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul

echo [3/4] Starting Scheduler...
start "MoonBot Scheduler" cmd /k "cd /d "%PROJECT_DIR%\backend" && set "MOONBOT_MODE=server" && python scheduler.py"
timeout /t 2 /nobreak >nul

echo [4/4] Preparing Frontend for production...
cd frontend

REM Check if production build exists and is fresh
set "NEED_BUILD=0"
if not exist "dist" (
    set "NEED_BUILD=1"
    echo Production build not found, will create...
) else (
    echo Checking if rebuild needed...
    REM Check if any source file is newer than dist folder
    for /f %%i in ('dir /s /b /o-d src\*.jsx src\*.js 2^>nul') do (
        for /f %%j in ('dir /b /o-d dist 2^>nul') do (
            if %%~ti GTR %%~tj (
                set "NEED_BUILD=1"
                echo Source files updated, rebuild needed...
                goto build_check_done
            )
        )
        goto build_check_done
    )
)

:build_check_done
if "%NEED_BUILD%"=="1" (
    echo.
    echo ============================================================
    echo   Building optimized production bundle...
    echo   This will take 1-2 minutes (only on first run or updates)
    echo ============================================================
    echo.
    call npm run build
    if !errorlevel! neq 0 (
        color 0C
        echo.
        echo [ERROR] Production build failed!
        echo Falling back to DEV mode (slower but works)
        echo.
        start "MoonBot Frontend [DEV]" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run dev -- --host 0.0.0.0 --port 3000"
        cd ..
        goto skip_prod_mode
    )
    echo.
    echo [OK] Production build created successfully!
    echo.
) else (
    echo [OK] Using existing production build
)

REM Start production server
echo Starting Frontend in PRODUCTION mode...
echo This will be MUCH faster over network!
start "MoonBot Frontend [PRODUCTION]" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run preview -- --host 0.0.0.0 --port 3000"
cd ..

:skip_prod_mode
timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo      Application Started %APP_VERSION% [SERVER MODE]
echo ============================================================
echo.
echo Detecting server IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do set "SERVER_IP=%%a"
set "SERVER_IP=%SERVER_IP:~1%"
echo.
echo ============================================================
echo   LOCAL ACCESS (from this server):
echo ============================================================
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo ============================================================
echo   REMOTE ACCESS (from any device):
echo ============================================================
echo   Frontend: http://%SERVER_IP%:3000
echo   Backend:  http://%SERVER_IP%:8000
echo   API Docs: http://%SERVER_IP%:8000/docs
echo.
echo ============================================================
echo.
echo Mode: SERVER (PRODUCTION)
echo   - Frontend: PRODUCTION build (10x faster over network!)
echo   - Accessible from ANY device (0.0.0.0:3000)
echo   - Fixed UDP ports (from server settings)
echo   - Keep-alive DISABLED
echo   - Optimized for VPS/dedicated servers
echo.
echo Performance:
echo   - Page load: ~1 second (vs 5-10 sec in dev mode)
echo   - Bundle size: ~2 MB (vs 30+ MB in dev mode)
echo   - Auto-rebuild only when source files change
echo.
echo [!] Do not close the 4 CMD windows
echo.
echo To stop: Close the windows or use KILL-ALL-PROCESSES.bat
echo.
pause
endlocal
