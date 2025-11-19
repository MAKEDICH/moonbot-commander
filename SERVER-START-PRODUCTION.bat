@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Server Production Mode
color 0B

echo.
echo ============================================================
echo       MoonBot Commander - SERVER PRODUCTION MODE
echo ============================================================
echo.
echo   Optimized for VPS/dedicated servers:
echo   * Production build (10x faster loading)
echo   * Fixed UDP ports
echo   * Keep-alive DISABLED
echo   * Minified bundle (~2 MB vs 30+ MB)
echo   * Automatic migrations
echo.
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
    echo Please run SERVER-SETUP.bat first
    echo.
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo [ERROR] Frontend not found!
    echo.
    echo Please run SERVER-SETUP.bat first
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

echo [0/6] Applying automatic migrations...
echo.

REM Apply migrations to backend DB
if exist moonbot_commander.db (
    echo Checking backend database...
    python startup_migrations.py 2>nul
    if !errorlevel! neq 0 (
        echo [WARNING] startup_migrations.py not found or failed
        echo Trying direct migration...
        
        REM Direct migration for critical columns
        python -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); c=conn.cursor(); c.execute('PRAGMA table_info(servers)'); cols=[col[1] for col in c.fetchall()]; missing=[]; 'is_localhost' not in cols and missing.append('is_localhost'); 'default_currency' not in cols and missing.append('default_currency'); [c.execute(f'ALTER TABLE servers ADD COLUMN {col} {"BOOLEAN DEFAULT FALSE" if col=="is_localhost" else "TEXT"}') for col in missing]; conn.commit(); conn.close(); print(f'[OK] Applied {len(missing)} migrations') if missing else print('[OK] No migrations needed')" 2>nul
    )
)

REM Apply migrations to root DB if exists
cd ..
if exist moonbot_commander.db (
    echo Checking root database...
    python -c "import sqlite3; conn=sqlite3.connect('moonbot_commander.db'); c=conn.cursor(); c.execute('PRAGMA table_info(servers)'); cols=[col[1] for col in c.fetchall()]; missing=[]; 'is_localhost' not in cols and missing.append('is_localhost'); 'default_currency' not in cols and missing.append('default_currency'); [c.execute(f'ALTER TABLE servers ADD COLUMN {col} {"BOOLEAN DEFAULT FALSE" if col=="is_localhost" else "TEXT"}') for col in missing]; conn.commit(); conn.close(); print(f'[OK] Applied {len(missing)} migrations') if missing else print('[OK] No migrations needed')" 2>nul
)
cd backend

REM Auto-detect application version
echo.
echo [1/6] Detecting application version...
echo.

set APP_VERSION=unknown
set MAIN_FILE=main.py

REM Check for VERSION.txt in root
if exist "..\VERSION.txt" (
    set /p APP_VERSION=<..\VERSION.txt
    echo [DETECTED] Version from VERSION.txt: !APP_VERSION!
) else (
    REM Check for schema_versions table in database (v2.0 indicator)
    if exist "moonbot_commander.db" (
        python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'\"); result = cursor.fetchone(); conn.close(); exit(0 if result else 1)" >nul 2>&1
        
        if !errorlevel! equ 0 (
            set APP_VERSION=v2.0+
        ) else (
            set APP_VERSION=v1.0+
        )
    )
)

echo.
echo Application Version: !APP_VERSION!
echo Main File: !MAIN_FILE!
echo Mode: SERVER PRODUCTION
echo.

REM Verify main file exists
if not exist "!MAIN_FILE!" (
    color 0C
    echo [ERROR] Main file not found: !MAIN_FILE!
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [2/6] Cleaning up old processes...
echo.

REM Kill old processes
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo [OK] Python processes stopped
) else (
    echo [INFO] No old Python processes
)

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo Stopping old Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo [OK] Node.js processes stopped
) else (
    echo [INFO] No old Node.js processes
)

