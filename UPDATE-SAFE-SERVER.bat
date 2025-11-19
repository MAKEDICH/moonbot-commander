@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ============================================================
echo     MoonBot Commander - Safe Update System
echo     Version: 2.1.3
echo ============================================================
echo.

REM Check if we're in the right directory
if not exist "backend\main.py" if not exist "frontend\package.json" (
    echo [ERROR] This doesn't look like MoonBot Commander folder!
    echo.
    echo Please place UPDATE-SAFE.bat in the MoonBot Commander folder
    echo where backend/ and frontend/ directories are located.
    echo.
    pause
    exit /b 1
)

REM Download latest release
echo Downloading latest release...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://api.github.com/repos/MAKEDICH/moonbot-commander/releases/latest' -OutFile 'latest_release.json' -UseBasicParsing}"

if not exist "latest_release.json" (
    echo [ERROR] Failed to download release info
    pause
    exit /b 1
)

REM Extract download URL
for /f "delims=" %%i in ('powershell -Command "& {$json = Get-Content 'latest_release.json' | ConvertFrom-Json; $json.assets[0].browser_download_url}"') do set DOWNLOAD_URL=%%i

echo Downloading from: %DOWNLOAD_URL%
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile 'moonbot_update.zip' -UseBasicParsing}"

if not exist "moonbot_update.zip" (
    echo [ERROR] Failed to download update
    del latest_release.json 2>nul
    pause
    exit /b 1
)

REM Create backup
echo Creating backup...
if not exist "BACKUP" mkdir BACKUP
powershell -Command "& {Compress-Archive -Path 'backend', 'frontend', '*.bat', '*.txt', '*.md' -DestinationPath 'BACKUP\backup_%date:~-4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%.zip' -Force}"

REM Extract update
echo Extracting update...
powershell -Command "& {Expand-Archive -Path 'moonbot_update.zip' -DestinationPath 'temp_update' -Force}"

REM Find the extracted folder
for /d %%i in (temp_update\*) do set UPDATE_SOURCE=%%i

REM Copy critical migration files first
echo Copying migration files...
if exist "!UPDATE_SOURCE!\backend\auto_migrate.py" copy "!UPDATE_SOURCE!\backend\auto_migrate.py" "backend\auto_migrate.py" >nul
if exist "!UPDATE_SOURCE!\backend\startup_migrations.py" copy "!UPDATE_SOURCE!\backend\startup_migrations.py" "backend\startup_migrations.py" >nul
if exist "!UPDATE_SOURCE!\backend\fix_currency_on_startup.py" copy "!UPDATE_SOURCE!\backend\fix_currency_on_startup.py" "backend\fix_currency_on_startup.py" >nul

REM Apply critical migrations
echo Applying database migrations...
cd backend
python auto_migrate.py 2>nul || python startup_migrations.py 2>nul
cd ..

REM Update files
echo Updating files...
xcopy "!UPDATE_SOURCE!\backend\*.py" "backend\" /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\backend\api" xcopy "!UPDATE_SOURCE!\backend\api" "backend\api\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\frontend\src" xcopy "!UPDATE_SOURCE!\frontend\src" "frontend\src\" /E /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\*.bat" xcopy "!UPDATE_SOURCE!\*.bat" "." /Y /Q >nul 2>&1
if exist "!UPDATE_SOURCE!\VERSION.txt" copy "!UPDATE_SOURCE!\VERSION.txt" "VERSION.txt" >nul

REM Install dependencies
echo Installing dependencies...
cd backend
python -m pip install -r requirements.txt --quiet
cd ..

REM Cleanup
rd /s /q temp_update 2>nul
del moonbot_update.zip 2>nul
del latest_release.json 2>nul

echo.
echo ============================================================
echo     Update completed successfully to v2.1.3!
echo ============================================================
echo.
echo You can now run SERVER-START-PRODUCTION.bat
echo.
pause
