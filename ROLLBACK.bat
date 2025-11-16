@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - Rollback
color 0C

echo.
echo ============================================================
echo       MoonBot Commander - Rollback System
echo ============================================================
echo.
echo WARNING: This will restore your application code to a
echo          previous version while keeping your current data
echo.

REM ============================================================
REM STEP 1: Find available backups
REM ============================================================

echo Available backups:
echo.

set "COUNT=0"
if exist "backups" (
    for /f "delims=" %%d in ('dir /b /ad /o-d "backups"') do (
        set /a COUNT+=1
        set "BACKUP_!COUNT!=%%d"
        echo   !COUNT!. %%d
    )
)

if !COUNT! EQU 0 (
    echo [ERROR] No backups found!
    echo.
    echo Backups are automatically created when you run UPDATE.bat
    echo.
    pause
    exit /b 1
)

echo.
set /p "CHOICE=Select backup to restore (1-!COUNT!, or 0 to cancel): "

if "%CHOICE%"=="0" (
    echo Rollback cancelled
    pause
    exit /b 0
)

if %CHOICE% LSS 1 goto invalid_choice
if %CHOICE% GTR !COUNT! goto invalid_choice

set "SELECTED_BACKUP=!BACKUP_%CHOICE%!"
set "BACKUP_PATH=backups\!SELECTED_BACKUP!"
echo.
echo Selected backup: !SELECTED_BACKUP!
echo.

REM Extract version from backup name (e.g., v1.1.2_2024-11-11_...)
for /f "tokens=1 delims=_" %%v in ("!SELECTED_BACKUP!") do set "TARGET_VERSION=%%v"

if not defined TARGET_VERSION (
    echo [ERROR] Cannot determine version from backup name
    echo.
    pause
    exit /b 1
)

echo Target version: !TARGET_VERSION!
echo.

REM ============================================================
REM STEP 2: Confirm rollback
REM ============================================================

echo WARNING: This will:
echo   - Stop the application
echo   - Download code version !TARGET_VERSION! from GitHub
echo   - Replace application files with !TARGET_VERSION!
echo   - KEEP your current database (all servers, settings, orders)
echo   - KEEP your current .env (encryption keys)
echo   - Your data will be preserved!
echo.

choice /C YN /M "Are you sure you want to continue"
if errorlevel 2 (
    echo Rollback cancelled
    pause
    exit /b 0
)

echo.

REM ============================================================
REM STEP 3: Download target version from GitHub
REM ============================================================

echo [1/7] Downloading version !TARGET_VERSION! from GitHub...
echo.

set "GITHUB_API=https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/tags/!TARGET_VERSION!"
set "TEMP_JSON=%TEMP%\moonbot_rollback.json"
set "TEMP_ZIP=%TEMP%\moonbot_rollback.zip"
set "TEMP_EXTRACT=%TEMP%\moonbot_rollback_extract"

REM Get release info
powershell -Command "try { $ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%GITHUB_API%' -OutFile '%TEMP_JSON%' -UseBasicParsing } catch { exit 1 }" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ERROR] Failed to get release info from GitHub!
    echo.
    echo Possible reasons:
    echo   - Version !TARGET_VERSION! not found on GitHub
    echo   - No internet connection
    echo   - GitHub is not accessible
    echo.
    pause
    exit /b 1
)

REM Get download URL
for /f "tokens=*" %%a in ('powershell -Command "(Get-Content '%TEMP_JSON%' | ConvertFrom-Json).zipball_url"') do set "DOWNLOAD_URL=%%a"

