@echo off
setlocal enabledelayedexpansion
title MoonBot Commander - Safe Update System
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - SAFE UPDATE SYSTEM
echo ============================================================
echo.
echo   + Automatic version detection
echo   + Intelligent DB migrations
echo   + Full backup
echo   + Rollback capability
echo.
echo ============================================================
echo.

REM Check location
if not exist "backend\main.py" (
    if not exist "frontend\package.json" (
        echo [ERROR] This doesn't look like MoonBot Commander folder!
        echo.
        echo Please place UPDATE-SAFE.bat in the MoonBot Commander folder
        echo where backend/ and frontend/ directories are located.
        echo.
        pause
        exit /b 1
    )
)

echo [INFO] MoonBot Commander installation detected
echo.

REM Stop application
echo [1/10] Stopping application...
echo.

tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo Python processes detected
    echo.
    choice /C YN /M "Stop them for safe update"
    if !errorlevel! equ 1 (
        taskkill /F /IM python.exe /T >nul 2>&1
        timeout /t 2 >nul
        echo [OK] Processes stopped
    )
) else (
    echo [OK] No running processes
)

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo Node.js processes detected
    echo.
    choice /C YN /M "Stop them for safe update"
    if !errorlevel! equ 1 (
        taskkill /F /IM node.exe /T >nul 2>&1
        timeout /t 2 >nul
        echo [OK] Processes stopped
    )
) else (
    echo [OK] No running Node.js processes
)

echo.

REM Detect current version
echo [2/10] Detecting current version...
echo.

set CURRENT_VERSION=unknown
if exist "VERSION.txt" (
    set /p CURRENT_VERSION=<VERSION.txt
    echo Version from VERSION.txt: !CURRENT_VERSION!
) else if exist "backend\VERSION.txt" (
    set /p CURRENT_VERSION=<backend\VERSION.txt
    echo Version from backend\VERSION.txt: !CURRENT_VERSION!
) else (
    echo Version file not found, detecting from DB...
    set CURRENT_VERSION=1.0.0
)

REM Run intelligent version detection
if exist "backend\intelligent_migration.py" (
    cd backend
    python -c "from intelligent_migration import IntelligentMigrationSystem; m = IntelligentMigrationSystem(); v, _ = m.detect_current_version(); print(f'DB version detected: {v}')" 2>nul || echo.
    cd ..
)

echo.

REM Create full backup
echo [3/10] Creating full backup...
echo.

REM Create backup folder with timestamp
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YYYY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "Min=%dt:~10,2%"
set "Sec=%dt:~12,2%"
set "TIMESTAMP=%YYYY%%MM%%DD%_%HH%%Min%%Sec%"
set "FULL_BACKUP_DIR=BACKUP\full_backup_%TIMESTAMP%"

mkdir "%FULL_BACKUP_DIR%" 2>nul
mkdir "%FULL_BACKUP_DIR%\backend" 2>nul

REM Backup user-specific data first
echo Saving user data...
if exist "backend\.env" (
    copy "backend\.env" "%FULL_BACKUP_DIR%\backend\.env" >nul
    echo   [OK] .env saved
)

if exist "backend\moonbot_commander.db" (
    copy "backend\moonbot_commander.db" "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" >nul
    echo   [OK] Database saved
)

if exist "moonbot_commander.db" (
    copy "moonbot_commander.db" "%FULL_BACKUP_DIR%\moonbot_commander.db" >nul
)

REM Create archives
echo.
echo Creating archives...

REM Backend archive
powershell -Command "Compress-Archive -Path 'backend\*' -DestinationPath '%FULL_BACKUP_DIR%\backend.zip' -Force" >nul 2>&1
if exist "%FULL_BACKUP_DIR%\backend.zip" echo   [OK] backend.zip

REM Frontend archive
powershell -Command "Compress-Archive -Path 'frontend\*' -DestinationPath '%FULL_BACKUP_DIR%\frontend.zip' -Force" >nul 2>&1
if exist "%FULL_BACKUP_DIR%\frontend.zip" echo   [OK] frontend.zip

REM Scripts archive
powershell -Command "Compress-Archive -Path '*.bat', '*.sh', '*.txt', '*.md', '*.json' -DestinationPath '%FULL_BACKUP_DIR%\scripts.zip' -Force" >nul 2>&1
if exist "%FULL_BACKUP_DIR%\scripts.zip" echo   [OK] scripts.zip

REM Linux files
if exist "linux" (
    powershell -Command "Compress-Archive -Path 'linux\*' -DestinationPath '%FULL_BACKUP_DIR%\linux.zip' -Force" >nul 2>&1
    if exist "%FULL_BACKUP_DIR%\linux.zip" echo   [OK] linux.zip
)

echo.
echo [OK] Full backup created: %FULL_BACKUP_DIR%
echo.

REM Check for latest release
echo [4/10] Checking for latest release...
echo.

