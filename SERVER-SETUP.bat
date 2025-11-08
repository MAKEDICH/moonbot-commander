@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Setup Server
color 0B

echo.
echo ============================================================
echo    MoonBot Commander - Windows Server Setup
echo ============================================================
echo.

REM Check administrator rights
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Administrator rights required!
    echo.
    echo Please run as administrator:
    echo   1. Right click on PowerShell
    echo   2. "Run as administrator"
    echo   3. cd to project folder
    echo   4. Run setup-server.bat
    echo.
    pause
    exit /b 1
)

echo ============================================================
echo  Step 1/6: Installing Python 3.11
echo ============================================================
echo.

python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Downloading Python...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.11.0/python-3.11.0-amd64.exe' -OutFile 'python-installer.exe'"
    echo Installing Python (wait 1-2 minutes^)...
    start /wait python-installer.exe /quiet InstallAllUsers=1 PrependPath=1
    del python-installer.exe
    echo [OK] Python installed
    echo.
    echo Updating PATH...
    set PATH=%PATH%;C:\Program Files\Python311;C:\Program Files\Python311\Scripts
    refreshenv >nul 2>&1
    
    REM Verify installation
    python --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Python installation failed or PATH not updated
        echo Please restart this script or manually add Python to PATH
        pause
        exit /b 1
    )
) else (
    echo [OK] Python already installed
)

echo.
echo ============================================================
echo  Step 2/6: Installing Node.js 18 LTS
echo ============================================================
echo.

node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo Downloading Node.js...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.18.0/node-v18.18.0-x64.msi' -OutFile 'node-installer.msi'"
    echo Installing Node.js (wait 1-2 minutes^)...
    start /wait msiexec /i node-installer.msi /quiet
    del node-installer.msi
    echo [OK] Node.js installed
    echo.
    echo Updating PATH...
    set PATH=%PATH%;C:\Program Files\nodejs
    refreshenv >nul 2>&1
    
    REM Verify installation
    node --version >nul 2>&1
    if !errorlevel! neq 0 (
        echo [ERROR] Node.js installation failed or PATH not updated
        echo Please restart this script or manually add Node.js to PATH
        pause
        exit /b 1
    )
) else (
    echo [OK] Node.js already installed
)

echo.
echo ============================================================
echo  Step 3/6: Installing application dependencies
echo ============================================================
echo.

REM Backend
echo Installing Backend dependencies...
cd backend

REM Check if backend directory and files exist
if not exist "main.py" (
    echo [ERROR] main.py not found in backend directory
    cd ..
    pause
    exit /b 1
)

if not exist "requirements.txt" (
    echo [ERROR] requirements.txt not found in backend directory
    cd ..
    pause
    exit /b 1
)

set NEW_ENV_CREATED=0
if not exist .env (
    copy .env.example .env >nul
    echo [OK] Created .env file
    set NEW_ENV_CREATED=1
)
python -m pip install --upgrade pip --quiet >nul 2>&1
pip install -r requirements.txt --quiet
echo [OK] Backend dependencies installed

echo.
echo Initializing security keys...
python init_security.py
echo [OK] Security keys generated

REM If new security keys were generated, delete old database (incompatible with new keys)
if !NEW_ENV_CREATED! equ 1 (
    if exist moonbot_commander.db (
        echo.
        echo [WARNING] Found existing database with OLD encryption keys
        echo [ACTION] Renaming old database to moonbot_commander.db.old
        if exist moonbot_commander.db.old del moonbot_commander.db.old >nul 2>&1
        ren moonbot_commander.db moonbot_commander.db.old >nul 2>&1
        echo [OK] Old database backed up and will be replaced with fresh one
        echo.
    )
)

