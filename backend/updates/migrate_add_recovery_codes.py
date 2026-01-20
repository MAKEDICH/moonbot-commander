"""
Migration: Add recovery codes table
Добавляет таблицу для хранения кодов восстановления 2FA
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, safe_create_table, table_exists
except ImportError:
    import sqlite3
    from contextlib import contextmanager
    
    def get_db_path():
        current = Path(__file__).resolve().parent.parent
        return current / "moonbot_commander.db"
    
    @contextmanager
    def get_db_connection():
        conn = sqlite3.connect(str(get_db_path()))
        try:
            yield conn
        finally:
            conn.close()
    
    def table_exists(conn, table):
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        return cursor.fetchone() is not None


def migrate():
    """Создать таблицу recovery_codes"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if table_exists(conn, 'recovery_codes'):
                print("[SKIP] Table 'recovery_codes' already exists")
                return True
            
            cursor.execute("""
                CREATE TABLE recovery_codes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    code_hash VARCHAR NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    used_at DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
                )
            """)
            
            conn.commit()
        
        print("[OK] Table 'recovery_codes' created successfully")
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        return False


def run_migration():
    return migrate()


if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add recovery codes support")
    print("=" * 60)
    print()
    success = migrate()
    print()
    print("=" * 60)
    sys.exit(0 if success else 1)








