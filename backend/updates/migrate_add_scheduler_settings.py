#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: добавление таблицы scheduler_settings
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_connection, table_exists
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
    """Создать таблицу scheduler_settings"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            if table_exists(conn, 'scheduler_settings'):
                print("[SKIP] Таблица scheduler_settings уже существует")
                return True
            
            print("[1/2] Создание таблицы scheduler_settings...")
            
            cursor.execute("""
                CREATE TABLE scheduler_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    check_interval INTEGER NOT NULL DEFAULT 5,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Создаем запись по умолчанию
            cursor.execute("INSERT INTO scheduler_settings (check_interval) VALUES (5)")
            
            conn.commit()
        
        print("[OK] Таблица scheduler_settings создана с настройками по умолчанию")
        print("[2/2] Миграция завершена успешно")
        return True
        
    except Exception as e:
        print(f"[ERROR] {e}")
        return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)