echo.
echo Running database migrations...
python migrate_add_password.py >nul 2>&1
python migrate_add_recovery_codes.py >nul 2>&1
python migrate_add_2fa.py >nul 2>&1
python migrate_add_2fa_attempts.py >nul 2>&1
python migrate_scheduled_commands_full.py >nul 2>&1
python migrate_add_timezone.py >nul 2>&1
python migrate_add_scheduler_settings.py >nul 2>&1
python migrate_add_display_time.py >nul 2>&1
python migrate_add_udp_listener.py >nul 2>&1
echo [OK] Database ready

cd ..
echo [OK] Backend ready

echo.
REM Frontend
echo Installing Frontend dependencies (may take 2-3 minutes^)...
cd frontend

REM Check if frontend directory and files exist
if not exist "package.json" (
    echo [ERROR] package.json not found in frontend directory
    cd ..
    pause
    exit /b 1
)

if not exist "vite.config.js" (
    if not exist "vite.config.ts" (
        echo [WARNING] Vite config not found, but continuing...
    )
)

call npm install
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install Frontend dependencies
    pause
    exit /b 1
)
echo [OK] Dependencies installed

echo.
echo Cleaning old build cache...
if exist "dist" rmdir /s /q dist
if exist "node_modules\.vite" rmdir /s /q node_modules\.vite
if exist ".vite" rmdir /s /q .vite
echo [OK] Cache cleaned

echo.
echo Building Frontend for production...
set NODE_ENV=production
call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Failed to build Frontend
    pause
    exit /b 1
)
if not exist "dist\index.html" (
    echo [ERROR] Build failed - dist folder not created
    pause
    exit /b 1
)
echo [OK] Frontend built
cd ..

echo.
echo ============================================================
echo  Step 4/6: Configuring Windows Firewall
echo ============================================================
echo.

echo Allowing ports 3000 and 8000...
netsh advfirewall firewall delete rule name="MoonBot Frontend" >nul 2>&1
netsh advfirewall firewall delete rule name="MoonBot Backend" >nul 2>&1
netsh advfirewall firewall add rule name="MoonBot Frontend" dir=in action=allow protocol=TCP localport=3000 >nul
netsh advfirewall firewall add rule name="MoonBot Backend" dir=in action=allow protocol=TCP localport=8000 >nul
echo [OK] Firewall configured

echo.
echo ============================================================
echo  Step 5/6: Installing NSSM (for autostart^)
echo ============================================================
echo.

set NSSM_INSTALLED=0

if exist "C:\Windows\System32\nssm.exe" (
    echo [OK] NSSM already installed
    set NSSM_INSTALLED=1
) else (
    echo Downloading NSSM...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile 'nssm.zip' -ErrorAction Stop } catch { exit 1 }"
    
    if exist "nssm.zip" (
        echo Extracting NSSM...
        powershell -Command "Expand-Archive nssm.zip -Force" >nul 2>&1
        if exist "nssm\nssm-2.24\win64\nssm.exe" (
            copy nssm\nssm-2.24\win64\nssm.exe C:\Windows\System32\ >nul
            rmdir /s /q nssm >nul 2>&1
            del nssm.zip >nul 2>&1
            echo [OK] NSSM installed
            set NSSM_INSTALLED=1
        ) else (
            echo [WARNING] Failed to extract NSSM
            rmdir /s /q nssm >nul 2>&1
            del nssm.zip >nul 2>&1
        )
    ) else (
        echo [WARNING] Failed to download NSSM
    )
)

echo.
echo ============================================================
echo  Step 6/6: Configuring autostart
echo ============================================================
echo.

if NOT "!NSSM_INSTALLED!"=="1" goto NO_NSSM_SECTION

echo Configuring Windows services...
echo.

REM Get Python path
set "PYTHON_PATH="
where python >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=*" %%i in ('where python') do (
        set "PYTHON_PATH=%%i"
        goto python_found
    )
)

