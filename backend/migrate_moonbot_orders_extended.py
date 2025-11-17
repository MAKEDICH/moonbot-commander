"""
Миграция: Добавление расширенных метрик в таблицу moonbot_orders
Добавляет поля для эмулятора, сигналов, метрик производительности
"""
import sqlite3
import sys

def migrate():
    print("[MIGRATION] Adding extended metrics to moonbot_orders...")
    
    try:
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        # Список новых полей для добавления
        new_fields = [
            ('is_emulator', 'INTEGER DEFAULT 0'),  # Boolean = INTEGER in SQLite
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
            ('price_blow', 'INTEGER'),  # Boolean
            ('daily_vol', 'TEXT'),
            ('ex_order_id', 'TEXT'),
        ]
        
        # Проверяем существующие поля
        cursor.execute("PRAGMA table_info(moonbot_orders)")
        existing_fields = {row[1] for row in cursor.fetchall()}
        
        added_count = 0
        for field_name, field_type in new_fields:
            if field_name not in existing_fields:
                print(f"[OK] Adding field: {field_name} ({field_type})")
                cursor.execute(f"ALTER TABLE moonbot_orders ADD COLUMN {field_name} {field_type}")
                added_count += 1
            else:
                print(f"[SKIP] Field already exists: {field_name}")
        
        # Создаем индекс для is_emulator
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_moonbot_orders_emulator ON moonbot_orders(is_emulator)")
            print("[OK] Index created for is_emulator")
        except sqlite3.OperationalError as e:
            if "already exists" in str(e):
                print("[SKIP] Index already exists for is_emulator")
            else:
                raise
        
        conn.commit()
        print(f"\n[SUCCESS] Migration complete! Added {added_count} new fields")
        return True
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)


