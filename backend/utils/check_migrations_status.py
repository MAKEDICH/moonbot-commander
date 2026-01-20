"""
Скрипт для проверки состояния базы данных и примененных миграций
Удобная визуализация статуса системы
"""
import sqlite3
from pathlib import Path
from updates.core.migrations_registry import MigrationsRegistry

def print_separator(char="=", length=70):
    print(char * length)

def print_header(text):
    print()
    print_separator()
    print(f"  {text}")
    print_separator()
    print()

def check_database_status():
    """Проверить состояние базы данных"""
    db_path = Path(__file__).parent / "moonbot_commander.db"
    
    if not db_path.exists():
        print("[ERROR] Database file not found!")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print_header("DATABASE STATUS")
        
        # Размер БД
        db_size = db_path.stat().st_size / (1024 * 1024)  # MB
        print(f"  Database size: {db_size:.2f} MB")
        print(f"  Location: {db_path}")
        
        # Список таблиц
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"\n  Tables: {len(tables)} total")
        
        # Важные таблицы
        important_tables = ['users', 'servers', 'scheduled_commands', '_migrations_registry']
        for table in important_tables:
            if table in tables:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                count = cursor.fetchone()[0]
                status = "[OK]"
                print(f"    {status} {table:30s} | {count:6d} records")
            else:
                print(f"    [X] {table:30s} | MISSING")
        
        # Проверка scheduled_commands
        if 'scheduled_commands' in tables:
            print_header("SCHEDULED COMMANDS TABLE")
            
            cursor.execute("PRAGMA table_info(scheduled_commands)")
            columns = cursor.fetchall()
            
            print(f"  Columns: {len(columns)} total")
            
            # Важные колонки для повторяющихся команд
            col_names = [col[1] for col in columns]
            important_cols = {
                'recurrence_type': 'Type (once, daily, weekly, monthly, weekly_days)',
                'weekdays': 'JSON array of weekdays [0-6]',
                'timezone': 'User timezone',
                'display_time': 'Display time format'
            }
            
            for col, desc in important_cols.items():
                if col in col_names:
                    print(f"    [OK] {col:20s} | {desc}")
                else:
                    print(f"    [X] {col:20s} | MISSING - {desc}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"[ERROR] Failed to check database: {e}")
        return False

def check_migrations_status():
    """Проверить статус миграций"""
    registry = MigrationsRegistry()
    
    print_header("MIGRATIONS STATUS")
    
    applied = registry.get_applied_migrations()
    pending = registry.get_pending_migrations()
    
    print(f"  Applied: {len(applied)} migrations")
    print(f"  Pending: {len(pending)} migrations")
    
    if applied:
        print("\n  Recently applied:")
        for migration in applied[:5]:
            status_icon = "[OK]" if migration['status'] == 'success' else "[FAIL]"
            print(f"    {status_icon} {migration['name']:40s} | {migration['applied_at'][:19]}")
    
    if pending:
        print("\n  Pending migrations:")
        for migration in pending:
            print(f"    [ ] {migration}")
        print("\n  [ACTION REQUIRED] Run UPDATE.bat to apply pending migrations")
    else:
        print("\n  [OK] All migrations are up to date!")

def main():
    """Главная функция"""
    print()
    print("=" * 70)
    print("     MoonBot Commander - Database & Migrations Status")
    print("=" * 70)
    
    # Проверка БД
    db_ok = check_database_status()
    
    if not db_ok:
        return False
    
    # Проверка миграций
    check_migrations_status()
    
    print()
    print_separator()
    print()
    
    return True

if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)

