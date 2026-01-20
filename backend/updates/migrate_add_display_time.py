#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: добавление поля display_time в таблицу scheduled_commands
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, safe_add_column, table_exists
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
    
    def safe_add_column(conn, table, column, column_type, default=None):
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        if column in [row[1] for row in cursor.fetchall()]:
            return False
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {column_type}")
        return True


def migrate():
    """Добавить поле display_time в scheduled_commands"""
    try:
        with get_db_connection() as conn:
            if not table_exists(conn, 'scheduled_commands'):
                print("[SKIP] Table scheduled_commands does not exist")
                return True
            
            if safe_add_column(conn, 'scheduled_commands', 'display_time', 'TEXT'):
                print("[OK] Колонка display_time добавлена")
            else:
                print("[SKIP] Колонка display_time уже существует")
            
            conn.commit()
        
        print("[OK] Миграция завершена успешно")
        return True
        
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)








