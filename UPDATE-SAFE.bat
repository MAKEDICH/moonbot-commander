@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Safe Auto Update
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - SAFE Auto Update System
echo ============================================================
echo.
echo [INFO] This is a SAFE update script with enhanced migration handling
echo.

REM ============================================================
REM STEP 0: Check current directory
REM ============================================================

if not exist "backend\main.py" (
    if not exist "frontend\package.json" (
        echo [ERROR] This does not look like MoonBot Commander folder!
        echo.
        echo Please place UPDATE-SAFE.bat in your MoonBot Commander folder
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

echo [1/14] Checking current version...
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

echo [2/14] Fetching available versions from GitHub...
echo.

REM Get list of all releases
set "TEMP_RELEASES=%TEMP%\moonbot_releases.json"
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri 'https://api.github.com/repos/MAKEDICH/moonbot-commander/releases' -OutFile '%TEMP_RELEASES%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ERROR] Failed to fetch releases list from GitHub!
    pause
    exit /b 1
)

REM Parse and display available versions
echo Available versions (Current: %CURRENT_VERSION%):
echo.
powershell -Command "$releases = Get-Content '%TEMP_RELEASES%' | ConvertFrom-Json; for ($i=0; $i -lt $releases.Count; $i++) { $tag = $releases[$i].tag_name; $marker = if ($tag -eq 'v%CURRENT_VERSION%' -or $tag -eq '%CURRENT_VERSION%') { ' [INSTALLED]' } else { '' }; Write-Host \"  [$($i+1)] $tag - $($releases[$i].name)$marker\" }"
echo.
echo   [0] Enter custom version manually
echo.

REM Ask user to select version
set /p "VERSION_CHOICE=Select version number: "

set "TEMP_JSON=%TEMP%\moonbot_release.json"

if "%VERSION_CHOICE%"=="0" (
    echo.
    set /p "SPECIFIC_VERSION=Enter version tag (e.g. v2.0.9): "
    echo.
    echo Fetching version !SPECIFIC_VERSION!...
    set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/!SPECIFIC_VERSION!"
) else (
    echo.
    echo Fetching selected version...
    REM Get the selected release tag from the list
    for /f "delims=" %%i in ('powershell -Command "$releases = Get-Content '%TEMP_RELEASES%' | ConvertFrom-Json; $selected = $releases[%VERSION_CHOICE%-1]; Write-Host $selected.tag_name"') do set "SELECTED_TAG=%%i"
    set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/!SELECTED_TAG!"
)

REM Download release info via PowerShell
powershell -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '!GITHUB_API!' -OutFile '%TEMP_JSON%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

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
echo Update: v!CURRENT_VERSION! → v!NEW_VERSION!
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

echo [3/14] Downloading new version...
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

echo [4/14] Extracting files...
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

echo [5/14] Stopping application...
echo.

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo [OK] Application stopped
echo.

REM ============================================================
REM STEP 6: Create backup
REM ============================================================

echo [6/14] Creating comprehensive backup...
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

REM 🎯 НОВОЕ: Backup текущих критичных Python файлов для отката
if exist "backend\udp_listener.py" (
    copy "backend\udp_listener.py" "%BACKUP_DIR%\udp_listener.py" >nul
)
if exist "backend\api\services\cleanup_service.py" (
    mkdir "%BACKUP_DIR%\api\services" >nul 2>&1
    copy "backend\api\services\cleanup_service.py" "%BACKUP_DIR%\api\services\cleanup_service.py" >nul
)

echo.
echo [OK] Backup created at: %BACKUP_DIR%
echo.

REM ============================================================
REM STEP 7: Update Backend files
REM ============================================================

echo [7/14] Updating Backend files...
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

echo [8/14] Updating Frontend files...
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

echo [9/14] Updating scripts and docs...
echo.

REM Update batch files (except UPDATE.bat and UPDATE-SAFE.bat)
for %%f in ("!UPDATE_SOURCE!\*.bat") do (
    set "filename=%%~nxf"
    if not "!filename!"=="UPDATE.bat" (
        if not "!filename!"=="UPDATE-SAFE.bat" (
            if not "!filename!"=="ROLLBACK.bat" (
                copy "%%f" "%%~nxf" /Y >nul 2>&1
            )
        )
    )
)

REM Copy ROLLBACK.bat if it doesn't exist
if not exist "ROLLBACK.bat" (
    if exist "!UPDATE_SOURCE!\ROLLBACK.bat" (
        copy "!UPDATE_SOURCE!\ROLLBACK.bat" "ROLLBACK.bat" /Y >nul 2>&1
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

echo [10/14] Restoring user data...
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
REM STEP 11: Install dependencies
REM ============================================================

echo [11/14] Installing dependencies...
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

echo.

REM ============================================================
REM STEP 12: 🎯 SMART MIGRATION SYSTEM (ORDERED & IDEMPOTENT)
REM ============================================================

echo [12/14] Running database migrations (SAFE MODE)...
echo.

REM 🎯 ПРИОРИТЕТ: Используем intelligent_migration.py если доступен
REM Это автоматически определит какие миграции нужны и применит их в правильном порядке

if exist "intelligent_migration.py" (
    echo   [INFO] Using intelligent migration system...
    echo   [INFO] This will automatically detect and apply all pending migrations
    echo.
    python intelligent_migration.py
    if !errorlevel! equ 0 (
        echo   [OK] Intelligent migration completed successfully
        goto :migrations_done
    ) else (
        echo   [WARNING] Intelligent migration reported issues
        echo   [INFO] Falling back to manual migration list...
        echo.
    )
) else (
    echo   [INFO] intelligent_migration.py not found, using manual migration list...
    echo.
)

:manual_migrations
    REM 🎯 FALLBACK: Запускаем миграции в СТРОГОМ ПОРЯДКЕ
    REM Это гарантирует правильную последовательность применения
    
    echo   [INFO] Applying migrations in correct order...
    echo.
    
    REM Счётчик успешных миграций
    set MIGRATIONS_SUCCESS=0
    set MIGRATIONS_FAILED=0
    
    REM Определяем порядок миграций (от старых к новым)
    REM ВАЖНО: Порядок критически важен! Новые миграции добавляются в конец.
    set "MIGRATION_ORDER=migrate_add_2fa.py migrate_add_password.py migrate_add_keepalive.py migrate_add_udp_listener.py migrate_add_recovery_codes.py migrate_add_scheduler_settings.py migrate_add_timezone.py migrate_add_display_time.py migrate_add_created_from_update.py migrate_add_balance_and_strategies.py migrate_add_balance_fields.py migrate_add_cleanup_settings.py migrate_cleanup_settings_v2.py migrate_moonbot_orders_extended.py migrate_scheduled_commands_full.py migrate_001_recurrence_weekdays.py migrate_002_add_is_localhost.py migrate_add_default_currency.py"
    
    REM Запускаем миграции по порядку
    for %%m in (%MIGRATION_ORDER%) do (
        if exist "%%m" (
            echo   [+] Running %%m...
            python %%m >nul 2>&1
            if !errorlevel! equ 0 (
                echo   [OK] %%m completed
                set /a MIGRATIONS_SUCCESS+=1
            ) else (
                echo   [WARNING] %%m reported an issue
                echo   [INFO] This is OK if the migration was already applied
                set /a MIGRATIONS_FAILED+=1
            )
        ) else (
            echo   [SKIP] %%m not found (normal for older versions)
        )
    )
    
    echo.
    echo   [SUMMARY] Migrations: !MIGRATIONS_SUCCESS! succeeded, !MIGRATIONS_FAILED! skipped/failed
    echo.

:migrations_done

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
if exist "..\SERVER-START-PRODUCTION.bat" set "IS_SERVER=1"

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
REM STEP 13: Password encryption check
REM ============================================================

echo [13/14] Checking password encryption...
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
REM STEP 14: Finalize
REM ============================================================

echo [14/14] Finalizing...
echo.

REM ============================================================
REM CLEANUP: Remove temporary files
REM ============================================================

echo Cleaning up temporary files...
rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
del "%TEMP_ZIP%" >nul 2>&1
del "%TEMP_JSON%" >nul 2>&1
del "%TEMP_RELEASES%" >nul 2>&1
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
    echo   - Smart order status detection
    echo   - Improved log cleanup (rotated files only)
    echo   - Enhanced migration system
    echo   - Bug fixes and improvements
)
echo.
echo Next steps:
echo   1. Start the application:
if "!IS_SERVER!"=="1" (
    echo      SERVER-START.bat  (or SERVER-START-PRODUCTION.bat)
) else (
    echo      LOCAL-START.bat
)
echo   2. Check that everything works
echo   3. If issues occur, run ROLLBACK.bat
echo.
echo [!] Keep UPDATE-SAFE.bat for future updates
echo.
pause
endlocal
