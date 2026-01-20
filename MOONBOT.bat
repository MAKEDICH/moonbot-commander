@echo off
chcp 65001 >nul
title MoonBot Commander - Control Panel
color 0B

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

:MENU
cls
echo.
echo  +===================================================================+
echo  :                                                                   :
echo  :   M   M  OOO   OOO  N   N BBBB   OOO  TTTTT                       :
echo  :   MM MM O   O O   O NN  N B   B O   O   T                         :
echo  :   M M M O   O O   O N N N BBBB  O   O   T                         :
echo  :   M   M O   O O   O N  NN B   B O   O   T                         :
echo  :   M   M  OOO   OOO  N   N BBBB   OOO    T                         :
echo  :                                                                   :
echo  :                    COMMANDER CONTROL PANEL                        :
echo  :                                                                   :
echo  +===================================================================+
echo.

if exist "VERSION.txt" (
    set /p VER=<VERSION.txt
) else (
    set "VER=unknown"
)
echo  Version: v%VER%
echo.
echo  ===================================================================
echo.
echo  SETUP:
echo    [1] Local development setup
echo    [2] Server Production setup (optimized for high-load)
echo.
echo  START:
echo    [3] Start DEV mode
echo    [4] Start PRODUCTION mode
echo.
echo  MANAGE:
echo    [5] Stop all processes
echo    [6] UDP port manager
echo    [7] Check migrations
echo.
echo  UPDATE:
echo    [8] Check updates
echo    [9] Upgrade to v3.0.0
echo.
echo  [0] Exit
echo.
echo  ===================================================================
echo.
set /p choice="  Select: "

if "%choice%"=="1" goto SETUP_LOCAL
if "%choice%"=="2" goto SETUP_SERVER
if "%choice%"=="3" goto START_DEV
if "%choice%"=="4" goto START_PROD
if "%choice%"=="5" goto STOP_ALL
if "%choice%"=="6" goto UDP
if "%choice%"=="7" goto MIGRATIONS
if "%choice%"=="8" goto UPDATES
if "%choice%"=="9" goto UPGRADE
if "%choice%"=="0" goto QUIT
goto MENU

:SETUP_LOCAL
cls
echo.
echo  +===================================================================+
echo  :              LOCAL DEVELOPMENT SETUP                             :
echo  +===================================================================+
echo.

echo  [1/5] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        [X] Python not found! Download: https://python.org
    pause
    goto MENU
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        [OK] %%v

echo  [2/5] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        [X] Node.js not found! Download: https://nodejs.org
    pause
    goto MENU
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo        [OK] Node.js %%v

echo.
echo  [3/5] Installing Backend...
cd /d "%SCRIPT_DIR%backend"
python -m pip install --upgrade pip -q >nul 2>&1
pip install -r requirements.txt -q 2>nul
echo        [OK] Backend ready

echo.
echo  [4/5] Security setup...
if exist "utils\init_security.py" python utils/init_security.py >nul 2>&1
echo        [OK] Security configured

echo.
echo  [5/5] Database migrations...
if exist "updates\core\intelligent_migration.py" python updates/core/intelligent_migration.py >nul 2>&1
echo        [OK] Migrations applied
cd /d "%SCRIPT_DIR%"

echo.
echo  [BONUS] Installing Frontend...
cd /d "%SCRIPT_DIR%frontend"
if exist ".vite" rmdir /s /q .vite >nul 2>&1
call npm install >nul 2>&1
echo        [OK] Frontend ready
cd /d "%SCRIPT_DIR%"

echo.
echo  ===================================================================
echo  SETUP COMPLETE! Now select [3] to start DEV mode
echo  ===================================================================
echo.
pause
goto MENU

:SETUP_SERVER
cls
echo.
echo  +===================================================================+
echo  :              SERVER PRODUCTION SETUP                             :
echo  :              Optimized for 3000+ servers                         :
echo  +===================================================================+
echo.

echo  [1/9] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        [X] Python not found!
    pause
    goto MENU
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        [OK] %%v

echo  [2/9] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo        [X] Node.js not found!
    pause
    goto MENU
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo        [OK] Node.js %%v

