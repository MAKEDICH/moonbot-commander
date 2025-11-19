@echo off
chcp 65001 > nul

echo.
echo ============================================================
echo      🔍 ДИАГНОСТИКА БАЗЫ ДАННЫХ
echo ============================================================
echo.

echo Поиск файлов базы данных...
echo.
dir /s /b ..\*.db 2>nul
echo.

echo Проверка структуры БД...
python -c "import sqlite3, os; db_files = [f for f in ['..\moonbot_commander.db', '..\backend\moonbot_commander.db', 'moonbot_commander.db'] if os.path.exists(f)]; [print(f'\n📋 БД: {db}\n' + '\n'.join([f'  - {col[1]}' for col in sqlite3.connect(db).cursor().execute('PRAGMA table_info(servers)').fetchall()]) if os.path.exists(db) else '') for db in db_files] if db_files else print('❌ БД не найдена')"

echo.
pause
