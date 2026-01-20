"""
Миграция для приведения таблицы moonbot_orders к полной схеме Moonbot
Добавляет все поля из CREATE TABLE Orders от разработчика Moonbot
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, table_exists, get_columns, safe_add_column, safe_create_index
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
    
    def get_columns(conn, table):
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cursor.fetchall()}
    
    def safe_add_column(conn, table, column, column_type, default=None):
        if column in get_columns(conn, table):
            return False
        cursor = conn.cursor()
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
        return True
    
    def safe_create_index(conn, index_name, table, columns):
        cursor = conn.cursor()
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({columns})")
            return True
        except:
            return False


def migrate_moonbot_orders_full_schema():
    """
    Добавить все недостающие поля из схемы Moonbot в таблицу moonbot_orders
    Сохраняет существующий столбец bot_name
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
        
        print("[MIGRATION] Starting moonbot_orders full schema migration...")
        
            # Проверяем существует ли таблица
            if not table_exists(conn, 'moonbot_orders'):
                print("[MIGRATION] Table moonbot_orders does not exist, skipping")
                return True
            
            # Получаем список существующих колонок
            existing_columns = get_columns(conn, 'moonbot_orders')
        
        print(f"[MIGRATION] Found {len(existing_columns)} existing columns")
        
        # Список всех новых полей из схемы Moonbot
        new_columns = [
            # Основные поля
            ('ex_order_id', 'TEXT'),  # exOrderID
            ('buy_date', 'INTEGER'),  # BuyDate (timestamp)
            ('sell_set_date', 'INTEGER'),  # SellSetDate
            ('source', 'INTEGER'),  # Source
            ('channel', 'INTEGER'),  # Channel
            ('channel_name', 'TEXT'),  # ChannelName
            ('comment', 'TEXT'),  # Comment
            
            # Рыночные данные
            ('bought_q', 'REAL'),  # BoughtQ
            ('btc_1h_delta', 'REAL'),  # BTC1hDelta
            
            # Состояние и флаги
            ('fname', 'TEXT'),  # FName
            ('deleted', 'INTEGER DEFAULT 0'),  # deleted
            ('emulator', 'INTEGER DEFAULT 0'),  # Emulator (int версия)
            ('imp', 'INTEGER DEFAULT 0'),  # Imp
            
            # Дельты 24h и 5m
            ('btc_24h_delta', 'REAL DEFAULT 0'),  # BTC24hDelta
            ('bvsv_ratio', 'REAL DEFAULT 0'),  # bvsvRatio
            ('btc_5m_delta', 'REAL DEFAULT 0'),  # BTC5mDelta
            ('is_short', 'INTEGER DEFAULT 0'),  # IsShort
            
            # Pump & Dump
            ('pump_1h', 'REAL DEFAULT 0'),  # Pump1H
            ('dump_1h', 'REAL DEFAULT 0'),  # Dump1H
            
            # Детальные дельты по таймфреймам
            ('d24h', 'REAL DEFAULT 0'),  # d24h
            ('d3h', 'REAL DEFAULT 0'),  # d3h
            ('d1h', 'REAL DEFAULT 0'),  # d1h
            ('d15m', 'REAL DEFAULT 0'),  # d15m
            ('d5m', 'REAL DEFAULT 0'),  # d5m
            ('d1m', 'REAL DEFAULT 0'),  # d1m
            ('dbtc_1m', 'REAL DEFAULT 0'),  # dBTC1m
            
            # Технические параметры
            ('price_bug', 'REAL DEFAULT 0'),  # PriceBug
            ('vd1m', 'REAL DEFAULT 0'),  # Vd1m
            ('lev', 'INTEGER DEFAULT 1'),  # Lev (leverage)
            
            # Объёмы
            ('hvol', 'REAL DEFAULT 0'),  # hVol
            ('hvolf', 'REAL DEFAULT 0'),  # hVolF
            ('dvol', 'REAL DEFAULT 0'),  # dVol
            
            # StrategyID как INTEGER
            ('strategy_id', 'INTEGER'),  # StrategyID
        ]
        
        # Добавляем недостающие колонки
        added_count = 0
        for column_name, column_type in new_columns:
            if column_name not in existing_columns:
                try:
                    sql = f"ALTER TABLE moonbot_orders ADD COLUMN {column_name} {column_type}"
                    cursor.execute(sql)
                    print(f"[MIGRATION] [OK] Added column: {column_name} ({column_type})")
                    added_count += 1
                except sqlite3.OperationalError as e:
                    if 'duplicate column name' in str(e).lower():
                        print(f"[MIGRATION] [SKIP] Column {column_name} already exists")
                    else:
                        print(f"[MIGRATION] [WARN] Error adding column {column_name}: {e}")
        
        # Проверяем что bot_name существует (он должен остаться!)
        if 'bot_name' not in existing_columns:
            cursor.execute("ALTER TABLE moonbot_orders ADD COLUMN bot_name TEXT")
            print(f"[MIGRATION] [OK] Added column: bot_name (TEXT)")
            added_count += 1
        
            # Создаём индексы для важных полей если их нет
            safe_create_index(conn, 'idx_moonbot_orders_emulator', 'moonbot_orders', 'emulator')
            safe_create_index(conn, 'idx_moonbot_orders_bot_name', 'moonbot_orders', 'bot_name')
            print(f"[MIGRATION] [OK] Created indexes")
            
            conn.commit()
        
        print(f"[MIGRATION] [SUCCESS] Migration completed! Added {added_count} new columns")
        print(f"[MIGRATION] [SUCCESS] Column 'bot_name' preserved!")
        return True
        
    except Exception as e:
        print(f"[MIGRATION] [ERROR] Error during migration: {e}")
        import traceback
        traceback.print_exc()
        return False


def migrate():
    """Alias для совместимости"""
    return migrate_moonbot_orders_full_schema()


if __name__ == "__main__":
    success = migrate_moonbot_orders_full_schema()
    sys.exit(0 if success else 1)



