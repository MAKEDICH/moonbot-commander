"""
Миграция БД: Добавление таблиц для UDP Listener функциональности

Добавляет таблицы:
- sql_command_log (лог SQL команд от MoonBot)
- moonbot_orders (распарсенные ордера)
- udp_listener_status (статус listeners)

Запуск:
    python migrate_add_udp_listener.py
"""
from sqlalchemy import create_engine, text
from models.database import DATABASE_URL
import os

def run_migration():
    """Выполнить миграцию БД"""
    print("=" * 70)
    print("Миграция: Добавление таблиц UDP Listener")
    print("=" * 70)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # 1. Создаем таблицу sql_command_log
            print("\n[1/3] Создание таблицы sql_command_log...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sql_command_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL,
                    command_id INTEGER NOT NULL,
                    sql_text TEXT NOT NULL,
                    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    processed BOOLEAN DEFAULT 0,
                    FOREIGN KEY (server_id) REFERENCES servers (id)
                )
            """))
            
            # Индексы для sql_command_log
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sql_log_server 
                ON sql_command_log(server_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sql_log_command_id 
                ON sql_command_log(command_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_sql_log_received 
                ON sql_command_log(received_at)
            """))
            print("✓ Таблица sql_command_log создана")
            
            # 2. Создаем таблицу moonbot_orders
            print("\n[2/3] Создание таблицы moonbot_orders...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS moonbot_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL,
                    moonbot_order_id INTEGER NOT NULL,
                    symbol VARCHAR NOT NULL,
                    buy_price FLOAT,
                    sell_price FLOAT,
                    quantity FLOAT,
                    status VARCHAR NOT NULL DEFAULT 'Open',
                    spent_btc FLOAT,
                    gained_btc FLOAT,
                    profit_btc FLOAT,
                    profit_percent FLOAT,
                    sell_reason TEXT,
                    strategy VARCHAR,
                    close_date TIMESTAMP,
                    opened_at TIMESTAMP,
                    closed_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (server_id) REFERENCES servers (id)
                )
            """))
            
            # Индексы для moonbot_orders
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_server_order 
                ON moonbot_orders(server_id, moonbot_order_id)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_orders_symbol 
                ON moonbot_orders(symbol)
            """))
            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_orders_status 
                ON moonbot_orders(status)
            """))
            print("✓ Таблица moonbot_orders создана")
            
            # 3. Создаем таблицу udp_listener_status
            print("\n[3/3] Создание таблицы udp_listener_status...")
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS udp_listener_status (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL UNIQUE,
                    is_running BOOLEAN DEFAULT 0,
                    started_at TIMESTAMP,
                    last_message_at TIMESTAMP,
                    messages_received INTEGER DEFAULT 0,
                    last_error VARCHAR,
                    FOREIGN KEY (server_id) REFERENCES servers (id)
                )
            """))
            print("✓ Таблица udp_listener_status создана")
            
            conn.commit()
            
            print("\n" + "=" * 70)
            print("✓ МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА!")
            print("=" * 70)
            print("\nДобавлены таблицы:")
            print("  - sql_command_log (лог SQL команд)")
            print("  - moonbot_orders (ордера MoonBot)")
            print("  - udp_listener_status (статус listeners)")
            print("\nТеперь можно запускать приложение!")
            print("=" * 70)
            
        except Exception as e:
            print(f"\n✗ ОШИБКА МИГРАЦИИ: {e}")
            conn.rollback()
            raise

if __name__ == "__main__":
    run_migration()






