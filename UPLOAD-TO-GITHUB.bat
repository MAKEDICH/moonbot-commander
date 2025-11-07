@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot Commander - GitHub Upload
color 0B

echo.
echo ============================================================
echo       MoonBot Commander - Upload to GitHub
echo ============================================================
echo.

REM Check if Git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed!
    echo.
    echo Please install Git:
    echo   1. Download from https://git-scm.com/download/win
    echo   2. Install with default settings
    echo   3. Restart this script
    echo.
    pause
    exit /b 1
)

echo [OK] Git is installed
echo.

REM Check if .gitignore exists
if not exist ".gitignore" (
    echo [ERROR] .gitignore file not found!
    echo.
    echo Please create .gitignore first to protect sensitive data.
    echo.
    pause
    exit /b 1
)

echo [OK] .gitignore found
echo.

REM Ask for GitHub repository URL
echo ============================================================
echo  Enter your GitHub repository URL
echo ============================================================
echo.
echo Example: https://github.com/username/moonbot-commander.git
echo.
set /p REPO_URL="Repository URL: "

if "!REPO_URL!"=="" (
    echo [ERROR] Repository URL cannot be empty!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  IMPORTANT: Security Check
echo ============================================================
echo.
echo This script will:
echo   1. Remove .env files (secrets)
echo   2. Remove *.db files (personal data)
echo   3. Remove *.log files (logs)
echo   4. Keep only source code
echo.
echo ⚠️  Make sure you have backups!
echo.
set /p CONFIRM="Continue? (yes/no): "

if /i not "!CONFIRM!"=="yes" (
    echo [CANCELLED] Upload cancelled
    pause
    exit /b 0
)

echo.
echo ============================================================
echo  Step 1/6: Cleaning sensitive files
echo ============================================================
echo.

REM Remove sensitive files
if exist "backend\.env" (
    del /f /q "backend\.env"
    echo   [OK] Removed backend\.env
)

if exist "backend\moonbot.db" (
    del /f /q "backend\moonbot.db"
    echo   [OK] Removed backend\moonbot.db
)

if exist "backend\*.log" (
    del /f /q "backend\*.log"
    echo   [OK] Removed backend logs
)

if exist "backend\secret_key.txt" (
    del /f /q "backend\secret_key.txt"
    echo   [OK] Removed secret_key.txt
)

if exist "backend\encryption_key.txt" (
    del /f /q "backend\encryption_key.txt"
    echo   [OK] Removed encryption_key.txt
)

echo [OK] Cleanup complete
echo.

REM Initialize Git if needed
if not exist ".git" (
    echo ============================================================
    echo  Step 2/6: Initializing Git repository
    echo ============================================================
    echo.
    
    git init
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to initialize Git repository
        pause
        exit /b 1
    )
    
    echo [OK] Git initialized
    echo.
) else (
    echo [INFO] Git repository already initialized
    echo.
)

echo ============================================================
echo  Step 3/6: Adding files to Git
echo ============================================================
echo.

git add .
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add files
    pause
    exit /b 1
)

echo [OK] Files added
echo.

echo ============================================================
echo  Step 4/6: Creating commit
echo ============================================================
echo.

set /p COMMIT_MSG="Commit message (press Enter for default): "

if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=Initial commit - MoonBot Commander"
)

git commit -m "!COMMIT_MSG!"
if %errorlevel% neq 0 (
    echo [WARNING] Commit failed (maybe no changes?)
    echo Trying to continue...
)

echo [OK] Commit created
echo.

echo ============================================================
echo  Step 5/6: Adding remote repository
echo ============================================================
echo.

REM Remove old remote if exists
git remote remove origin >nul 2>&1

git remote add origin !REPO_URL!
if %errorlevel% neq 0 (
    echo [ERROR] Failed to add remote repository
    pause
    exit /b 1
)

echo [OK] Remote added
echo.

echo ============================================================
echo  Step 6/6: Pushing to GitHub
echo ============================================================
echo.

echo [INFO] You may need to enter your GitHub credentials...
echo.

REM Try to set main branch
git branch -M main >nul 2>&1

REM Push to GitHub
git push -u origin main
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Push failed!
    echo.
    echo Possible reasons:
    echo   1. Wrong repository URL
    echo   2. No access rights
    echo   3. Need to authenticate
    echo.
    echo Try manually:
    echo   git push -u origin main
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo            SUCCESS! Project uploaded to GitHub
echo ============================================================
echo.
echo Repository: !REPO_URL!
echo.
echo Next steps:
echo   1. Check your GitHub repository
echo   2. Update README.md with your info
echo   3. Set repository visibility (public/private)
echo.
echo ============================================================
echo  Future updates (after making changes):
echo ============================================================
echo.
echo 1. git add .
echo 2. git commit -m "Your commit message"
echo 3. git push
echo.
pause
endlocal