echo.
echo  [3/9] Checking optional dependencies...

REM Check PostgreSQL
where psql >nul 2>&1
if %errorlevel% equ 0 (
    echo        [OK] PostgreSQL available
    set HAS_POSTGRES=1
) else (
    echo        [i] PostgreSQL not found - using SQLite
    set HAS_POSTGRES=0
)

REM Check Redis
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    echo        [OK] Redis available
    set HAS_REDIS=1
) else (
    echo        [i] Redis not found - using in-memory cache
    set HAS_REDIS=0
)

echo.
echo  [4/9] Installing Backend...
cd /d "%SCRIPT_DIR%backend"
python -m pip install --upgrade pip -q >nul 2>&1
pip install -r requirements.txt -q 2>nul
echo        [OK] Backend ready

echo.
echo  [5/9] Security setup...
if exist "utils\init_security.py" python utils/init_security.py >nul 2>&1
echo        [OK] Security configured

echo.
echo  [6/9] Database migrations...
if exist "updates\core\intelligent_migration.py" python updates/core/intelligent_migration.py >nul 2>&1
echo        [OK] Migrations applied

echo.
echo  [7/9] Applying performance indexes...
if exist "updates\versions\add_high_load_indexes.py" python updates/versions/add_high_load_indexes.py >nul 2>&1
echo        [OK] Indexes applied
cd /d "%SCRIPT_DIR%"

echo.
echo  [8/9] Building Frontend...
cd /d "%SCRIPT_DIR%frontend"
if exist "dist" rmdir /s /q dist >nul 2>&1
call npm install >nul 2>&1
echo        [i] Building production bundle - 1-2 min...
set NODE_ENV=production
call npm run build
if %errorlevel% neq 0 (
    echo        [X] Build failed!
    cd /d "%SCRIPT_DIR%"
    pause
    goto MENU
)
echo        [OK] Production build ready
cd /d "%SCRIPT_DIR%"

echo.
echo  [9/9] Firewall and system optimization...
net session >nul 2>&1
if %errorlevel% equ 0 (
    netsh advfirewall firewall delete rule name="MoonBot Frontend" >nul 2>&1
    netsh advfirewall firewall delete rule name="MoonBot Backend" >nul 2>&1
    netsh advfirewall firewall add rule name="MoonBot Frontend" dir=in action=allow protocol=TCP localport=3000 >nul
    netsh advfirewall firewall add rule name="MoonBot Backend" dir=in action=allow protocol=TCP localport=8000 >nul
    echo        [OK] Ports 3000, 8000 opened
) else (
    echo        [SKIP] No admin rights for firewall
)

REM Calculate workers
for /f "tokens=2 delims==" %%a in ('wmic cpu get NumberOfCores /value 2^>nul ^| find "="') do set CPU_CORES=%%a
if not defined CPU_CORES set CPU_CORES=4
set /a WORKERS=%CPU_CORES% * 2 + 1

echo.
echo  ===================================================================
echo  SERVER SETUP COMPLETE!
echo.
echo  Configuration:
echo    - Workers: %WORKERS% (auto-calculated)
if %HAS_POSTGRES%==1 echo    - PostgreSQL: available
if %HAS_REDIS%==1 echo    - Redis: available
echo.
echo  Now select [4] to start PRODUCTION
echo.
echo  Optional: Configure PostgreSQL/Redis in .env for best performance
echo  ===================================================================
echo.
pause
goto MENU

:START_DEV
cls
echo.
echo  +===================================================================+
echo  :              STARTING DEV MODE                                   :
echo  +===================================================================+
echo.

if not exist "%SCRIPT_DIR%backend\main.py" (
    echo        [X] Backend not found! Run setup first [1]
    pause
    goto MENU
)

echo  [1/4] Stopping old processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo        [OK] Stopped

echo  [2/4] Cleaning cache...
if exist "%SCRIPT_DIR%frontend\.vite" rmdir /s /q "%SCRIPT_DIR%frontend\.vite" >nul 2>&1
echo        [OK] Cache cleaned

