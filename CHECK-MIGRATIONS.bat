@echo off
chcp 65001 > nul
title MoonBot Commander - Migrations Status
color 0B

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║        MoonBot Commander - Migrations Status              ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

cd backend

REM Проверяем применённые миграции
python -c "from migrations_registry import MigrationsRegistry; registry = MigrationsRegistry(); applied = registry.get_applied_migrations(); pending = registry.get_pending_migrations(); print(f'\n[APPLIED MIGRATIONS] ({len(applied)} total)\n'); [print(f'  ✓ {m[\"name\"]:50s} | {m[\"applied_at\"][:19]} | {m[\"status\"]}') for m in applied[:10]]; print(f'\n[PENDING MIGRATIONS] ({len(pending)} total)\n'); [print(f'  ○ {m}') for m in pending]; print(f'\n[DATABASE STATUS]'); import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); cursor = conn.cursor(); cursor.execute('PRAGMA table_info(scheduled_commands)'); cols = [c[1] for c in cursor.fetchall()]; print(f'  • scheduled_commands has {len(cols)} columns'); print(f'  • recurrence_type: {\"YES\" if \"recurrence_type\" in cols else \"NO\"}'); print(f'  • weekdays: {\"YES\" if \"weekdays\" in cols else \"NO\"}'); conn.close(); print()"

cd ..

echo.
echo ════════════════════════════════════════════════════════════
echo.
echo Commands:
echo   - To apply pending migrations: RUN UPDATE-SAFE.bat
echo   - To check database: cd backend; python migrations_registry.py
echo   - To run intelligent migration: cd backend; python intelligent_migration.py
echo   - To check specific table: cd backend; python -c "import sqlite3; conn = sqlite3.connect('moonbot_commander.db'); print(conn.execute('PRAGMA table_info(TABLE_NAME)').fetchall())"
echo.
pause


