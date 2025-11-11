@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Auto Update
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - Auto Update System
echo ============================================================
echo.

REM ============================================================
REM STEP 0: Check current directory
REM ============================================================

if not exist "backend\main.py" (
    if not exist "frontend\package.json" (
        echo [ERROR] This does not look like MoonBot Commander folder!
        echo.
        echo Please place UPDATE.bat in your MoonBot Commander folder
        echo where backend/ and frontend/ directories are located.
        echo.
        pause
        exit /b 1
    )
)

echo [INFO] Detected MoonBot Commander installation
echo.

REM ============================================================
REM STEP 1: Check current version
REM ============================================================

echo [1/13] Checking current version...
echo.

set "CURRENT_VERSION=unknown"

if exist "VERSION.txt" (
    set /p CURRENT_VERSION=<VERSION.txt
    echo Current version: !CURRENT_VERSION!
) else (
    echo Current version: 1.0.0 (pre-versioning)
    set "CURRENT_VERSION=1.0.0"
)

echo.

REM ============================================================
REM STEP 2: Get latest release info from GitHub
REM ============================================================

echo [2/13] Checking latest version on GitHub...
echo.

set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/latest"
set "TEMP_JSON=%TEMP%\moonbot_release.json"

REM Download release info via PowerShell
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%GITHUB_API%' -OutFile '%TEMP_JSON%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ERROR] Failed to connect to GitHub!
    echo.
    echo Please check:
    echo   - Internet connection
    echo   - Firewall settings
    echo   - GitHub is accessible
    echo.
    pause
    exit /b 1
)

REM Parse JSON to get version and download URL
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content '%TEMP_JSON%' | ConvertFrom-Json).tag_name"') do set "NEW_VERSION=%%a"
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content '%TEMP_JSON%' | ConvertFrom-Json).zipball_url"') do set "DOWNLOAD_URL=%%a"

REM Remove 'v' from version if present
set "NEW_VERSION=!NEW_VERSION:v=!"

echo Latest version:  !NEW_VERSION!
echo.

REM Compare versions
if "!CURRENT_VERSION!"=="!NEW_VERSION!" (
    echo [INFO] You already have the latest version ^(!CURRENT_VERSION!^)
    echo.
    choice /C YN /M "Do you want to reinstall anyway"
    if errorlevel 2 (
        del "%TEMP_JSON%" >nul 2>&1
        exit /b 0
    )
)

echo.
echo Update: v!CURRENT_VERSION! ??? v!NEW_VERSION!
echo.

choice /C YN /M "Continue with update"
if errorlevel 2 (
    echo Update cancelled
    del "%TEMP_JSON%" >nul 2>&1
    exit /b 0
)

echo.

REM ============================================================
REM STEP 3: Download new version
REM ============================================================

echo [3/13] Downloading new version...
echo.

set "TEMP_ZIP=%TEMP%\moonbot_update.zip"
set "TEMP_EXTRACT=%TEMP%\moonbot_extract"

echo Downloading from GitHub...
echo This may take 1-2 minutes...
echo.

powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing"

