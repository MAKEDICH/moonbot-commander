@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🔧 ИСПРАВЛЕНИЕ МИГРАЦИИ is_localhost
echo ============================================================
echo.

cd /d "%~dp0"
cd backend

echo [1/2] Применение миграции is_localhost...
python migrate_002_add_is_localhost.py
if !errorlevel! neq 0 (
    echo [ERROR] Ошибка при применении миграции
    pause
    exit /b 1
)

echo.
echo [2/2] Обновление реестра миграций...
python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); conn.execute(\"INSERT OR IGNORE INTO migrations_registry (migration_name, applied_at) VALUES ('migrate_002_add_is_localhost', datetime('now'))\"); conn.commit(); print('[OK] Реестр обновлен')"

echo.
echo ✅ Миграция успешно применена!
echo.
echo Теперь вы можете запустить приложение через SERVER-START.bat
echo.
pause