:python_found
if "!PYTHON_PATH!"=="" (
    if exist "C:\Program Files\Python311\python.exe" (
        set PYTHON_PATH=C:\Program Files\Python311\python.exe
    ) else if exist "C:\Python311\python.exe" (
        set PYTHON_PATH=C:\Python311\python.exe
    ) else (
        echo [ERROR] Python not found!
        pause
        exit /b 1
    )
)
echo [OK] Python found: !PYTHON_PATH!
    
    REM Remove old services if exist
    echo Removing old services if exist...
    sc query "MoonBotBackend" >nul 2>&1
    if !errorlevel! equ 0 (
        net stop MoonBotBackend >nul 2>&1
        sc delete MoonBotBackend >nul 2>&1
    )
    sc query "MoonBotScheduler" >nul 2>&1
    if !errorlevel! equ 0 (
        net stop MoonBotScheduler >nul 2>&1
        sc delete MoonBotScheduler >nul 2>&1
    )
    sc query "MoonBotFrontend" >nul 2>&1
    if !errorlevel! equ 0 (
        net stop MoonBotFrontend >nul 2>&1
        sc delete MoonBotFrontend >nul 2>&1
    )
    timeout /t 2 /nobreak >nul
    
    REM Backend Service
    set BACKEND_PATH=%CD%\backend
    echo Creating Backend service...
    C:\Windows\System32\nssm.exe install MoonBotBackend "!PYTHON_PATH!"
    C:\Windows\System32\nssm.exe set MoonBotBackend AppParameters "-m uvicorn main:app --host 0.0.0.0 --port 8000"
    C:\Windows\System32\nssm.exe set MoonBotBackend AppDirectory "%BACKEND_PATH%"
    C:\Windows\System32\nssm.exe set MoonBotBackend DisplayName "MoonBot Backend Service"
    C:\Windows\System32\nssm.exe set MoonBotBackend Description "MoonBot UDP Commander Backend API"
    C:\Windows\System32\nssm.exe set MoonBotBackend Start SERVICE_AUTO_START
    C:\Windows\System32\nssm.exe set MoonBotBackend AppStdout "%BACKEND_PATH%\backend.log"
    C:\Windows\System32\nssm.exe set MoonBotBackend AppStderr "%BACKEND_PATH%\backend-error.log"
    C:\Windows\System32\nssm.exe set MoonBotBackend AppRotateFiles 1
    C:\Windows\System32\nssm.exe set MoonBotBackend AppRotateBytes 10485760
    echo [OK] Backend service created
    
    REM Scheduler Service
    echo Creating Scheduler service...
    C:\Windows\System32\nssm.exe install MoonBotScheduler "!PYTHON_PATH!"
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppParameters "scheduler.py"
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppDirectory "%BACKEND_PATH%"
    C:\Windows\System32\nssm.exe set MoonBotScheduler DisplayName "MoonBot Scheduler Service"
    C:\Windows\System32\nssm.exe set MoonBotScheduler Description "MoonBot Scheduled Commands Executor"
    C:\Windows\System32\nssm.exe set MoonBotScheduler Start SERVICE_AUTO_START
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppStdout "%BACKEND_PATH%\scheduler.log"
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppStderr "%BACKEND_PATH%\scheduler-error.log"
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppRotateFiles 1
    C:\Windows\System32\nssm.exe set MoonBotScheduler AppRotateBytes 10485760
    echo [OK] Scheduler service created
    
    REM Install serve for Frontend
    echo Installing serve globally...
    call npm install -g serve
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install serve
        pause
        exit /b 1
    )
    
    REM Frontend Service
    set FRONTEND_PATH=%CD%\frontend\dist
    
    REM Verify dist exists
    if not exist "%FRONTEND_PATH%\index.html" (
        echo [ERROR] Frontend dist folder not found at %FRONTEND_PATH%
        pause
        exit /b 1
    )
    
    REM Find serve.cmd full path - use where to find it, then add .cmd
    set "SERVE_CMD="
    
    REM Try to find serve in PATH
    where serve.cmd >nul 2>&1
    if !errorlevel! equ 0 (
        for /f "tokens=*" %%i in ('where serve.cmd') do (
            set "SERVE_CMD=%%i"
            goto serve_found
        )
    )
    
    REM If not found, try common locations
    if exist "%APPDATA%\npm\serve.cmd" (
        set "SERVE_CMD=%APPDATA%\npm\serve.cmd"
        goto serve_found
    )
    
    if exist "%ProgramFiles%\nodejs\serve.cmd" (
        set "SERVE_CMD=%ProgramFiles%\nodejs\serve.cmd"
        goto serve_found
    )
    
    echo [ERROR] serve.cmd not found after installation
    echo Tried:
    echo   - where serve.cmd
    echo   - %APPDATA%\npm\serve.cmd
    echo   - %ProgramFiles%\nodejs\serve.cmd
    pause
    exit /b 1
    
    :serve_found
    echo [OK] Serve found: !SERVE_CMD!
    
    echo Creating Frontend service...
    C:\Windows\System32\nssm.exe install MoonBotFrontend "!SERVE_CMD!"
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppParameters "-s \"%FRONTEND_PATH%\" -l 3000"
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppDirectory "%FRONTEND_PATH%"
    C:\Windows\System32\nssm.exe set MoonBotFrontend DisplayName "MoonBot Frontend Service"
    C:\Windows\System32\nssm.exe set MoonBotFrontend Description "MoonBot UDP Commander Web Interface"
    C:\Windows\System32\nssm.exe set MoonBotFrontend Start SERVICE_AUTO_START
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppStdout "%CD%\frontend\frontend.log"
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppStderr "%CD%\frontend\frontend-error.log"
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppRotateFiles 1
    C:\Windows\System32\nssm.exe set MoonBotFrontend AppRotateBytes 10485760
    echo [OK] Frontend service created
    
    echo.
    echo [INFO] Services are created but NOT started yet
    echo [INFO] Use start-server.bat to start the application
    goto FINISH_SECTION

