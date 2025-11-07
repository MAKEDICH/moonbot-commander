@echo off
setlocal enabledelayedexpansion
chcp 65001 > nul
title MoonBot - Kill All Processes
color 0C

echo.
echo ============================================================
echo       MoonBot Commander - Kill All Processes
echo ============================================================
echo.
echo This will forcefully terminate ALL MoonBot processes:
echo   - Python (Backend + Scheduler)
echo   - Node.js (Frontend + dev servers)
echo   - NSSM Windows Services (if running)
echo.
echo WARNING: This will kill ALL Python and Node.js processes!
echo          Even if they are not related to MoonBot!
echo.
pause

cd /d "%~dp0"

echo.
echo ============================================================
echo                 AGGRESSIVE CLEANUP MODE
echo ============================================================
echo.

REM ========================================
REM STEP 1: Stop Windows Services
REM ========================================
echo [STEP 1/5] Stopping Windows Services...
echo.

sc query "MoonBotBackend" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping MoonBotBackend...
    net stop MoonBotBackend >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo   [OK]
)

sc query "MoonBotScheduler" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping MoonBotScheduler...
    net stop MoonBotScheduler >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo   [OK]
)

sc query "MoonBotFrontend" >nul 2>&1
if !errorlevel! equ 0 (
    echo Stopping MoonBotFrontend...
    net stop MoonBotFrontend >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo   [OK]
)

echo [STEP 1/5] Services stopped
echo.

REM ========================================
REM STEP 2: Kill processes LOOP
REM ========================================
echo [STEP 2/5] Killing processes (aggressive mode)...
echo.

set MAX_ATTEMPTS=5
set ATTEMPT=0

:KILL_LOOP
set /a ATTEMPT+=1
echo Attempt !ATTEMPT!/!MAX_ATTEMPTS!...

REM Kill Python
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo   Killing Python processes...
    taskkill /F /IM python.exe >nul 2>&1
    taskkill /F /IM pythonw.exe >nul 2>&1
)

REM Kill Node
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo   Killing Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
)

REM Wait a bit
timeout /t 2 /nobreak >nul

REM Check if any processes remain
set "PROCESSES_REMAIN=0"
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 set "PROCESSES_REMAIN=1"

tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 set "PROCESSES_REMAIN=1"

REM If processes remain and we haven't reached max attempts, loop again
if "!PROCESSES_REMAIN!"=="1" (
    if !ATTEMPT! LSS !MAX_ATTEMPTS! (
        echo   Some processes still running, retrying...
        goto KILL_LOOP
    ) else (
        echo   [WARNING] Max attempts reached, some processes may still be running
    )
) else (
    echo   [OK] All processes killed after !ATTEMPT! attempt(s)
)

echo.

REM ========================================
REM STEP 3: Force kill by port (if needed)
REM ========================================
echo [STEP 3/5] Checking ports...
echo.

REM Check port 8000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000.*LISTENING"') do (
    if not "%%a"=="0" (
        echo   Port 8000 occupied by PID %%a, killing...
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Check port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    if not "%%a"=="0" (
        echo   Port 3000 occupied by PID %%a, killing...
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo [STEP 3/5] Ports cleared
echo.

REM ========================================
REM STEP 4: Final wait for TIME_WAIT to clear
REM ========================================
echo [STEP 4/5] Waiting for ports to fully release...
timeout /t 3 /nobreak >nul
echo [STEP 4/5] Done
echo.

REM ========================================
REM STEP 5: Verification
REM ========================================
echo [STEP 5/5] Final verification...
echo.

set "ALL_CLEAN=1"

REM Check Python
tasklist /FI "IMAGENAME eq python.exe" 2>nul | find /I "python.exe" >nul
if !errorlevel! equ 0 (
    echo [WARNING] Python processes still running:
    tasklist /FI "IMAGENAME eq python.exe"
    set "ALL_CLEAN=0"
)

REM Check Node
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if !errorlevel! equ 0 (
    echo [WARNING] Node.js processes still running:
    tasklist /FI "IMAGENAME eq node.exe"
    set "ALL_CLEAN=0"
)

REM Check ports
netstat -ano | findstr ":8000.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 8000 still occupied:
    netstat -ano | findstr ":8000.*LISTENING"
    set "ALL_CLEAN=0"
)

netstat -ano | findstr ":3000.*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo [WARNING] Port 3000 still occupied:
    netstat -ano | findstr ":3000.*LISTENING"
    set "ALL_CLEAN=0"
)

echo.
echo ============================================================
echo                      RESULT
echo ============================================================
echo.

if "!ALL_CLEAN!"=="1" (
    echo [SUCCESS] All MoonBot processes terminated!
    echo [SUCCESS] Ports 3000 and 8000 are FREE!
    echo.
    echo You can now safely run:
    echo   - LOCAL-START.bat
    echo   - SERVER-START.bat
) else (
    echo [WARNING] Some processes or ports could not be cleared.
    echo.
    echo Try these manual steps:
    echo   1. Close all CMD windows manually
    echo   2. Restart your computer
    echo   3. Run this script as Administrator
)

echo.
echo ============================================================
echo                      SUMMARY
echo ============================================================
echo.
echo What was done:
echo   - Stopped Windows Services (if existed)
echo   - Killed Python processes (!MAX_ATTEMPTS! attempts)
echo   - Killed Node.js processes (!MAX_ATTEMPTS! attempts)
echo   - Cleared ports 3000 and 8000
echo   - Waited for TIME_WAIT to clear
echo.
pause
endlocal