if !errorlevel! neq 0 (
    echo [ERROR] Download failed!
    echo.
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo [OK] Downloaded successfully
echo.

REM ============================================================
REM STEP 4: Extract archive
REM ============================================================

echo [4/13] Extracting files...
echo.

if exist "%TEMP_EXTRACT%" rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
mkdir "%TEMP_EXTRACT%" >nul 2>&1

powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_EXTRACT%' -Force" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ERROR] Extraction failed!
    del "%TEMP_ZIP%" >nul 2>&1
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

REM Find extracted folder inside
for /d %%d in ("%TEMP_EXTRACT%\*") do set "UPDATE_SOURCE=%%d"

if not exist "!UPDATE_SOURCE!\backend\main.py" (
    echo [ERROR] Invalid archive structure!
    rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
    del "%TEMP_ZIP%" >nul 2>&1
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo [OK] Files extracted
echo.

REM ============================================================
REM STEP 5: Stop application
REM ============================================================

echo [5/13] Stopping application...
echo.

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo [OK] Application stopped
echo.

REM ============================================================
REM STEP 6: Create backup
REM ============================================================

echo [6/13] Creating backup...
echo.

set "BACKUP_DIR=backups\v!CURRENT_VERSION!_%date:~-4,4%-%date:~-7,2%-%date:~-10,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "BACKUP_DIR=%BACKUP_DIR: =0%"

if not exist "backups" mkdir backups
mkdir "%BACKUP_DIR%" >nul 2>&1

REM Backup critical files
if exist "backend\.env" (
    copy "backend\.env" "%BACKUP_DIR%\.env" >nul
    echo   [OK] Backed up .env
) else (
    echo   [WARNING] No .env file found
)

if exist "backend\moonbot_commander.db" (
    copy "backend\moonbot_commander.db" "%BACKUP_DIR%\moonbot_commander.db" >nul
    echo   [OK] Backed up database
) else (
    echo   [WARNING] No database found
)

if exist "VERSION.txt" (
    copy "VERSION.txt" "%BACKUP_DIR%\VERSION.txt" >nul
)

REM Backup logs
if exist "backend\*.log" (
    copy "backend\*.log" "%BACKUP_DIR%\" >nul 2>&1
    echo   [OK] Backed up logs
)

echo.
echo [OK] Backup created at: %BACKUP_DIR%
echo.

REM ============================================================
REM STEP 7: Update Backend files
REM ============================================================

echo [7/13] Updating Backend files...
echo.

REM Copy all Python files
for %%f in ("!UPDATE_SOURCE!\backend\*.py") do (
    copy "%%f" "backend\%%~nxf" >nul
)
echo   [OK] Updated Python files

REM Copy backend subdirectories (api, alembic, etc.)
if exist "!UPDATE_SOURCE!\backend\api" (
    xcopy "!UPDATE_SOURCE!\backend\api" "backend\api\" /E /Y /Q >nul 2>&1
)
if exist "!UPDATE_SOURCE!\backend\alembic" (
    xcopy "!UPDATE_SOURCE!\backend\alembic" "backend\alembic\" /E /Y /Q >nul 2>&1
)
if exist "!UPDATE_SOURCE!\backend\migrations" (
    xcopy "!UPDATE_SOURCE!\backend\migrations" "backend\migrations\" /E /Y /Q >nul 2>&1
)

REM Copy backend config files
if exist "!UPDATE_SOURCE!\backend\alembic.ini" (
    copy "!UPDATE_SOURCE!\backend\alembic.ini" "backend\alembic.ini" >nul 2>&1
)

REM Copy requirements.txt
if exist "!UPDATE_SOURCE!\backend\requirements.txt" (
    copy "!UPDATE_SOURCE!\backend\requirements.txt" "backend\requirements.txt" >nul
    echo   [OK] Updated requirements.txt
)

REM Copy .env.example (don't overwrite .env!)
if exist "!UPDATE_SOURCE!\backend\.env.example" (
    copy "!UPDATE_SOURCE!\backend\.env.example" "backend\.env.example" >nul
    echo   [OK] Updated .env.example
)

echo.

REM ============================================================
REM STEP 8: Update Frontend files
REM ============================================================

echo [8/13] Updating Frontend files...
echo.

REM Copy frontend src
if exist "!UPDATE_SOURCE!\frontend\src" (
    xcopy "!UPDATE_SOURCE!\frontend\src" "frontend\src\" /E /Y /Q >nul
    echo   [OK] Updated frontend/src
)

REM Copy frontend public
if exist "!UPDATE_SOURCE!\frontend\public" (
    xcopy "!UPDATE_SOURCE!\frontend\public" "frontend\public\" /E /Y /Q >nul
    echo   [OK] Updated frontend/public
)

REM Copy config files
if exist "!UPDATE_SOURCE!\frontend\package.json" (
    copy "!UPDATE_SOURCE!\frontend\package.json" "frontend\package.json" >nul
    echo   [OK] Updated package.json
)

if exist "!UPDATE_SOURCE!\frontend\vite.config.js" (
    copy "!UPDATE_SOURCE!\frontend\vite.config.js" "frontend\vite.config.js" >nul
    echo   [OK] Updated vite.config.js
)

if exist "!UPDATE_SOURCE!\frontend\index.html" (
    copy "!UPDATE_SOURCE!\frontend\index.html" "frontend\index.html" >nul
    echo   [OK] Updated index.html
)

echo.

REM ============================================================
REM STEP 9: Update scripts and documentation
REM ============================================================

echo [9/13] Updating scripts and docs...
echo.

REM Update batch files (except UPDATE.bat)
REM Copy ROLLBACK.bat if it doesn't exist
if not exist "ROLLBACK.bat" (
    if exist "!UPDATE_SOURCE!\ROLLBACK.bat" (
        copy "!UPDATE_SOURCE!\ROLLBACK.bat" "ROLLBACK.bat" >nul 2>&1
    )
)

REM Copy other batch files
for %%f in ("!UPDATE_SOURCE!\*.bat") do (
    set "filename=%%~nxf"
    if not "!filename!"=="UPDATE.bat" (
        if not "!filename!"=="ROLLBACK.bat" (
            copy "%%f" "%%~nxf" >nul 2>&1
        )
    )
)
echo   [OK] Updated batch files

REM Update Linux folder (shell scripts and Docker files)
if exist "!UPDATE_SOURCE!\linux" (
    if not exist "linux" mkdir linux >nul 2>&1
    xcopy "!UPDATE_SOURCE!\linux" "linux\" /E /Y /Q >nul 2>&1
    echo   [OK] Updated Linux scripts and Docker files
)

REM Update docs
if exist "!UPDATE_SOURCE!\README.md" (
    copy "!UPDATE_SOURCE!\README.md" "README.md" >nul 2>&1
    echo   [OK] Updated README.md
)

if exist "!UPDATE_SOURCE!\CHANGELOG.md" (
    copy "!UPDATE_SOURCE!\CHANGELOG.md" "CHANGELOG.md" >nul 2>&1
    echo   [OK] Updated CHANGELOG.md
)

REM Update version file
echo !NEW_VERSION!> VERSION.txt
echo   [OK] Updated VERSION.txt

REM Copy other files
if exist "!UPDATE_SOURCE!\moonbot-icon.png" (
    copy "!UPDATE_SOURCE!\moonbot-icon.png" "moonbot-icon.png" >nul 2>&1
)

if exist "!UPDATE_SOURCE!\.gitignore" (
    copy "!UPDATE_SOURCE!\.gitignore" ".gitignore" >nul 2>&1
)

echo.

REM ============================================================
REM STEP 10: Restore user data
REM ============================================================

echo [10/13] Restoring user data...
echo.

if exist "%BACKUP_DIR%\.env" (
    copy "%BACKUP_DIR%\.env" "backend\.env" >nul
    echo   [OK] Restored .env
) else (
    echo   [WARNING] No .env to restore
)

if exist "%BACKUP_DIR%\moonbot_commander.db" (
    copy "%BACKUP_DIR%\moonbot_commander.db" "backend\moonbot_commander.db" >nul
    echo   [OK] Restored database
) else (
    echo   [WARNING] No database to restore
)

echo.

REM ============================================================
REM STEP 11: Install dependencies and finalize
REM ============================================================

echo [11/13] Installing dependencies...
echo.

cd backend
python -m pip install --upgrade pip --quiet >nul 2>&1
pip install -r requirements.txt --quiet
echo   [OK] Backend dependencies installed

REM Verify WebSocket support
python -c "import websockets" >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] WebSocket library not found, installing...
    pip install websockets --quiet
    python -c "import websockets" >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERROR] Failed to install websockets!
        cd ..
        pause
        exit /b 1
    )
    echo   [OK] WebSocket support added
) else (
    echo   [OK] WebSocket support confirmed
)

