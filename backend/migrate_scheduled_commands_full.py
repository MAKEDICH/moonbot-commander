#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Миграция: создание таблиц scheduled_commands и scheduled_command_servers + добавление target_type
"""

import sqlite3
import sys

def migrate():
    try:
        # Подключаемся к БД
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        print("[1/3] Проверка существования таблицы scheduled_commands...")
        
        # Проверяем существует ли таблица
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_commands'")
        table_exists = cursor.fetchone() is not None
        
        if not table_exists:
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
            cursor.execute("CREATE INDEX idx_scheduled_commands_scheduled_time ON scheduled_commands(scheduled_time)")
            print("[OK] Таблица scheduled_commands создана")
            
            print("[2/3] Создание таблицы scheduled_command_servers...")
            cursor.execute("""
                CREATE TABLE scheduled_command_servers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scheduled_command_id INTEGER NOT NULL,
                    server_id INTEGER NOT NULL,
                    FOREIGN KEY (scheduled_command_id) REFERENCES scheduled_commands(id),
                    FOREIGN KEY (server_id) REFERENCES servers(id)
                )
            """)
            print("[OK] Таблица scheduled_command_servers создана")
        else:
            print("[SKIP] Таблица scheduled_commands уже существует")
            
            # Проверяем существует ли колонка target_type
            cursor.execute("PRAGMA table_info(scheduled_commands)")
            columns = [col[1] for col in cursor.fetchall()]
            
            if 'target_type' not in columns:
                print("[2/3] Добавление target_type в scheduled_commands...")
                cursor.execute("""
                    ALTER TABLE scheduled_commands 
                    ADD COLUMN target_type TEXT DEFAULT 'servers' NOT NULL
                """)
                print("[OK] Колонка target_type добавлена")
            else:
                print("[2/3] Колонка target_type уже существует")
        
        conn.commit()
        print("[3/3] Миграция завершена успешно")
        
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

