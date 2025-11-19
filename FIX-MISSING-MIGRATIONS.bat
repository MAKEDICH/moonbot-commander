@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🔧 ИСПРАВЛЕНИЕ НЕДОСТАЮЩИХ МИГРАЦИЙ
echo ============================================================
echo.

cd /d "%~dp0"
cd backend

echo [INFO] Проверка и применение критических миграций...
echo.

:: Миграция 1: is_localhost
echo [1/3] Проверка миграции is_localhost...
python migrate_002_add_is_localhost.py 2>nul
if !errorlevel! equ 0 (
    echo   ✅ is_localhost - применена
) else (
    echo   ❌ Ошибка при применении is_localhost
)

:: Миграция 2: default_currency
echo [2/3] Проверка миграции default_currency...
python migrate_add_default_currency.py 2>nul
if !errorlevel! equ 0 (
    echo   ✅ default_currency - применена
) else (
    echo   ❌ Ошибка при применении default_currency
)

:: Полная интеллектуальная миграция
echo.
echo [3/3] Запуск полной проверки миграций...
python intelligent_migration.py
if !errorlevel! neq 0 (
    echo.
    echo [WARNING] Интеллектуальная миграция недоступна
    echo Применяем все миграции вручную...
    
    for %%f in (migrate_*.py) do (
        echo   - Применение %%f...
        python %%f 2>nul
    )
)

echo.
echo ============================================================
echo ✅ Проверка миграций завершена!
echo.
echo Теперь запустите SERVER-START.bat
echo ============================================================
echo.
pause
