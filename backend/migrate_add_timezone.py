#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: добавление поля timezone в таблицу scheduled_commands
"""

import sqlite3
import sys

def migrate():
    try:
        # Подключаемся к БД
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        print("[1/2] Добавление timezone в scheduled_commands...")
        
        # Проверяем существует ли уже колонка
        cursor.execute("PRAGMA table_info(scheduled_commands)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'timezone' not in columns:
            # Добавляем колонку
            cursor.execute("""
                ALTER TABLE scheduled_commands 
                ADD COLUMN timezone TEXT DEFAULT 'UTC' NOT NULL
            """)
            print("[OK] Колонка timezone добавлена")
        else:
            print("[SKIP] Колонка timezone уже существует")
        
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








