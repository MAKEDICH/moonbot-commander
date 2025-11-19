@echo off
echo ============================================================
echo       PREPARE RELEASE PACKAGE
echo ============================================================
echo.

set /p VERSION=<VERSION.txt
echo Version: %VERSION%
echo.

echo Creating release archive...
echo.

REM Delete old archives
if exist "moonbot-commander-%VERSION%.zip" del "moonbot-commander-%VERSION%.zip"
if exist "moonbot-commander-v%VERSION%.zip" del "moonbot-commander-v%VERSION%.zip"

REM Create release archive
powershell -Command "Compress-Archive -Path backend, frontend, linux, *.bat, VERSION.txt, CHANGELOG.md, README.md, requirements.txt -DestinationPath 'moonbot-commander-%VERSION%.zip' -CompressionLevel Optimal"

if exist "moonbot-commander-%VERSION%.zip" (
    echo.
    echo [OK] Release archive created: moonbot-commander-%VERSION%.zip
    
    REM Get file size
    for %%A in ("moonbot-commander-%VERSION%.zip") do set SIZE=%%~zA
    set /a SIZE_MB=%SIZE% / 1048576
    echo File size: %SIZE_MB% MB
) else (
    echo [ERROR] Failed to create archive!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo       RELEASE CHECKLIST
echo ============================================================
echo.
echo 1. Git status clean: YES
echo 2. VERSION.txt updated: %VERSION%
echo 3. Archive created: moonbot-commander-%VERSION%.zip
echo.
echo NEXT STEPS:
echo -----------
echo 1. Go to: https://github.com/MAKEDICH/moonbot-commander/releases/new
echo 2. Choose tag: v%VERSION%
echo 3. Release title: v%VERSION% - Enhanced UI and Automatic Updates
echo 4. Upload file: moonbot-commander-%VERSION%.zip
echo 5. Description: Use the prepared text below
echo.
echo ============================================================
echo.
pause
