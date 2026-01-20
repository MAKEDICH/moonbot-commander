"""
Миграция: Добавление поля backend_log_level в user_settings

Уровни логирования:
- 3: Полное логирование (DEBUG + INFO + WARNING + ERROR + CRITICAL)
- 2: Неполное логирование (INFO + WARNING + ERROR + CRITICAL)
- 1: Только критические события (WARNING + ERROR + CRITICAL)
"""

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def get_db_path() -> Path:
    """Определить путь к БД"""
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parent.parent
    
    db_path = backend_dir / "moonbot_commander.db"
    if db_path.exists():
        return db_path
    
    project_root = backend_dir.parent
    db_path = project_root / "moonbot_commander.db"
    if db_path.exists():
        return db_path
    
    return backend_dir / "moonbot_commander.db"


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    """Проверить существование колонки"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def migrate():
    """Добавить поле backend_log_level в user_settings"""
    db_path = get_db_path()
    
    if not db_path.exists():
        logger.warning(f"Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(str(db_path))
    
    try:
        # Проверяем существует ли колонка
        if column_exists(conn, "user_settings", "backend_log_level"):
            logger.info("Column backend_log_level already exists")
            return True
        
        cursor = conn.cursor()
        
        # Добавляем колонку с дефолтным значением 2 (неполное логирование)
        cursor.execute("""
            ALTER TABLE user_settings 
            ADD COLUMN backend_log_level INTEGER DEFAULT 2
        """)
        
        conn.commit()
        logger.info("✅ Added backend_log_level column to user_settings")
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        conn.rollback()
        return False
        
    finally:
        conn.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    migrate()