echo  [3/4] Starting Backend...
set "PDIR=%SCRIPT_DIR:~0,-1%"
start "MoonBot-Backend-DEV" cmd /c "cd /d %PDIR%\backend && set MOONBOT_MODE=local && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 /nobreak >nul
echo        [OK] Backend started

echo  [4/4] Starting Frontend...
start "MoonBot-Scheduler" cmd /c "cd /d %PDIR%\backend && set MOONBOT_MODE=local && python -m services.scheduler"
timeout /t 2 /nobreak >nul
start "MoonBot-Frontend-DEV" cmd /c "cd /d %PDIR%\frontend && npm run dev"
timeout /t 3 /nobreak >nul
echo        [OK] Frontend started

echo.
echo  ===================================================================
echo  DEV MODE STARTED!
echo.
echo  Frontend: http://localhost:3000
echo  Backend:  http://localhost:8000
echo  API Docs: http://localhost:8000/docs
echo.
echo  DO NOT close the terminal windows!
echo  ===================================================================
echo.
pause
goto MENU

:START_PROD
cls
echo.
echo  +===================================================================+
echo  :              STARTING PRODUCTION MODE                            :
echo  :              Optimized for high-load - 3000+ servers             :
echo  +===================================================================+
echo.

if not exist "%SCRIPT_DIR%backend\main.py" (
    echo        [X] Backend not found! Run setup first [2]
    pause
    goto MENU
)

if not exist "%SCRIPT_DIR%frontend\dist\index.html" (
    echo        [!] Production build not found!
    set /p build="       Build now? (Y/N): "
    if /i not "%build%"=="Y" goto MENU
    cd /d "%SCRIPT_DIR%frontend"
    set NODE_ENV=production
    call npm run build
    cd /d "%SCRIPT_DIR%"
)

REM Calculate workers for 3000+ servers
for /f "tokens=2 delims==" %%a in ('wmic cpu get NumberOfCores /value 2^>nul ^| find "="') do set CPU_CORES=%%a
if not defined CPU_CORES set CPU_CORES=4
set /a CALC_WORKERS=%CPU_CORES% * 2 + 1
REM Minimum 17 workers for 3000+ servers
if %CALC_WORKERS% LSS 17 (
    set WORKERS=17
) else (
    set WORKERS=%CALC_WORKERS%
)

echo  [1/5] Stopping old processes...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo        [OK] Stopped

echo  [2/5] Checking services...
REM Check Redis
where redis-cli >nul 2>&1
if %errorlevel% equ 0 (
    redis-cli ping >nul 2>&1
    if %errorlevel% equ 0 (
        echo        [OK] Redis connected
        set REDIS_URL=redis://localhost:6379/0
    ) else (
        echo        [i] Redis not running - using in-memory cache
    )
) else (
    echo        [i] Redis not available - using in-memory cache
)

REM Check PostgreSQL (if configured)
if defined DATABASE_URL (
    echo        [OK] PostgreSQL configured
) else (
    echo        [i] Using SQLite
)

echo  [3/5] Migrations check...
cd /d "%SCRIPT_DIR%backend"
if exist "updates\core\startup_migrations.py" python updates/core/startup_migrations.py >nul 2>&1
cd /d "%SCRIPT_DIR%"
echo        [OK] Migrations OK

echo  [4/5] Starting Backend (%WORKERS% workers)...
set "PDIR=%SCRIPT_DIR:~0,-1%"
REM Optimized for 3000+ servers
start "MoonBot-Backend-PROD" cmd /c "cd /d %PDIR%\backend && set MOONBOT_MODE=server && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers %WORKERS% --limit-concurrency 2000 --backlog 4096 --timeout-keep-alive 30"
timeout /t 4 /nobreak >nul
echo        [OK] Backend started (%WORKERS% workers, optimized for 3000+ servers)

start "MoonBot-Scheduler" cmd /c "cd /d %PDIR%\backend && set MOONBOT_MODE=server && python -m services.scheduler"
timeout /t 2 /nobreak >nul
echo        [OK] Scheduler started

echo  [5/5] Starting Frontend...
start "MoonBot-Frontend-PROD" cmd /c "cd /d %PDIR%\frontend && npm run preview -- --host 0.0.0.0 --port 3000"
timeout /t 3 /nobreak >nul
echo        [OK] Frontend started

