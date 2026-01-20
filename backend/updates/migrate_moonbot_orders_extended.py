"""
Миграция: Добавление расширенных метрик в таблицу moonbot_orders
Добавляет поля для эмулятора, сигналов, метрик производительности
"""
import sys
from pathlib import Path

# Добавляем путь к updates для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, safe_add_column, safe_create_index, get_columns, table_exists
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
    
    def table_exists(conn, table):
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,))
        return cursor.fetchone() is not None
    
    def get_columns(conn, table):
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cursor.fetchall()}
    
    def safe_add_column(conn, table, column, column_type, default=None):
        if column in get_columns(conn, table):
            return False
        cursor = conn.cursor()
        sql = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
        cursor.execute(sql)
        return True
    
    def safe_create_index(conn, index_name, table, columns):
        cursor = conn.cursor()
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({columns})")
            return True
        except Exception:
            return False


def migrate():
    """Добавить расширенные метрики в таблицу moonbot_orders"""
    print("[MIGRATION] Adding extended metrics to moonbot_orders...")
    
    try:
        with get_db_connection() as conn:
            # Проверяем существование таблицы
            if not table_exists(conn, 'moonbot_orders'):
                print("[SKIP] Table moonbot_orders does not exist")
                return True
            
            # Список новых полей для добавления
            new_fields = [
                ('is_emulator', 'INTEGER DEFAULT 0'),
                ('signal_type', 'TEXT'),
                ('base_currency', 'TEXT'),
                ('safety_orders_used', 'INTEGER'),
                ('latency', 'INTEGER'),
                ('ping', 'INTEGER'),
                ('task_id', 'INTEGER'),
                ('exchange_1h_delta', 'REAL'),
                ('exchange_24h_delta', 'REAL'),
                ('bought_so', 'INTEGER'),
                ('btc_in_delta', 'REAL'),
                ('price_blow', 'INTEGER'),
                ('daily_vol', 'TEXT'),
                ('ex_order_id', 'TEXT'),
            ]
            
            added_count = 0
            for field_name, field_type in new_fields:
                if safe_add_column(conn, 'moonbot_orders', field_name, field_type):
                    print(f"[OK] Adding field: {field_name}")
                    added_count += 1
                else:
                    print(f"[SKIP] Field already exists: {field_name}")
            
            # Создаем индекс для is_emulator
            if safe_create_index(conn, 'idx_moonbot_orders_emulator', 'moonbot_orders', 'is_emulator'):
                print("[OK] Index created for is_emulator")
            else:
                print("[SKIP] Index already exists for is_emulator")
            
            conn.commit()
        
        print(f"\n[SUCCESS] Migration complete! Added {added_count} new fields")
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)


