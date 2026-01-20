"""
Типы миграций и их обработчики
"""
import sqlite3
from pathlib import Path
from typing import List, Optional
import logging


logger = logging.getLogger(__name__)


class MigrationType:
    """Типы миграций"""
    DATABASE = "database"
    CONFIG = "config"
    FILES = "files"
    DEPENDENCIES = "dependencies"
    STRUCTURE = "structure"
    CUSTOM = "custom"


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    """Проверить существование таблицы"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    """Проверить существование колонки"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def check_package_installed(package_name: str) -> bool:
    """Проверить установлен ли Python пакет"""
    try:
        __import__(package_name)
        return True
    except ImportError:
        return False


def check_env_contains(db_path: Path, key: str, value: Optional[str] = None) -> bool:
    """Проверить есть ли ключ (и значение) в .env файле"""
    try:
        env_path = db_path.parent / '.env'
        if not env_path.exists():
            return False
        
        content = env_path.read_text(encoding='utf-8')
        if value:
            return f'{key}=' in content and value in content
        else:
            return f'{key}=' in content
    except (OSError, IOError):
        return False

