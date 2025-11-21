"""
Миграция: Добавление полей is_running и version в server_balance

Добавляет поддержку новых полей из обновленного формата балансов:
- S (is_running): запущен ли бот
- V (version): номер версии MoonBot (без точки, например 756)
"""

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import sys

def run_migration():
    print("=" * 60)
    print("  Миграция: Добавление полей is_running и version в server_balance")
    print("=" * 60)
    print()
    
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    with engine.begin() as conn:  # Используем begin() для автоматического управления транзакцией
        try:
            # Проверяем существует ли таблица
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='server_balance'"))
            if not result.fetchone():
                print("[ERROR] Таблица 'server_balance' не существует!")
                print("[INFO] Запустите сначала migrate_add_balance_and_strategies.py")
                return False
            
            # Проверяем существующие поля
            result = conn.execute(text("PRAGMA table_info(server_balance)"))
            columns = {row[1]: row for row in result}
            
            # Добавляем поле is_running (S)
            if 'is_running' in columns:
                print("[OK] Поле 'is_running' уже существует")
            else:
                print("[+] Добавляю поле 'is_running'...")
                # В SQLite ALTER TABLE автоматически коммитится, но используем транзакцию для безопасности
                conn.execute(text("ALTER TABLE server_balance ADD COLUMN is_running BOOLEAN"))
                print("[OK] Поле 'is_running' добавлено")
            
            # Добавляем поле version (V)
            if 'version' in columns:
                print("[OK] Поле 'version' уже существует")
            else:
                print("[+] Добавляю поле 'version'...")
                conn.execute(text("ALTER TABLE server_balance ADD COLUMN version INTEGER"))
                print("[OK] Поле 'version' добавлено")
            
            # Коммит выполняется автоматически при выходе из with engine.begin()
            print()
            print("=" * 60)
            print("  [SUCCESS] Миграция завершена успешно!")
            print("=" * 60)
            return True
            
        except Exception as e:
            print(f"[ERROR] Ошибка миграции: {e}")
            import traceback
            traceback.print_exc()
            # Откат выполняется автоматически при исключении в with engine.begin()
            return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