echo.
echo  ===================================================================
echo  PRODUCTION MODE STARTED!
echo.
echo  Configuration:
echo    - Workers: %WORKERS%
echo    - Mode: server
if defined DATABASE_URL echo    - Database: PostgreSQL
if defined REDIS_URL echo    - Cache: Redis
echo.
echo  Local:  http://localhost:3000
echo  Remote: http://YOUR_SERVER_IP:3000
echo  Metrics: http://localhost:8000/api/metrics/all
echo.
echo  DO NOT close the terminal windows!
echo  ===================================================================
echo.
pause
goto MENU

:STOP_ALL
cls
echo.
echo  +===================================================================+
echo  :              STOPPING ALL PROCESSES                              :
echo  +===================================================================+
echo.
echo  [!] All Python and Node.js processes will be stopped!
echo.
set /p confirm="  Continue? (Y/N): "
if /i not "%confirm%"=="Y" goto MENU

echo.
echo  Stopping services...
net stop MoonBotBackend >nul 2>&1
net stop MoonBotScheduler >nul 2>&1
net stop MoonBotFrontend >nul 2>&1

echo  Stopping Python...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM pythonw.exe >nul 2>&1
echo        [OK] Python stopped

echo  Stopping Node.js...
taskkill /F /IM node.exe >nul 2>&1
echo        [OK] Node.js stopped

echo  Closing MoonBot terminal windows...
taskkill /F /FI "WINDOWTITLE eq MoonBot-Backend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MoonBot-Frontend*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq MoonBot-Scheduler*" >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo  ===================================================================
echo  ALL PROCESSES STOPPED! Ports 3000, 8000 are free.
echo  ===================================================================
echo.
pause
goto MENU

:UDP
if exist "%SCRIPT_DIR%scripts\moonbot-udp-port-manager.bat" (
    call "%SCRIPT_DIR%scripts\moonbot-udp-port-manager.bat"
) else (
    cls
    echo.
    echo  [X] UDP manager not found: scripts\moonbot-udp-port-manager.bat
    echo.
    pause
)
goto MENU

:MIGRATIONS
cls
echo.
echo  +===================================================================+
echo  :              DATABASE MIGRATIONS STATUS                          :
echo  +===================================================================+
echo.
cd /d "%SCRIPT_DIR%backend"
python -c "from updates.core.migrations_registry import MigrationsRegistry; r=MigrationsRegistry(); a=r.get_applied_migrations(); p=r.get_pending_migrations(); print(f'Applied: {len(a)}'); print(f'Pending: {len(p)}'); [print(f'  - {m}') for m in p[:5]]" 2>nul
if %errorlevel% neq 0 echo  [!] Could not check migrations
cd /d "%SCRIPT_DIR%"
echo.
pause
goto MENU

:UPDATES
cls
echo.
echo  +===================================================================+
echo  :              CHECK FOR UPDATES                                   :
echo  +===================================================================+
echo.
if exist "VERSION.txt" (
    set /p VER=<VERSION.txt
    echo  Current version: v%VER%
)
echo.
echo  To update use:
echo    1. Web interface (Settings - Updates)
echo    2. GitHub: https://github.com/MAKEDICH/moonbot-commander
echo.
pause
goto MENU

:UPGRADE
cls
echo.
echo  +===================================================================+
echo  :              UPGRADE TO v3.0.0                                   :
echo  +===================================================================+
echo.
echo  For users with old versions without auto-update.
echo  All data will be preserved!
echo.
set /p confirm="  Continue? (Y/N): "
if /i not "%confirm%"=="Y" goto MENU

if exist "%SCRIPT_DIR%UPGRADE-TO-3.0.bat" (
    call "%SCRIPT_DIR%UPGRADE-TO-3.0.bat"
) else (
    echo  [X] UPGRADE-TO-3.0.bat not found!
)
pause
goto MENU

:QUIT
cls
echo.
echo  Goodbye!
echo.
timeout /t 2 /nobreak >nul
exit /b 0

