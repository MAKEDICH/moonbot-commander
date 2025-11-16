@echo off
chcp 65001 > nul
title MoonBot Commander - Database Migration Fix
color 0E

echo.
echo ============================================================
echo       MoonBot Commander - Database Migration Fix
echo ============================================================
echo.
echo This script will run all database migrations to fix the
echo "no such column" error after updating to v2.0.0
echo.
echo Safe to run multiple times - already applied migrations
echo will be skipped automatically.
echo.
pause

echo.
echo [INFO] Running database migrations...
echo.

cd backend

echo [1/13] migrate_add_password.py
python migrate_add_password.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [2/13] migrate_add_recovery_codes.py
python migrate_add_recovery_codes.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [3/13] migrate_add_2fa.py
python migrate_add_2fa.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [4/13] migrate_scheduled_commands_full.py
python migrate_scheduled_commands_full.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [5/13] migrate_add_timezone.py
python migrate_add_timezone.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [6/13] migrate_add_scheduler_settings.py
python migrate_add_scheduler_settings.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [7/13] migrate_add_display_time.py
python migrate_add_display_time.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [8/13] migrate_add_udp_listener.py
python migrate_add_udp_listener.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [9/13] migrate_add_keepalive.py
python migrate_add_keepalive.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [10/13] migrate_add_balance_and_strategies.py
python migrate_add_balance_and_strategies.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [11/13] migrate_add_cleanup_settings.py
python migrate_add_cleanup_settings.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [12/13] migrate_cleanup_settings_v2.py
python migrate_cleanup_settings_v2.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

echo [13/13] migrate_moonbot_orders_extended.py
python migrate_moonbot_orders_extended.py
if !errorlevel! equ 0 (echo   [OK]) else (echo   [SKIP or ERROR])

cd ..

echo.
echo ============================================================
echo                  MIGRATIONS COMPLETED!
echo ============================================================
echo.
echo Now you can start the application:
echo   - LOCAL-START.bat   (for local PC)
echo   - SERVER-START.bat  (for server)
echo.
pause

