"""
Скрипт для проверки какую БД использует приложение в runtime
"""
import os
import sys
import sqlite3
import glob

def main():
    print("\n" + "="*60)
    print("🔍 ПРОВЕРКА ИСПОЛЬЗУЕМОЙ БАЗЫ ДАННЫХ")
    print("="*60 + "\n")
    
    # 1. Проверяем переменную окружения DATABASE_URL
    print("[1] Переменная DATABASE_URL:")
    print("-" * 30)
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url:
        print(f"  ✅ DATABASE_URL = {db_url}")
    else:
        print("  ❌ DATABASE_URL не установлена")
    print()
    
    # 2. Читаем .env файлы
    print("[2] Файлы .env:")
    print("-" * 30)
    env_files = ['.env', 'backend/.env', '../.env']
    for env_file in env_files:
        if os.path.exists(env_file):
            print(f"\n  📄 {env_file}:")
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    if 'DATABASE_URL' in line:
                        print(f"    {line.strip()}")
    print()
    
    # 3. Проверяем config.py
    print("[3] Конфигурация в config.py:")
    print("-" * 30)
    try:
        # Добавляем backend в путь
        sys.path.insert(0, 'backend')
        sys.path.insert(0, '.')
        
        from backend.config import settings
        print(f"  DATABASE_URL из config: {settings.DATABASE_URL}")
        
        # Парсим путь к БД
        if 'sqlite' in settings.DATABASE_URL:
            db_path = settings.DATABASE_URL.replace('sqlite:///', '')
            if db_path.startswith('./'):
                db_path = db_path[2:]
            print(f"  Путь к БД: {db_path}")
            
            # Проверяем существование
            if os.path.exists(db_path):
                print(f"  ✅ БД существует: {os.path.abspath(db_path)}")
            elif os.path.exists(f"backend/{db_path}"):
                print(f"  ✅ БД существует: {os.path.abspath(f'backend/{db_path}')}")
            else:
                print(f"  ❌ БД НЕ НАЙДЕНА по пути: {db_path}")
    except Exception as e:
        print(f"  ❌ Ошибка импорта config: {e}")
    print()
    
    # 4. Список всех БД
    print("[4] Все найденные базы данных:")
    print("-" * 30)
    for db in glob.glob('**/*.db', recursive=True)[:10]:
        size = os.path.getsize(db) / 1024  # KB
        print(f"  📁 {db} ({size:.1f} KB)")
    print()
    
    # 5. Проверка структуры БД
    print("[5] Структура баз данных:")
    print("-" * 30)
    for db_path in ['moonbot_commander.db', 'backend/moonbot_commander.db']:
        if os.path.exists(db_path):
            print(f"\n  📋 {db_path}:")
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Проверяем таблицу servers
                cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='servers'")
                result = cursor.fetchone()
                if result:
                    print("    Структура таблицы servers:")
                    # Получаем колонки
                    cursor.execute("PRAGMA table_info(servers)")
                    columns = cursor.fetchall()
                    missing = []
                    for col in columns:
                        print(f"      - {col[1]} ({col[2]})")
                    
                    # Проверяем нужные колонки
                    col_names = [col[1] for col in columns]
                    if 'is_localhost' not in col_names:
                        missing.append('is_localhost')
                    if 'default_currency' not in col_names:
                        missing.append('default_currency')
                    
                    if missing:
                        print(f"    ❌ Недостающие колонки: {', '.join(missing)}")
                    else:
                        print("    ✅ Все необходимые колонки присутствуют")
                
                conn.close()
            except Exception as e:
                print(f"    ❌ Ошибка: {e}")
    
    print("\n" + "="*60)
    print("ДИАГНОСТИКА ЗАВЕРШЕНА")
    print("="*60)

if __name__ == "__main__":
    main()
