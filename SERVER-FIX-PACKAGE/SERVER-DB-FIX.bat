@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🚨 ИСПРАВЛЕНИЕ БАЗЫ ДАННЫХ MOONBOT COMMANDER
echo ============================================================
echo.
echo Этот скрипт исправит проблему с недостающими колонками
echo is_localhost и default_currency
echo.
echo ============================================================
echo.

:: Проверяем наличие Python
python --version >nul 2>&1
if !errorlevel! neq 0 (
    echo ❌ Python не найден!
    echo Установите Python 3.8+ и добавьте его в PATH
    pause
    exit /b 1
)

echo [1/3] Поиск базы данных MoonBot Commander...
echo.

set DB_FOUND=0
set DB_PATH=

:: Ищем БД в текущей папке
if exist moonbot_commander.db (
    set DB_PATH=moonbot_commander.db
    set DB_FOUND=1
    echo ✅ Найдена БД: moonbot_commander.db
)

:: Ищем БД в папке backend
if exist backend\moonbot_commander.db (
    set DB_PATH=backend\moonbot_commander.db
    set DB_FOUND=1
    echo ✅ Найдена БД: backend\moonbot_commander.db
)

:: Ищем БД на уровень выше
if exist ..\moonbot_commander.db (
    set DB_PATH=..\moonbot_commander.db
    set DB_FOUND=1
    echo ✅ Найдена БД: ..\moonbot_commander.db
)

if !DB_FOUND! equ 0 (
    echo ❌ База данных не найдена!
    echo.
    echo Убедитесь что вы запускаете скрипт из папки MoonBot Commander
    pause
    exit /b 1
)

echo.
echo [2/3] Применение исправлений...
python fix_database_columns.py

echo.
echo [3/3] Дополнительные миграции...

:: Применяем миграции напрямую если они есть
if exist migrate_002_add_is_localhost.py (
    echo   - Применение migrate_002_add_is_localhost...
    python migrate_002_add_is_localhost.py 2>nul
)

if exist migrate_add_default_currency.py (
    echo   - Применение migrate_add_default_currency...
    python migrate_add_default_currency.py 2>nul
)

echo.
echo ============================================================
echo ✅ Исправление завершено!
echo.
echo Теперь запустите SERVER-START.bat
echo ============================================================
echo.
pause
