"""
Скрипт для применения миграций при запуске
Вызывается из батников перед запуском приложения
"""
import os
import sys
import sqlite3

def apply_critical_migrations():
    """Применяет критические миграции ко всем найденным БД"""
    
    # Список возможных путей к БД
    db_paths = [
        "moonbot_commander.db",
        "../moonbot_commander.db",
        os.path.join(os.path.dirname(__file__), "moonbot_commander.db"),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "moonbot_commander.db"),
    ]
    
    fixed_count = 0
    
    for db_path in db_paths:
        if not os.path.exists(db_path):
            continue
            
        print(f"[CHECK] Проверка БД: {db_path}")
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Проверяем существование таблицы servers
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
            if not cursor.fetchone():
                print(f"  [SKIP] Таблица servers не найдена")
                conn.close()
                continue
            
            # Получаем список колонок
            cursor.execute("PRAGMA table_info(servers)")
            columns = {col[1] for col in cursor.fetchall()}
            
            applied = []
            
            # Проверяем и добавляем is_localhost
            if 'is_localhost' not in columns:
                print(f"  [FIX] Добавление is_localhost...")
                cursor.execute("ALTER TABLE servers ADD COLUMN is_localhost BOOLEAN DEFAULT FALSE")
                applied.append('is_localhost')
            
            # Проверяем и добавляем default_currency
            if 'default_currency' not in columns:
                print(f"  [FIX] Добавление default_currency...")
                cursor.execute("ALTER TABLE servers ADD COLUMN default_currency TEXT")
                applied.append('default_currency')
            
            if applied:
                conn.commit()
                print(f"  [OK] Применено миграций: {len(applied)}")
                fixed_count += 1
            else:
                print(f"  [OK] Миграции не требуются")
            
            conn.close()
            
        except Exception as e:
            print(f"  [ERROR] {e}")
            if 'conn' in locals():
                conn.close()
    
    if fixed_count > 0:
        print(f"\n[SUCCESS] Обновлено БД: {fixed_count}")
    else:
        print(f"\n[INFO] Все БД в актуальном состоянии")
    
    return True

if __name__ == "__main__":
    apply_critical_migrations()
