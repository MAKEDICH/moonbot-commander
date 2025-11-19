"""
Скрипт для исправления недостающих колонок в БД
"""
import sqlite3
import os
import sys
from pathlib import Path

def fix_database(db_path):
    """Исправляет недостающие колонки в указанной БД"""
    if not os.path.exists(db_path):
        print(f"  ❌ БД не найдена: {db_path}")
        return False
    
    print(f"  📋 Обработка БД: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существование таблицы servers
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
        if not cursor.fetchone():
            print("  ❌ Таблица servers не найдена")
            conn.close()
            return False
        
        # Получаем список колонок
        cursor.execute("PRAGMA table_info(servers)")
        columns = {col[1] for col in cursor.fetchall()}
        print(f"  📝 Найдено колонок: {len(columns)}")
        
        # Добавляем недостающие колонки
        changes = False
        
        if 'is_localhost' not in columns:
            print("  ➕ Добавление колонки is_localhost...")
            cursor.execute("ALTER TABLE servers ADD COLUMN is_localhost BOOLEAN DEFAULT FALSE")
            changes = True
        else:
            print("  ✓ Колонка is_localhost уже существует")
        
        if 'default_currency' not in columns:
            print("  ➕ Добавление колонки default_currency...")
            cursor.execute("ALTER TABLE servers ADD COLUMN default_currency TEXT")
            changes = True
        else:
            print("  ✓ Колонка default_currency уже существует")
        
        # Создаем таблицу миграций если её нет
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS migrations_registry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Регистрируем миграции
        cursor.execute("INSERT OR IGNORE INTO migrations_registry (migration_name) VALUES ('migrate_002_add_is_localhost')")
        cursor.execute("INSERT OR IGNORE INTO migrations_registry (migration_name) VALUES ('migrate_add_default_currency')")
        
        if changes:
            conn.commit()
            print("  ✅ Изменения сохранены")
        else:
            print("  ℹ️  Изменения не требуются")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"  ❌ Ошибка: {e}")
        return False

def main():
    print()
    print("============================================================")
    print("     🔧 ИСПРАВЛЕНИЕ КОЛОНОК В БАЗЕ ДАННЫХ")
    print("============================================================")
    print()
    
    # Ищем все возможные БД
    possible_paths = [
        "moonbot_commander.db",  # В текущей папке (backend)
        "../moonbot_commander.db",  # В корневой папке
        os.path.join(os.path.dirname(__file__), "moonbot_commander.db"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "moonbot_commander.db"),
    ]
    
    fixed = 0
    for db_path in possible_paths:
        abs_path = os.path.abspath(db_path)
        if os.path.exists(abs_path):
            if fix_database(abs_path):
                fixed += 1
            print()
    
    if fixed == 0:
        print("❌ Не найдено ни одной БД для исправления!")
        print()
        print("Создайте БД командой: python -m backend.init_db")
    else:
        print(f"✅ Исправлено БД: {fixed}")
        print()
        print("Теперь можно запустить приложение!")
    
    print("============================================================")
    print()

if __name__ == "__main__":
    main()