REM Run migrations
python migrate_add_password.py >nul 2>&1
python migrate_add_recovery_codes.py >nul 2>&1
python migrate_add_2fa.py >nul 2>&1
python migrate_scheduled_commands_full.py >nul 2>&1
python migrate_add_timezone.py >nul 2>&1
python migrate_add_scheduler_settings.py >nul 2>&1
python migrate_add_display_time.py >nul 2>&1
python migrate_add_udp_listener.py >nul 2>&1
echo   [OK] Database migrations completed

cd ..\frontend
call npm install --silent >nul 2>&1
echo   [OK] Frontend dependencies installed

REM Clean cache
if exist "dist" rmdir /s /q dist >nul 2>&1
if exist ".vite" rmdir /s /q .vite >nul 2>&1
echo   [OK] Cache cleaned

REM Detect if this is a server installation
set "IS_SERVER=0"
if exist "..\nssm.exe" set "IS_SERVER=1"
if exist "C:\Windows\System32\nssm.exe" set "IS_SERVER=1"

REM Build frontend for production if server
if "!IS_SERVER!"=="1" (
    echo.
    echo   [INFO] Server installation detected
    echo   [INFO] Building frontend for production...
    set NODE_ENV=production
    call npm run build >nul 2>&1
    if !errorlevel! equ 0 (
        echo   [OK] Frontend built for production
    ) else (
        echo   [WARNING] Frontend build failed, but continuing...
    )
)

