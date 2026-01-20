"""
Migration: Add password field to servers table
Добавляет поддержку паролей HMAC-SHA256 для UDP протокола MoonBot
"""
import sys
from pathlib import Path

# Добавляем путь к updates для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, safe_add_column, column_exists
except ImportError:
    # Fallback если утилиты недоступны
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
    
    def column_exists(conn, table, column):
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        return column in [row[1] for row in cursor.fetchall()]
    
    def safe_add_column(conn, table, column, column_type, default=None):
        if column_exists(conn, table, column):
            return False
        cursor = conn.cursor()
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
        if default:
            sql += f" DEFAULT {default}"
        cursor.execute(sql)
        return True


def migrate():
    """Добавить поле password в таблицу servers"""
    try:
        with get_db_connection() as conn:
            if safe_add_column(conn, 'servers', 'password', 'VARCHAR(255)'):
                print("[OK] Column 'password' successfully added to servers table")
            else:
                print("[SKIP] Column 'password' already exists in servers table")
            
            conn.commit()
        
        print("[OK] Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        return False


# Для обратной совместимости
def run_migration():
    return migrate()


if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add UDP password support")
    print("=" * 60)
    print()
    success = migrate()
    print()
    print("=" * 60)
    sys.exit(0 if success else 1)

