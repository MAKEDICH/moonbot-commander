@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      🔍 ДИАГНОСТИКА БАЗЫ ДАННЫХ
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] Поиск файлов базы данных...
echo.
dir /s /b *.db 2>nul
echo.

echo [2/4] Проверка структуры основной БД...
cd backend
python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"PRAGMA table_info(servers)\"); cols = cursor.fetchall(); print('\nКолонки в таблице servers:'); [print(f'  - {col[1]}') for col in cols]; conn.close()"

echo.
echo [3/4] Проверка БД в корневой папке...
cd ..
if exist moonbot_commander.db (
    echo Найдена БД в корне!
    python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute(\"PRAGMA table_info(servers)\"); cols = cursor.fetchall(); print('\nКолонки в таблице servers (корневая БД):'); [print(f'  - {col[1]}') for col in cols]; conn.close()"
) else (
    echo БД в корне не найдена
)

echo.
echo [4/4] Проверка пути к БД в config.py...
cd backend
python -c "from config import settings; print(f'DATABASE_URL: {settings.DATABASE_URL}')"

echo.
echo ============================================================
echo РЕКОМЕНДАЦИИ:
echo.
echo Если БД находится не там где ожидается, скопируйте её
echo в правильное место или обновите DATABASE_URL в .env
echo ============================================================
echo.
pause
