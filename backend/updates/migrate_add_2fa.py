"""
Migration: Add 2FA support (TOTP/Google Authenticator)
Добавляет поддержку двухфакторной аутентификации
"""
import sys
from pathlib import Path

# Добавляем путь к updates для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, safe_add_column
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
    
    def safe_add_column(conn, table, column, column_type, default=None):
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        if column in [row[1] for row in cursor.fetchall()]:
            return False
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
        if default:
            sql += f" DEFAULT {default}"
        cursor.execute(sql)
        return True


def migrate():
    """Добавить поля для 2FA в таблицу users"""
    try:
        with get_db_connection() as conn:
            added = 0
            
            if safe_add_column(conn, 'users', 'totp_secret', 'VARCHAR(32)'):
                print("[OK] Added 'totp_secret' column")
                added += 1
            else:
                print("[SKIP] Column 'totp_secret' already exists")
            
            if safe_add_column(conn, 'users', 'totp_enabled', 'BOOLEAN', 'FALSE'):
                print("[OK] Added 'totp_enabled' column")
                added += 1
            else:
                print("[SKIP] Column 'totp_enabled' already exists")
            
            conn.commit()
        
        if added > 0:
            print(f"[OK] Migration completed! Added {added} columns")
        else:
            print("[OK] All 2FA columns already exist")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        return False


# Для обратной совместимости
def run_migration():
    return migrate()


if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add 2FA support")
    print("=" * 60)
    print()
    success = migrate()
    print()
    print("=" * 60)
    sys.exit(0 if success else 1)








