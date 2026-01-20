#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: создание таблиц scheduled_commands и scheduled_command_servers + добавление target_type
"""
import sys
from pathlib import Path

# Добавляем путь к updates для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import (
        get_db_connection, safe_add_column, safe_create_table, 
        safe_create_index, table_exists, column_exists
    )
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
    
    def safe_create_table(conn, table, schema):
        if table_exists(conn, table):
            return False
        cursor = conn.cursor()
        cursor.execute(f"CREATE TABLE {table} ({schema})")
        return True
    
    def safe_create_index(conn, index_name, table, columns):
        cursor = conn.cursor()
        try:
            cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({columns})")
            return True
        except Exception:
            return False


def migrate():
    """Создать таблицы планировщика команд"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            print("[1/3] Проверка существования таблицы scheduled_commands...")
            
            if not table_exists(conn, 'scheduled_commands'):
                print("[2/3] Создание таблицы scheduled_commands...")
                cursor.execute("""
                    CREATE TABLE scheduled_commands (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        commands TEXT NOT NULL,
                        scheduled_time TIMESTAMP NOT NULL,
                        status TEXT DEFAULT 'pending' NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        executed_at TIMESTAMP,
                        error_message TEXT,
                        use_botname BOOLEAN DEFAULT 0,
                        delay_between_bots INTEGER DEFAULT 0,
                        target_type TEXT DEFAULT 'servers' NOT NULL,
                        user_id INTEGER NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                """)
                safe_create_index(conn, 'idx_scheduled_commands_scheduled_time', 'scheduled_commands', 'scheduled_time')
                print("[OK] Таблица scheduled_commands создана")
                
                print("[2/3] Создание таблицы scheduled_command_servers...")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS scheduled_command_servers (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scheduled_command_id INTEGER NOT NULL,
                        server_id INTEGER,
                        group_name TEXT,
                        FOREIGN KEY (scheduled_command_id) REFERENCES scheduled_commands(id),
                        FOREIGN KEY (server_id) REFERENCES servers(id)
                    )
                """)
                safe_create_index(conn, 'ix_scheduled_command_servers_cmd_id', 'scheduled_command_servers', 'scheduled_command_id')
                safe_create_index(conn, 'ix_scheduled_command_servers_server_id', 'scheduled_command_servers', 'server_id')
                print("[OK] Таблица scheduled_command_servers создана")
            else:
                print("[SKIP] Таблица scheduled_commands уже существует")
                
                # Проверяем существует ли колонка target_type
                if not column_exists(conn, 'scheduled_commands', 'target_type'):
                    print("[2/3] Добавление target_type в scheduled_commands...")
                    cursor.execute("""
                        ALTER TABLE scheduled_commands 
                        ADD COLUMN target_type TEXT DEFAULT 'servers'
                    """)
                    print("[OK] Колонка target_type добавлена")
                else:
                    print("[2/3] Колонка target_type уже существует")
            
            conn.commit()
        
        print("[3/3] Миграция завершена успешно")
        return True
        
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)