echo Fetching release information...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri 'https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/latest' -OutFile 'latest_release.json' -UseBasicParsing } catch { Write-Host 'Failed to download release info'; exit 1 }" >nul 2>&1

if not exist "latest_release.json" (
    echo [ERROR] Failed to get release information!
    echo.
    echo Please check your internet connection and try again.
    echo.
    pause
    exit /b 1
)

REM Get version and download URL
for /f "delims=" %%a in ('powershell -Command "$json = Get-Content 'latest_release.json' -Raw | ConvertFrom-Json; $json.tag_name -replace '^v', ''"') do set "NEW_VERSION=%%a"
for /f "delims=" %%a in ('powershell -Command "$json = Get-Content 'latest_release.json' -Raw | ConvertFrom-Json; $json.assets[0].browser_download_url"') do set "DOWNLOAD_URL=%%a"

echo Current version: !CURRENT_VERSION!
echo Latest version: !NEW_VERSION!

if not defined DOWNLOAD_URL (
    echo.
    echo [WARNING] Could not get download URL from release info.
    echo Trying to construct URL manually...
    set "DOWNLOAD_URL=https://github.com/MAKEDICH/moonbot-commander/releases/download/v!NEW_VERSION!/moonbot-commander-!NEW_VERSION!.zip"
)

echo Download URL: !DOWNLOAD_URL!
echo.

if "!CURRENT_VERSION!"=="!NEW_VERSION!" (
    echo [INFO] You have the latest version!
    echo.
    choice /C YN /M "Continue update anyway"
    if !errorlevel! neq 1 (
        del latest_release.json 2>nul
        pause
        exit /b 0
    )
)

echo.

REM Download latest release
echo [5/10] Downloading update...
echo.

if not defined DOWNLOAD_URL (
    echo [ERROR] Download URL is empty!
    echo.
    del latest_release.json 2>nul
    pause
    exit /b 1
)

echo Downloading from: !DOWNLOAD_URL!
echo.

echo Downloading from GitHub...
powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '!DOWNLOAD_URL!' -OutFile 'moonbot_update.zip' -UseBasicParsing } catch { Write-Host 'Download failed: ' + $_.Exception.Message; exit 1 }"

if not exist "moonbot_update.zip" (
    echo.
    echo Trying alternative download method...
    powershell -Command "(New-Object System.Net.WebClient).DownloadFile('!DOWNLOAD_URL!', 'moonbot_update.zip')" 2>nul
    
    if not exist "moonbot_update.zip" (
        echo [ERROR] Failed to download update!
        echo.
        echo Manual download URL: !DOWNLOAD_URL!
        echo.
        echo You can download manually and place as "moonbot_update.zip" in this folder.
        echo.
        del latest_release.json 2>nul
        pause
        exit /b 1
    )
)

echo [OK] Update downloaded
echo.

REM Extract update
echo [6/10] Extracting update...
echo.

if exist "temp_update" rd /s /q "temp_update" 2>nul
powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('moonbot_update.zip', 'temp_update')" >nul 2>&1

if not exist "temp_update" (
    echo [ERROR] Failed to extract update!
    echo.
    del moonbot_update.zip 2>nul
    del latest_release.json 2>nul
    pause
    exit /b 1
)

REM Find extracted folder
set "UPDATE_SOURCE="
for /d %%i in (temp_update\*) do set "UPDATE_SOURCE=%%i"

if not defined UPDATE_SOURCE (
    echo [ERROR] Invalid archive structure!
    echo.
    rd /s /q temp_update 2>nul
    del moonbot_update.zip 2>nul
    del latest_release.json 2>nul
    pause
    exit /b 1
)

echo [OK] Update extracted
echo.

REM Update files
echo [7/10] Updating application files...
echo.

REM Backend
echo Updating Backend...
xcopy "!UPDATE_SOURCE!\backend\*.py" "backend\" /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\api" xcopy "!UPDATE_SOURCE!\backend\api" "backend\api\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\alembic" xcopy "!UPDATE_SOURCE!\backend\alembic" "backend\alembic\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\requirements.txt" copy "!UPDATE_SOURCE!\backend\requirements.txt" "backend\requirements.txt" >nul
REM Important new files
if exist "!UPDATE_SOURCE!\backend\auto_migrate.py" copy "!UPDATE_SOURCE!\backend\auto_migrate.py" "backend\auto_migrate.py" >nul
if exist "!UPDATE_SOURCE!\backend\startup_migrations.py" copy "!UPDATE_SOURCE!\backend\startup_migrations.py" "backend\startup_migrations.py" >nul
if exist "!UPDATE_SOURCE!\backend\fix_currency_on_startup.py" copy "!UPDATE_SOURCE!\backend\fix_currency_on_startup.py" "backend\fix_currency_on_startup.py" >nul