cd ..

echo.

REM ============================================================
REM STEP 12: Password encryption fix (if needed)
REM ============================================================

echo [12/13] Checking password encryption...
echo.

cd backend

REM Check if database has servers with passwords
python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); c = conn.cursor(); c.execute('SELECT COUNT(*) FROM servers WHERE password IS NOT NULL AND password != \"\"'); count = c.fetchone()[0]; conn.close(); exit(0 if count == 0 else 1)" >nul 2>&1

if !errorlevel! neq 0 (
    echo   [INFO] Found servers with passwords
    echo.
    echo   Some servers may have encryption issues from previous versions.
    echo   This can cause bad_hmac errors.
    echo.
    choice /C YN /M "Do you want to run password encryption fix"
    if errorlevel 1 if not errorlevel 2 (
        echo.
        echo   Running fix_password_encryption.py...
        python fix_password_encryption.py
        if !errorlevel! equ 0 (
            echo   [OK] Password encryption fixed
        ) else (
            echo   [WARNING] Fix script failed, you can run it manually later
        )
    ) else (
        echo   [SKIPPED] You can run it later: cd backend; python fix_password_encryption.py
    )
) else (
    echo   [OK] No password issues detected
)

cd ..

echo.

REM ============================================================
REM STEP 13: Finalize
REM ============================================================

echo [13/13] Finalizing...
echo.

REM ============================================================
REM CLEANUP: Remove temporary files
REM ============================================================

echo Cleaning up temporary files...
rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
del "%TEMP_ZIP%" >nul 2>&1
del "%TEMP_JSON%" >nul 2>&1
echo.

REM ============================================================
REM FINISHED
REM ============================================================

echo.
echo ============================================================
echo            UPDATE COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo Updated from v!CURRENT_VERSION! to v!NEW_VERSION!
echo.
echo Backup saved to: %BACKUP_DIR%
echo.
echo Changes in v!NEW_VERSION!:
if exist "CHANGELOG.md" (
    echo See CHANGELOG.md for details
) else (
    echo   - WebSocket support for real-time updates
    echo   - Improved backend architecture
    echo   - Linux and Docker support
    echo   - Better error handling
)
echo.
echo Next steps:
echo   - Start the application manually
echo   - Check that everything works
echo   - If issues occur, run ROLLBACK.bat
echo.
echo [!] Keep UPDATE.bat for future updates
echo.
pause
endlocal