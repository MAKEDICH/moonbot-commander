"""
Миграция #002: Добавление поля is_localhost в таблицу servers
Версия: 2024-11-18
Добавляет:
- is_localhost: Boolean флаг для разрешения localhost/127.0.0.1

Проблема которую решаем:
- По умолчанию ip_validator блокирует localhost/127.0.0.1 для безопасности (SSRF)
- Но иногда MoonBot запущен локально на том же сервере
- Флаг is_localhost = True позволяет обойти эту проверку для конкретных серверов

КРИТИЧНО:
- Поле должно быть добавлено КОРРЕКТНО
- SQLAlchemy должен сразу видеть новую колонку
- Миграция должна работать и при первой установке, и при обновлении
"""
import sys
import sqlite3
from pathlib import Path

# Добавляем путь для импорта утилит
sys.path.insert(0, str(Path(__file__).parent))

try:
    from migration_utils import get_db_path
except ImportError:
    def get_db_path():
        """Fallback для определения пути к БД"""
        backend_dir = Path(__file__).resolve().parent.parent
        db_path = backend_dir / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        return backend_dir.parent / "moonbot_commander.db"


def migrate():
    """Применить миграцию"""
    db_path = get_db_path()
    
    print("[MIGRATION #002] Adding is_localhost support to servers...")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существование таблицы
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
        if not cursor.fetchone():
            print("  [INFO] Table 'servers' doesn't exist yet, skipping")
            conn.close()
            return True
        
        # Получаем текущие колонки
        cursor.execute("PRAGMA table_info(servers)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # Добавляем is_localhost если его нет
        if 'is_localhost' not in columns:
            print("  [+] Adding column 'is_localhost'...")
            
            # КРИТИЧНО: Используем SQLite синтаксис с DEFAULT и NOT NULL
            cursor.execute("""
                ALTER TABLE servers 
                ADD COLUMN is_localhost BOOLEAN DEFAULT 0 NOT NULL
            """)
            
            conn.commit()
            print("  [OK] Column 'is_localhost' added successfully")
            
            # ВАЖНО: Проверяем что колонка действительно добавлена
            cursor.execute("PRAGMA table_info(servers)")
            columns_after = [row[1] for row in cursor.fetchall()]
            
            if 'is_localhost' in columns_after:
                print("  [OK] Verified: column 'is_localhost' exists in database")
            else:
                print("  [ERROR] Column was not added properly!")
                conn.close()
                return False
            
        else:
            print("  [SKIP] Column 'is_localhost' already exists")
        
        conn.close()
        print("  [SUCCESS] Migration #002 completed successfully")
        return True
        
    except sqlite3.Error as e:
        print(f"  [ERROR] Migration #002 failed: {e}")
        try:
            conn.rollback()
            conn.close()
        except sqlite3.Error:
            pass  # Rollback/close не удался
        return False
    except Exception as e:
        print(f"  [ERROR] Unexpected error in migration #002: {e}")
        return False

def rollback():
    """Откатить миграцию (не рекомендуется - потеря данных!)"""
    db_path = get_db_path()
    
    print("[ROLLBACK #002] Removing is_localhost column...")
    print("  [WARNING] This will delete is_localhost settings!")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # SQLite не поддерживает DROP COLUMN напрямую
        print("  [INFO] SQLite doesn't support DROP COLUMN")
        print("  [INFO] To rollback, restore from backup")
        
        conn.close()
        return False
        
    except Exception as e:
        print(f"  [ERROR] Rollback failed: {e}")
        return False

if __name__ == '__main__':
    success = migrate()
    exit(0 if success else 1)


