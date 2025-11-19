@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🔧 ИСПРАВЛЕНИЕ ВСЕХ БАЗ ДАННЫХ
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Применение миграций к БД в папке backend...
cd backend
if exist moonbot_commander.db (
    echo   Найдена БД: backend\moonbot_commander.db
    python migrate_002_add_is_localhost.py 2>nul
    python migrate_add_default_currency.py 2>nul
    echo   ✅ Миграции применены
) else (
    echo   ❌ БД не найдена в backend
)

echo.
echo [2/3] Применение миграций к БД в корневой папке...
cd ..
if exist moonbot_commander.db (
    echo   Найдена БД: moonbot_commander.db
    
    :: Копируем миграционные скрипты временно в корень
    copy backend\migrate_002_add_is_localhost.py . >nul 2>&1
    copy backend\migrate_add_default_currency.py . >nul 2>&1
    
    :: Применяем миграции
    python migrate_002_add_is_localhost.py 2>nul
    python migrate_add_default_currency.py 2>nul
    
    :: Удаляем временные файлы
    del migrate_002_add_is_localhost.py >nul 2>&1
    del migrate_add_default_currency.py >nul 2>&1
    
    echo   ✅ Миграции применены
    
    :: Копируем БД в backend если её там нет
    if not exist backend\moonbot_commander.db (
        echo.
        echo   📋 Копирование БД в папку backend...
        copy moonbot_commander.db backend\moonbot_commander.db >nul
        echo   ✅ БД скопирована
    )
) else (
    echo   ❌ БД не найдена в корне
)

echo.
echo [3/3] Перезапуск приложения...
echo.
echo ============================================================
echo ✅ Все найденные базы данных обновлены!
echo.
echo Теперь запустите SERVER-START.bat
echo ============================================================
echo.
pause
