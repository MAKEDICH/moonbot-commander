"""
Миграция: Добавление полей очистки для 3000+ серверов

Добавляет новые колонки в cleanup_settings для:
- API ошибок
- Графиков
- Кэша стратегий

Эти поля критически важны для предотвращения разрастания БД
при работе с большим количеством серверов.
"""
import sqlite3
import os
from utils.logging import log


def get_db_path() -> str:
    """Получить путь к БД."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_dir, 'moonbot_commander.db')


def check_migration_needed() -> bool:
    """Проверить нужна ли миграция."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существование таблицы
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='cleanup_settings'
        """)
        if not cursor.fetchone():
            conn.close()
            return False
        
        # Проверяем наличие новых колонок
        cursor.execute("PRAGMA table_info(cleanup_settings)")
        columns = [row[1] for row in cursor.fetchall()]
        conn.close()
        
        # Если колонка auto_cleanup_api_errors отсутствует - нужна миграция
        return 'auto_cleanup_api_errors' not in columns
        
    except Exception as e:
        log(f"[MIGRATION] Error checking cleanup_settings columns: {e}", level="ERROR")
        return False


def run_migration() -> bool:
    """Выполнить миграцию."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        log("[MIGRATION] Database not found, skipping cleanup_settings migration")
        return True
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Получаем текущие колонки
        cursor.execute("PRAGMA table_info(cleanup_settings)")
        existing_columns = [row[1] for row in cursor.fetchall()]
        
        # Новые колонки с дефолтными значениями
        new_columns = [
            ('auto_cleanup_api_errors', 'BOOLEAN', '1'),  # True
            ('auto_cleanup_charts', 'BOOLEAN', '1'),  # True
            ('auto_cleanup_strategy_cache', 'BOOLEAN', '1'),  # True
            ('api_errors_days', 'INTEGER', '7'),
            ('charts_days', 'INTEGER', '14'),
            ('strategy_cache_days', 'INTEGER', '7'),
        ]
        
        added_count = 0
        for col_name, col_type, default_value in new_columns:
            if col_name not in existing_columns:
                try:
                    cursor.execute(f"""
                        ALTER TABLE cleanup_settings 
                        ADD COLUMN {col_name} {col_type} DEFAULT {default_value}
                    """)
                    log(f"[MIGRATION] Added column: {col_name}")
                    added_count += 1
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e).lower():
                        log(f"[MIGRATION] Column {col_name} already exists")
                    else:
                        raise
        
        conn.commit()
        conn.close()
        
        log(f"[MIGRATION] Cleanup settings migration complete: {added_count} columns added")
        return True
        
    except Exception as e:
        log(f"[MIGRATION] Error in cleanup_settings migration: {e}", level="ERROR")
        return False


if __name__ == "__main__":
    if check_migration_needed():
        print("Migration needed, running...")
        success = run_migration()
        print(f"Migration {'successful' if success else 'failed'}")
    else:
        print("Migration not needed")


