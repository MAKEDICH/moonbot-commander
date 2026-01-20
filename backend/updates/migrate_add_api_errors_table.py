"""
Миграция для создания таблицы moonbot_api_errors
"""
import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    """Получить путь к БД"""
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / "moonbot_commander.db"


def check_migration_needed() -> bool:
    """Проверить нужно ли создавать таблицу"""
    db_path = get_db_path()
    if not db_path.exists():
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='moonbot_api_errors'
        """)
        exists = cursor.fetchone() is not None
        return not exists
    finally:
        conn.close()


def run_migration() -> bool:
    """Создать таблицу moonbot_api_errors"""
    db_path = get_db_path()
    
    if not db_path.exists():
        print(f"[MIGRATION] Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Создаём таблицу
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moonbot_api_errors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                bot_name VARCHAR,
                error_text TEXT NOT NULL,
                error_time DATETIME,
                symbol VARCHAR,
                error_code INTEGER,
                received_at DATETIME,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        # Создаём индекс
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_moonbot_api_errors_server_received 
            ON moonbot_api_errors(server_id, received_at)
        """)
        
        conn.commit()
        print("[MIGRATION] ✅ Table moonbot_api_errors created")
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
        print("[MIGRATION] Table moonbot_api_errors already exists")



