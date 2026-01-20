"""
Миграция для исправления временных меток ордеров.

Если ордера были записаны с неправильным часовым поясом (UTC+3 вместо локального),
эта миграция сдвинет время на -3 часа.

Выполняется ОДИН РАЗ - создаётся файл-маркер после успешного выполнения.
"""
import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    """Получить путь к БД"""
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / "moonbot_commander.db"


def get_marker_path() -> Path:
    """Получить путь к файлу-маркеру"""
    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / ".migration_timestamps_fixed"


def check_migration_needed() -> bool:
    """Проверить нужно ли выполнять миграцию"""
    marker_path = get_marker_path()
    db_path = get_db_path()
    
    # Если маркер существует - миграция уже выполнена
    if marker_path.exists():
        return False
    
    # Если БД не существует - нечего исправлять
    if not db_path.exists():
        return False
    
    return True


def run_migration() -> bool:
    """
    Исправление временных меток ордеров.
    Сдвигает opened_at и closed_at на -3 часа.
    """
    db_path = get_db_path()
    marker_path = get_marker_path()
    
    if not db_path.exists():
        print(f"[MIGRATION] Database not found: {db_path}")
        return False
    
    print(f"[MIGRATION] Fixing order timestamps in {db_path}")
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    try:
        # Проверяем сколько ордеров нужно исправить
        cursor.execute("SELECT COUNT(*) FROM moonbot_orders WHERE opened_at IS NOT NULL")
        total_with_opened = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM moonbot_orders WHERE closed_at IS NOT NULL")
        total_with_closed = cursor.fetchone()[0]
        
        print(f"[MIGRATION] Orders with opened_at: {total_with_opened}")
        print(f"[MIGRATION] Orders with closed_at: {total_with_closed}")
        
        # Сдвигаем opened_at на -3 часа
        cursor.execute("""
            UPDATE moonbot_orders 
            SET opened_at = datetime(opened_at, '-3 hours')
            WHERE opened_at IS NOT NULL
        """)
        updated_opened = cursor.rowcount
        
        # Сдвигаем closed_at на -3 часа
        cursor.execute("""
            UPDATE moonbot_orders 
            SET closed_at = datetime(closed_at, '-3 hours')
            WHERE closed_at IS NOT NULL
        """)
        updated_closed = cursor.rowcount
        
        conn.commit()
        
        print(f"[MIGRATION] ✅ Updated opened_at: {updated_opened} rows")
        print(f"[MIGRATION] ✅ Updated closed_at: {updated_closed} rows")
        print(f"[MIGRATION] ✅ Order timestamps fixed successfully!")
        
        # Создаём файл-маркер
        marker_path.write_text("Migration completed")
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"[MIGRATION] ❌ Error: {e}")
        return False
        
    finally:
        conn.close()


if __name__ == "__main__":
    if check_migration_needed():
        run_migration()
    else:
        print("[MIGRATION] Timestamps migration already applied or not needed")