echo [OK] Cleanup complete

echo.
echo [3/6] Cleaning frontend cache...
echo.

cd frontend
if exist ".vite" (
    rmdir /s /q .vite >nul 2>&1
    echo [OK] Vite cache cleaned
)
if exist "node_modules\.vite" (
    rmdir /s /q node_modules\.vite >nul 2>&1
    echo [OK] Node modules cache cleaned
)
cd ..

echo.
echo [4/6] Building optimized production bundle...
echo.
echo This will take 30-60 seconds...
echo.

cd frontend

REM Check if we need to build
set NEED_BUILD=1
if exist "dist\index.html" (
    REM Check if dist is newer than src
    for /f %%i in ('dir /b /o:d "src\*.*" 2^>nul') do set NEWEST_SRC=%%i
    for /f %%i in ('dir /b /o:d "dist\*.*" 2^>nul') do set NEWEST_DIST=%%i
    
    if defined NEWEST_DIST (
        echo [INFO] Production build already exists
        echo Build again? (Y/N)
        choice /C YN /T 5 /D N >nul
        if !errorlevel! equ 2 set NEED_BUILD=0
    )
)

if !NEED_BUILD! equ 1 (
    echo Running: npm run build
    echo.
    call npm run build
    echo.
    echo Build command finished, checking results...
    timeout /t 2 /nobreak >nul
)

REM Check if build succeeded
if not exist "dist" (
    color 0C
    echo.
    echo [ERROR] Production build failed - dist folder not created!
    echo.
    cd ..
    pause
    exit /b 1
)

if not exist "dist\index.html" (
    color 0C
    echo.
    echo [ERROR] Production build incomplete - index.html missing!
    echo.
    cd ..
    pause
    exit /b 1
)

echo.
echo [OK] Production build ready!
echo.

cd ..

echo.
echo [5/6] Starting Backend in SERVER mode...
echo.

set "PROJECT_DIR=%CD%"

start "MoonBot Backend !APP_VERSION! [PRODUCTION]" cmd /k "cd /d "%PROJECT_DIR%\backend" && set "MOONBOT_MODE=server" && python -m uvicorn !MAIN_FILE:~0,-3!:app --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul
echo [OK] Backend started

echo.
echo [6/6] Starting Frontend and Scheduler...
echo.

cd frontend
start "MoonBot Frontend [PRODUCTION]" cmd /k "cd /d "%PROJECT_DIR%\frontend" && npm run preview -- --host 0.0.0.0 --port 3000"
cd ..

timeout /t 2 /nobreak >nul

echo Starting Scheduler...
start "MoonBot Scheduler" cmd /k "cd /d "%PROJECT_DIR%\backend" && set "MOONBOT_MODE=server" && python scheduler.py"

timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo      Application Started in PRODUCTION MODE
echo ============================================================
echo.

REM Detect server IP
set "SERVER_IP=localhost"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "TEMP_IP=%%a"
    set "SERVER_IP=!TEMP_IP:~1!"
    goto :ip_found
)
:ip_found

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
echo   Frontend: http://!SERVER_IP!:3000
echo   Backend:  http://!SERVER_IP!:8000
echo   API Docs: http://!SERVER_IP!:8000/docs
echo.
echo ============================================================
echo.
echo Mode: SERVER PRODUCTION
echo.
echo Performance:
echo   * Production build (minified + optimized)
echo   * Bundle size: ~2 MB (vs 30+ MB in dev)
echo   * Page load: ~1 second (vs 5-10 sec in dev)
echo   * Network optimized (10x faster)
echo   * Fixed UDP ports
echo   * Keep-alive DISABLED
echo.
echo [!] Do not close the 3 CMD windows:
echo     - Backend API
echo     - Frontend Server  
echo     - Task Scheduler
echo.
echo To stop: Close windows or use KILL-ALL-PROCESSES.bat
echo.
echo ============================================================
echo.
pause
endlocal