:NO_NSSM_SECTION
    echo [WARNING] NSSM not installed
    echo.
    echo Services could not be created without NSSM.
    echo.
    echo To install NSSM:
    echo   1. Download from https://nssm.cc/download
    echo   2. Copy nssm.exe to C:\Windows\System32\
    echo   3. Run setup-server.bat again
    echo.
    echo Alternatively, use SERVER-START-WINDOWED.bat to run manually in windows
    
:FINISH_SECTION

echo.
echo ============================================================
echo            [OK] SETUP COMPLETED SUCCESSFULLY!
echo ============================================================
echo.

if "%NSSM_INSTALLED%"=="1" (
    echo Checking services configuration:
    sc query MoonBotBackend 2>nul | findstr "STATE"
    sc query MoonBotScheduler 2>nul | findstr "STATE"
    sc query MoonBotFrontend 2>nul | findstr "STATE"
    echo.
    echo [OK] All services are configured (STOPPED - not started yet^)
)

echo.
echo ============================================================
echo  Setup Complete - Application is NOT started yet
echo ============================================================
echo.

REM Get IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP=%%a
    goto showip2
)
:showip2

echo After starting, access at:
echo   http://%IP::=%:3000
echo.
echo Next steps:
echo   1. Start the application: start-server.bat
echo   2. Open browser: http://%IP::=%:3000
echo   3. Register your account
echo   4. Add your MoonBot servers
echo.

if "%NSSM_INSTALLED%"=="1" (
    echo ============================================================
    echo  Windows Services Management
    echo ============================================================
    echo.
    echo Services are configured for auto-start on reboot
    echo.
    echo Management commands:
    echo   start-server.bat           - Start all services
    echo   nssm start MoonBotBackend  - Start Backend only
    echo   nssm stop MoonBotBackend   - Stop Backend only
    echo   nssm restart MoonBotBackend - Restart Backend
    echo   nssm status MoonBotBackend  - Check status
) else (
    echo ============================================================
    echo  Manual Start
    echo ============================================================
    echo.
    echo NSSM services not configured.
    echo.
    echo To start manually:
    echo   SERVER-START-WINDOWED.bat  - Run in visible windows
)

echo.
pause
endlocal
