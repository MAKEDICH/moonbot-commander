"""
Миграция #001: Добавление поддержки повторяющихся команд и дней недели
Версия: 2024-11-18
Добавляет:
- recurrence_type: тип повторения (once, daily, weekly, monthly, weekly_days)
- weekdays: JSON массив дней недели [0-6] для weekly_days
"""
import sys
import sqlite3
from pathlib import Path

# Добавляем путь для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_path
except ImportError:
    def get_db_path():
        """Fallback для определения пути к БД"""
        backend_dir = Path(__file__).resolve().parent.parent
        db_path = backend_dir / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        return backend_dir.parent / "moonbot_commander.db"


def migrate():
    """Применить миграцию"""
    db_path = get_db_path()
    
    print("[MIGRATION #001] Adding recurrence and weekdays support...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существование таблицы
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_commands'")
        if not cursor.fetchone():
            print("  [INFO] Table 'scheduled_commands' doesn't exist yet, skipping")
            conn.close()
            return True
        
        # Получаем текущие колонки
        cursor.execute("PRAGMA table_info(scheduled_commands)")
        columns = [row[1] for row in cursor.fetchall()]
        
        changes_made = False
        
        # Добавляем recurrence_type если его нет
        if 'recurrence_type' not in columns:
            print("  [+] Adding column 'recurrence_type'...")
            cursor.execute("""
                ALTER TABLE scheduled_commands 
                ADD COLUMN recurrence_type VARCHAR(20) DEFAULT 'once' NOT NULL
            """)
            changes_made = True
            print("  [OK] Column 'recurrence_type' added")
        else:
            print("  [SKIP] Column 'recurrence_type' already exists")
        
        # Добавляем weekdays если его нет
        if 'weekdays' not in columns:
            print("  [+] Adding column 'weekdays'...")
            cursor.execute("""
                ALTER TABLE scheduled_commands 
                ADD COLUMN weekdays TEXT DEFAULT NULL
            """)
            changes_made = True
            print("  [OK] Column 'weekdays' added")
        else:
            print("  [SKIP] Column 'weekdays' already exists")
        
        if changes_made:
            conn.commit()
            print("  [SUCCESS] Migration #001 applied successfully")
        else:
            print("  [SUCCESS] Migration #001 already applied")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"  [ERROR] Migration #001 failed: {e}")
        try:
            conn.rollback()
            conn.close()
        except sqlite3.Error:
            pass  # Rollback/close не удался
        return False
    except Exception as e:
        print(f"  [ERROR] Unexpected error in migration #001: {e}")
        return False

def rollback():
    """Откатить миграцию (не рекомендуется - потеря данных!)"""
    db_path = get_db_path()
    
    print("[ROLLBACK #001] Removing recurrence and weekdays columns...")
    print("  [WARNING] This will delete recurrence data!")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # SQLite не поддерживает DROP COLUMN напрямую
        # Нужно пересоздать таблицу без этих колонок
        print("  [INFO] SQLite doesn't support DROP COLUMN")
        print("  [INFO] To rollback, restore from backup")
        
        conn.close()
        return False
        
    except Exception as e:
        print(f"  [ERROR] Rollback failed: {e}")
        return False

if __name__ == '__main__':
    success = migrate()
    exit(0 if success else 1)