if not defined DOWNLOAD_URL (
    echo [ERROR] Failed to get download URL!
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo Downloading from GitHub...
powershell -Command "$ProgressPreference = 'SilentlyContinue'; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%TEMP_ZIP%' -UseBasicParsing"

if !errorlevel! neq 0 (
    echo [ERROR] Download failed!
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

echo [OK] Downloaded
echo.

REM ============================================================
REM STEP 4: Extract files
REM ============================================================

echo [2/7] Extracting files...
echo.

if exist "%TEMP_EXTRACT%" rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
mkdir "%TEMP_EXTRACT%" >nul 2>&1

powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%TEMP_EXTRACT%' -Force" >nul 2>&1

if !errorlevel! neq 0 (
    echo [ERROR] Extraction failed!
    rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
    del "%TEMP_ZIP%" >nul 2>&1
    del "%TEMP_JSON%" >nul 2>&1
    pause
    exit /b 1
)

REM Find extracted folder
for /d %%d in ("%TEMP_EXTRACT%\*") do set "ROLLBACK_SOURCE=%%d"

if not exist "!ROLLBACK_SOURCE!\backend\main.py" (
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

echo [3/7] Stopping application...
echo.

taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo [OK] Application stopped
echo.

REM ============================================================
REM STEP 6: Backup current state (safety)
REM ============================================================

echo [4/7] Creating safety backup...
echo.

set "SAFETY_BACKUP=backups\safety_before_rollback_%date:~-4,4%-%date:~-7,2%-%date:~-10,2%_%time:~0,2%-%time:~3,2%-%time:~6,2%"
set "SAFETY_BACKUP=%SAFETY_BACKUP: =0%"

mkdir "%SAFETY_BACKUP%" >nul 2>&1

if exist "backend\.env" (
    copy "backend\.env" "%SAFETY_BACKUP%\.env" >nul
)

if exist "backend\moonbot_commander.db" (
    copy "backend\moonbot_commander.db" "%SAFETY_BACKUP%\moonbot_commander.db" >nul
)

if exist "VERSION.txt" (
    copy "VERSION.txt" "%SAFETY_BACKUP%\VERSION.txt" >nul
)

echo [OK] Safety backup created at: %SAFETY_BACKUP%
echo.

REM ============================================================
REM STEP 7: Replace application code
REM ============================================================

echo [5/7] Restoring application code to !TARGET_VERSION!...
echo.

REM Backend files
for %%f in ("!ROLLBACK_SOURCE!\backend\*.py") do (
    copy "%%f" "backend\%%~nxf" >nul
)
echo   [OK] Backend Python files restored

if exist "!ROLLBACK_SOURCE!\backend\requirements.txt" (
    copy "!ROLLBACK_SOURCE!\backend\requirements.txt" "backend\requirements.txt" >nul
    echo   [OK] requirements.txt restored
)

if exist "!ROLLBACK_SOURCE!\backend\.env.example" (
    copy "!ROLLBACK_SOURCE!\backend\.env.example" "backend\.env.example" >nul
    echo   [OK] .env.example restored
)

REM Frontend files
if exist "!ROLLBACK_SOURCE!\frontend\src" (
    xcopy "!ROLLBACK_SOURCE!\frontend\src" "frontend\src\" /E /Y /Q >nul
    echo   [OK] Frontend source restored
)

if exist "!ROLLBACK_SOURCE!\frontend\public" (
    xcopy "!ROLLBACK_SOURCE!\frontend\public" "frontend\public\" /E /Y /Q >nul
    echo   [OK] Frontend public restored
)

if exist "!ROLLBACK_SOURCE!\frontend\package.json" (
    copy "!ROLLBACK_SOURCE!\frontend\package.json" "frontend\package.json" >nul
    echo   [OK] package.json restored
)

if exist "!ROLLBACK_SOURCE!\frontend\vite.config.js" (
    copy "!ROLLBACK_SOURCE!\frontend\vite.config.js" "frontend\vite.config.js" >nul
)

if exist "!ROLLBACK_SOURCE!\frontend\index.html" (
    copy "!ROLLBACK_SOURCE!\frontend\index.html" "frontend\index.html" >nul
)

REM Batch files (except UPDATE.bat, ROLLBACK.bat)
set "BAT_RESTORED=0"
for %%f in ("!ROLLBACK_SOURCE!\*.bat") do (
    set "filename=%%~nxf"
    if not "!filename!"=="UPDATE.bat" (
        if not "!filename!"=="ROLLBACK.bat" (
            copy "%%f" "%%~nxf" >nul 2>&1
            set "BAT_RESTORED=1"
        )
    )
)
if "!BAT_RESTORED!"=="1" (
    echo   [OK] Batch files restored
)

REM Shell scripts and Docker files (for old versions they were in root)
set "LINUX_RESTORED=0"
if exist "!ROLLBACK_SOURCE!\*.sh" (
    REM Old version: scripts in root, copy to linux/ folder
    if not exist "linux" mkdir linux >nul 2>&1
    for %%f in ("!ROLLBACK_SOURCE!\*.sh") do (
        copy "%%f" "linux\%%~nxf" >nul 2>&1
        set "LINUX_RESTORED=1"
    )
)
if exist "!ROLLBACK_SOURCE!\linux" (
    REM New version: scripts already in linux/ folder
    xcopy "!ROLLBACK_SOURCE!\linux" "linux\" /E /Y /Q >nul 2>&1
    set "LINUX_RESTORED=1"
)
if "!LINUX_RESTORED!"=="1" (
    echo   [OK] Linux scripts restored
)

REM Docker files (may be in root or linux/ folder)
if exist "!ROLLBACK_SOURCE!\docker-compose.yml" (
    copy "!ROLLBACK_SOURCE!\docker-compose.yml" "linux\docker-compose.yml" >nul 2>&1
)
if exist "!ROLLBACK_SOURCE!\docker-start.sh" (
    copy "!ROLLBACK_SOURCE!\docker-start.sh" "linux\docker-start.sh" >nul 2>&1
)
if exist "!ROLLBACK_SOURCE!\docker-stop.sh" (
    copy "!ROLLBACK_SOURCE!\docker-stop.sh" "linux\docker-stop.sh" >nul 2>&1
)

REM Documentation
if exist "!ROLLBACK_SOURCE!\README.md" (
    copy "!ROLLBACK_SOURCE!\README.md" "README.md" >nul 2>&1
)

if exist "!ROLLBACK_SOURCE!\CHANGELOG.md" (
    copy "!ROLLBACK_SOURCE!\CHANGELOG.md" "CHANGELOG.md" >nul 2>&1
)

REM Update VERSION.txt
echo !TARGET_VERSION!> VERSION.txt
echo   [OK] VERSION.txt updated to !TARGET_VERSION!

echo.
echo [OK] Application code restored to !TARGET_VERSION!
echo.

REM ============================================================
REM STEP 8: Install dependencies
REM ============================================================

echo [6/7] Installing dependencies...
echo.

cd backend
python -m pip install --upgrade pip --quiet >nul 2>&1
pip install -r requirements.txt --quiet
echo   [OK] Backend dependencies installed

REM Verify websockets
python -c "import websockets" >nul 2>&1
if !errorlevel! neq 0 (
    echo   [WARNING] Installing websockets...
    pip install websockets --quiet
)
echo   [OK] WebSocket support confirmed

cd ..\frontend
call npm install --silent >nul 2>&1
echo   [OK] Frontend dependencies installed

REM Clean cache
if exist "dist" rmdir /s /q dist >nul 2>&1
if exist ".vite" rmdir /s /q .vite >nul 2>&1
echo   [OK] Cache cleaned

cd ..

echo.

REM ============================================================
REM STEP 9: Cleanup
REM ============================================================

echo [7/7] Cleaning up...
echo.

rmdir /s /q "%TEMP_EXTRACT%" >nul 2>&1
del "%TEMP_ZIP%" >nul 2>&1
del "%TEMP_JSON%" >nul 2>&1

echo [OK] Temporary files removed
echo.

REM ============================================================
REM FINISHED
REM ============================================================

echo.
echo ============================================================
echo            ROLLBACK COMPLETED SUCCESSFULLY!
echo ============================================================
echo.
echo Application rolled back to: !TARGET_VERSION!
echo.
echo YOUR DATA IS PRESERVED:
echo   [OK] Database - all servers, orders, settings intact
echo   [OK] Encryption keys - .env unchanged
echo   [OK] All user data preserved
echo.
echo Safety backup created at:
echo   %SAFETY_BACKUP%
echo.
echo Next steps:
echo   1. Start application with LOCAL-START.bat or SERVER-START.bat
echo   2. Verify that everything works correctly
echo   3. Your data should be intact
echo.
echo If you need to undo this rollback, manually restore from:
echo   %SAFETY_BACKUP%
echo.
pause
endlocal
exit /b 0

:invalid_choice
echo.
echo [ERROR] Invalid choice!
echo.
pause
exit /b 1

