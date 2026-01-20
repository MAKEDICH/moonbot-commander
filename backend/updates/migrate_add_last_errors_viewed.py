"""
Миграция для добавления колонки last_errors_viewed_at в user_settings
"""
import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    """Получить путь к БД"""
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / "moonbot_commander.db"


def check_migration_needed() -> bool:
    """Проверить нужно ли добавлять колонку"""
    db_path = get_db_path()
    if not db_path.exists():
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        cursor.execute("PRAGMA table_info(user_settings)")
        columns = [row[1] for row in cursor.fetchall()]
        return 'last_errors_viewed_at' not in columns
    finally:
        conn.close()


def run_migration() -> bool:
    """Добавить колонку last_errors_viewed_at"""
    db_path = get_db_path()
    
    if not db_path.exists():
        print(f"[MIGRATION] Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            ALTER TABLE user_settings 
            ADD COLUMN last_errors_viewed_at DATETIME
        """)
        conn.commit()
        print("[MIGRATION] ✅ Column last_errors_viewed_at added to user_settings")
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"[MIGRATION] ❌ Error: {e}")
        return False
    finally:
        conn.close()


if __name__ == "__main__":
    if check_migration_needed():
        run_migration()
    else:
        print("[MIGRATION] Column last_errors_viewed_at already exists")



