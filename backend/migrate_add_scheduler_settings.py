#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: добавление таблицы scheduler_settings
"""

import sqlite3
import sys

def migrate():
    try:
        # Подключаемся к БД
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        print("[1/2] Создание таблицы scheduler_settings...")
        
        # Проверяем существует ли уже таблица
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduler_settings'")
        exists = cursor.fetchone()
        
        if not exists:
            # Создаем таблицу
            cursor.execute("""
                CREATE TABLE scheduler_settings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    check_interval INTEGER NOT NULL DEFAULT 5,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Создаем запись по умолчанию
            cursor.execute("INSERT INTO scheduler_settings (check_interval) VALUES (5)")
            
            print("[OK] Таблица scheduler_settings создана с настройками по умолчанию")
        else:
            print("[SKIP] Таблица scheduler_settings уже существует")
        
        conn.commit()
        print("[2/2] Миграция завершена успешно")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"[ERROR] Ошибка SQLite: {e}")
        return False
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)




