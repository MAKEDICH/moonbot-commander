"""
Миграция: Добавление колонки group_name в таблицу scheduled_command_servers

Эта колонка позволяет указывать группу серверов для отложенной команды
вместо конкретного сервера.
"""
import sqlite3
import os
from pathlib import Path
from utils.logging import log


def get_db_path() -> str:
    """
    Получить путь к БД.
    
    Проверяет несколько возможных путей:
    1. Относительный путь от текущей директории (./moonbot_commander.db)
    2. Путь в директории backend
    3. Путь относительно расположения этого файла
    """
    # 1. Проверяем текущую рабочую директорию (как делает database.py)
    cwd_db = Path.cwd() / 'moonbot_commander.db'
    if cwd_db.exists():
        return str(cwd_db)
    
    # 2. Проверяем backend директорию от текущей
    backend_db = Path.cwd() / 'backend' / 'moonbot_commander.db'
    if backend_db.exists():
        return str(backend_db)
    
    # 3. Проверяем путь относительно этого файла
    backend_dir = Path(__file__).resolve().parent.parent.parent
    file_based_db = backend_dir / 'moonbot_commander.db'
    if file_based_db.exists():
        return str(file_based_db)
    
    # 4. Проверяем корень проекта
    project_root = backend_dir.parent
    root_db = project_root / 'moonbot_commander.db'
    if root_db.exists():
        return str(root_db)
    
    # По умолчанию возвращаем путь в backend
    return str(file_based_db)


def check_migration_needed() -> bool:
    """Проверить нужна ли миграция."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем существует ли таблица
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_command_servers'")
        if not cursor.fetchone():
            conn.close()
            return False
        
        # Проверяем существует ли колонка group_name
        cursor.execute("PRAGMA table_info(scheduled_command_servers)")
        columns = [col[1] for col in cursor.fetchall()]
        
        conn.close()
        return 'group_name' not in columns
    except Exception as e:
        log(f"[MIGRATION] Ошибка при проверке миграции scheduled_command_servers: {e}", level="ERROR")
        return False


def run_migration():
    """Выполнить миграцию."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        log(f"[MIGRATION] БД не найдена по пути: {db_path}", level="WARNING")
        return
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        log("[MIGRATION] Добавление колонки group_name в scheduled_command_servers...")
        
        # Проверяем что колонки ещё нет
        cursor.execute("PRAGMA table_info(scheduled_command_servers)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'group_name' not in columns:
            cursor.execute("ALTER TABLE scheduled_command_servers ADD COLUMN group_name TEXT")
            log("[MIGRATION] Колонка group_name добавлена успешно")
        else:
            log("[MIGRATION] Колонка group_name уже существует")
        
        conn.commit()
        log("[MIGRATION] Миграция scheduled_command_servers завершена успешно")
    except sqlite3.OperationalError as e:
        log(f"[MIGRATION] Ошибка SQL при миграции scheduled_command_servers: {e}", level="ERROR")
    except Exception as e:
        log(f"[MIGRATION] Неизвестная ошибка при миграции scheduled_command_servers: {e}", level="ERROR")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    if check_migration_needed():
        run_migration()
    else:
        log("[MIGRATION] Миграция scheduled_command_servers не требуется")

