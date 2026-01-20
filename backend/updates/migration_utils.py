"""
Утилиты для миграций БД.

Этот модуль предоставляет общие функции для всех миграций:
- Определение пути к БД
- Проверка существования таблиц/колонок
- Безопасное добавление колонок
- Логирование
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path
from typing import Optional, List, Tuple, Set
from contextlib import contextmanager


logger = logging.getLogger(__name__)


def log(message: str, level: str = "INFO") -> None:
    """
    Логирование сообщений миграций.
    
    Обёртка над logger для совместимости с кодом миграций.
    
    Args:
        message: Сообщение для логирования
        level: Уровень логирования (INFO, WARNING, ERROR, DEBUG)
    """
    level = level.upper()
    if level == "ERROR":
        logger.error(message)
    elif level == "WARNING":
        logger.warning(message)
    elif level == "DEBUG":
        logger.debug(message)
    else:
        logger.info(message)


def get_db_path() -> Path:
    """
    Определить путь к БД moonbot_commander.db.
    
    Ищет БД в следующем порядке:
    1. В директории backend/
    2. В корне проекта
    3. В текущей рабочей директории
    
    Returns:
        Path к файлу БД
    """
    # Определяем директорию этого файла
    current_file = Path(__file__).resolve()
    
    # backend/updates/migration_utils.py -> backend/
    backend_dir = current_file.parent.parent
    
    # Проверяем backend/moonbot_commander.db
    db_path = backend_dir / "moonbot_commander.db"
    if db_path.exists():
        return db_path
    
    # Проверяем корень проекта
    project_root = backend_dir.parent
    db_path = project_root / "moonbot_commander.db"
    if db_path.exists():
        return db_path
    
    # Проверяем текущую рабочую директорию
    cwd_db = Path.cwd() / "moonbot_commander.db"
    if cwd_db.exists():
        return cwd_db
    
    # По умолчанию возвращаем путь в backend
    return backend_dir / "moonbot_commander.db"


@contextmanager
def get_db_connection(db_path: Optional[Path] = None):
    """
    Контекстный менеджер для подключения к БД.
    
    Args:
        db_path: Путь к БД (если не указан, определяется автоматически)
        
    Yields:
        sqlite3.Connection
        
    Example:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM servers")
    """
    if db_path is None:
        db_path = get_db_path()
    
    conn = None
    try:
        conn = sqlite3.connect(str(db_path))
        yield conn
    finally:
        if conn:
            conn.close()


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    """Проверить существование таблицы"""
    cursor = conn.cursor()
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
    """, (table_name,))
    return cursor.fetchone() is not None


def column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    """Проверить существование колонки в таблице"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    columns = [row[1] for row in cursor.fetchall()]
    return column in columns


def get_columns(conn: sqlite3.Connection, table: str) -> Set[str]:
    """Получить множество имён колонок таблицы"""
    cursor = conn.cursor()
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def safe_add_column(
    conn: sqlite3.Connection, 
    table: str, 
    column: str, 
    column_type: str,
    default: Optional[str] = None
) -> bool:
    """
    Безопасно добавить колонку в таблицу.
    
    Если колонка уже существует, ничего не делает.
    
    Args:
        conn: Подключение к БД
        table: Имя таблицы
        column: Имя колонки
        column_type: Тип колонки (TEXT, INTEGER, REAL, BOOLEAN, etc.)
        default: Значение по умолчанию
        
    Returns:
        True если колонка добавлена, False если уже существовала
    """
    if column_exists(conn, table, column):
        logger.debug(f"Колонка {table}.{column} уже существует")
        return False
    
    cursor = conn.cursor()
    
    sql = f"ALTER TABLE {table} ADD COLUMN {column} {column_type}"
    if default is not None:
        sql += f" DEFAULT {default}"
    
    cursor.execute(sql)
    logger.info(f"Добавлена колонка {table}.{column} ({column_type})")
    return True


def safe_create_table(
    conn: sqlite3.Connection,
    table: str,
    schema: str
) -> bool:
    """
    Безопасно создать таблицу.
    
    Args:
        conn: Подключение к БД
        table: Имя таблицы
        schema: SQL схема таблицы (без CREATE TABLE)
        
    Returns:
        True если таблица создана, False если уже существовала
    """
    if table_exists(conn, table):
        logger.debug(f"Таблица {table} уже существует")
        return False
    
    cursor = conn.cursor()
    cursor.execute(f"CREATE TABLE {table} ({schema})")
    logger.info(f"Создана таблица {table}")
    return True


def safe_create_index(
    conn: sqlite3.Connection,
    index_name: str,
    table: str,
    columns: str
) -> bool:
    """
    Безопасно создать индекс.
    
    Args:
        conn: Подключение к БД
        index_name: Имя индекса
        table: Имя таблицы
        columns: Колонки индекса (например, "column1, column2")
        
    Returns:
        True если индекс создан, False если уже существовал
    """
    cursor = conn.cursor()
    try:
        cursor.execute(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table}({columns})")
        return True
    except sqlite3.OperationalError as e:
        if "already exists" in str(e).lower():
            return False
        raise


def run_migration_sql(
    conn: sqlite3.Connection,
    migrations: List[Tuple[str, str]]
) -> int:
    """
    Выполнить список SQL миграций.
    
    Args:
        conn: Подключение к БД
        migrations: Список кортежей (описание, sql)
        
    Returns:
        Количество успешно выполненных миграций
    """
    cursor = conn.cursor()
    executed = 0
    
    for description, sql in migrations:
        try:
            cursor.execute(sql)
            logger.info(f"✅ {description}")
            executed += 1
        except sqlite3.OperationalError as e:
            error_msg = str(e).lower()
            if "duplicate column" in error_msg or "already exists" in error_msg:
                logger.debug(f"⏭️  {description} - уже существует")
            else:
                logger.error(f"❌ {description}: {e}")
                raise
    
    return executed


class Migration:
    """
    Базовый класс для миграций.
    
    Использование:
        class MyMigration(Migration):
            name = "add_new_feature"
            description = "Добавление новой функции"
            
            def up(self, conn):
                safe_add_column(conn, 'users', 'new_field', 'TEXT')
                
            def down(self, conn):
                # Откат миграции (опционально)
                pass
    """
    name: str = ""
    description: str = ""
    
    def up(self, conn: sqlite3.Connection):
        """Применить миграцию"""
        raise NotImplementedError
    
    def down(self, conn: sqlite3.Connection):
        """Откатить миграцию (опционально)"""
        pass
    
    def run(self) -> bool:
        """Запустить миграцию"""
        try:
            with get_db_connection() as conn:
                self.up(conn)
                conn.commit()
            logger.info(f"✅ Миграция {self.name} выполнена успешно")
            return True
        except Exception as e:
            logger.error(f"❌ Миграция {self.name} не удалась: {e}")
            return False