REM Frontend
echo Updating Frontend...
if exist "!UPDATE_SOURCE!\frontend\src" xcopy "!UPDATE_SOURCE!\frontend\src" "frontend\src\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\frontend\public" xcopy "!UPDATE_SOURCE!\frontend\public" "frontend\public\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\frontend\index.html" copy "!UPDATE_SOURCE!\frontend\index.html" "frontend\index.html" >nul
if exist "!UPDATE_SOURCE!\frontend\vite.config.js" copy "!UPDATE_SOURCE!\frontend\vite.config.js" "frontend\vite.config.js" >nul
if exist "!UPDATE_SOURCE!\frontend\package.json" copy "!UPDATE_SOURCE!\frontend\package.json" "frontend\package.json" >nul
if exist "!UPDATE_SOURCE!\frontend\package-lock.json" copy "!UPDATE_SOURCE!\frontend\package-lock.json" "frontend\package-lock.json" >nul

REM Scripts and configs
echo Updating scripts...
if exist "!UPDATE_SOURCE!\*.bat" copy "!UPDATE_SOURCE!\*.bat" "." >nul 2>&1
if exist "!UPDATE_SOURCE!\VERSION.txt" copy "!UPDATE_SOURCE!\VERSION.txt" "." >nul
if exist "!UPDATE_SOURCE!\CHANGELOG.md" copy "!UPDATE_SOURCE!\CHANGELOG.md" "." >nul
if exist "!UPDATE_SOURCE!\README.md" copy "!UPDATE_SOURCE!\README.md" "." >nul

REM Linux
if exist "!UPDATE_SOURCE!\linux" (
    echo Updating Linux scripts...
    if not exist "linux" mkdir "linux"
    xcopy "!UPDATE_SOURCE!\linux" "linux\" /E /Y /Q >nul 2>&1
)

REM Restore user-specific data
echo.
echo Restoring user data...
if exist "%FULL_BACKUP_DIR%\backend\.env" (
    copy "%FULL_BACKUP_DIR%\backend\.env" "backend\.env" >nul
    echo   [OK] .env restored
)

if exist "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" (
    copy "%FULL_BACKUP_DIR%\backend\moonbot_commander.db" "backend\moonbot_commander.db" >nul
    echo   [OK] Database restored
)

if exist "%FULL_BACKUP_DIR%\moonbot_commander.db" (
    copy "%FULL_BACKUP_DIR%\moonbot_commander.db" "." >nul
)

echo [OK] Files updated
echo.

REM Apply migrations
echo [8/10] Applying migrations...
echo.

cd backend

REM First apply automatic migrations to all DBs
echo Applying automatic migrations...
if exist "auto_migrate.py" (
    python auto_migrate.py
    echo [OK] Automatic migrations applied
) else if exist "startup_migrations.py" (
    python startup_migrations.py
    echo [OK] Startup migrations applied
) else (
    echo [WARNING] No automatic migration scripts found
)

REM Use intelligent migration system if available
if exist "intelligent_migration.py" (
    echo.
    echo Running intelligent migration system...
    python intelligent_migration.py
) else (
    echo.
    echo Running traditional migrations...
    REM Apply migrations to backend DB
    if exist "moonbot_commander.db" (
        echo Applying migrations to backend DB...
        for %%f in (migrate_*.py) do (
            if exist "%%f" (
                python "%%f" >nul 2>&1
            )
        )
    )
    
    REM Apply migrations to root DB if exists
    cd ..
    if exist "moonbot_commander.db" (
        echo.
        echo Applying migrations to root DB...
        for %%f in (backend\migrate_*.py) do (
            if exist "%%f" (
                python "%%f" >nul 2>&1
            )
        )
    )
    cd backend
)

cd ..
echo.

REM Install dependencies
echo [9/10] Installing dependencies...
echo.

cd backend
echo Installing Backend dependencies...
python -m pip install -r requirements.txt --upgrade --quiet

cd ..\frontend
echo Installing Frontend dependencies...
call npm install --silent

cd ..
echo.

REM Cleanup
echo [10/10] Cleanup...
echo.

rd /s /q temp_update 2>nul
del moonbot_update.zip 2>nul
del latest_release.json 2>nul

echo [OK] Cleanup completed
echo.

REM Final version info
if exist "backend\intelligent_migration.py" (
    cd backend
    python -c "from intelligent_migration import IntelligentMigrationSystem; m = IntelligentMigrationSystem(); v, _ = m.detect_current_version(); print(f'Final DB version: {v}')" 2>nul || echo.
    cd ..
)

echo.
echo ============================================================
echo          UPDATE COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo Updated: v!CURRENT_VERSION! to v!NEW_VERSION!
echo.
echo [BACKUP] Full backup saved in: %FULL_BACKUP_DIR%
echo.
echo What's next:
echo   - For local development: run LOCAL-START.bat
echo   - For server: run SERVER-START.bat or SERVER-START-PRODUCTION.bat
echo.
echo If you have any issues, you can rollback using:
echo   ROLLBACK.bat
echo.
echo ============================================================
echo.
pause