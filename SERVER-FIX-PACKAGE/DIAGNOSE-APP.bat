@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo      📋 ПОЛНАЯ ДИАГНОСТИКА MOONBOT COMMANDER
echo ============================================================
echo.

echo [1/6] Структура папок:
echo ----------------------
dir /b
echo.

echo [2/6] Поиск ВСЕХ баз данных:
echo -----------------------------
dir /s /b *.db 2>nul
echo.

echo [3/6] Проверка .env файлов:
echo ---------------------------
echo Корневая папка:
if exist .env (
    echo   ✅ .env найден
    findstr "DATABASE_URL" .env 2>nul
) else (
    echo   ❌ .env НЕ найден
)
echo.
echo Backend папка:
if exist backend\.env (
    echo   ✅ backend\.env найден
    findstr "DATABASE_URL" backend\.env 2>nul
) else (
    echo   ❌ backend\.env НЕ найден
)
echo.

echo [4/6] Версии Python пакетов:
echo ----------------------------
pip show sqlalchemy fastapi uvicorn 2>nul | findstr "Name: Version:"
echo.

echo [5/6] Структура БД (все найденные):
echo -----------------------------------
python -c "import sqlite3, os, glob; dbs = glob.glob('**/*.db', recursive=True); [print(f'\n📁 {db}:\n' + ''.join([f'  Таблица: {t[0]}\n' for t in sqlite3.connect(db).cursor().execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()]) if os.path.exists(db) else '') for db in dbs[:5]]" 2>nul
echo.

echo [6/6] Проверка колонок в таблице servers:
echo -----------------------------------------
python -c "import sqlite3, os, glob; dbs = glob.glob('**/*.db', recursive=True); [print(f'\n📁 {db} - servers:\n' + ''.join([f'  - {col[1]} ({col[2]})\n' for col in sqlite3.connect(db).cursor().execute('PRAGMA table_info(servers)').fetchall()]) if os.path.exists(db) and 'servers' in [t[0] for t in sqlite3.connect(db).cursor().execute(\"SELECT name FROM sqlite_master WHERE type='table'\").fetchall()] else '') for db in dbs[:5]]" 2>nul

echo.
echo ============================================================
echo АНАЛИЗ ЗАВЕРШЕН
echo ============================================================
echo.
echo Сохраните этот вывод и отправьте для анализа!
echo.
pause
