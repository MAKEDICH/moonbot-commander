"""
Миграция: Изменение server_id на nullable в таблице scheduled_command_servers

Это необходимо для поддержки групп серверов - когда указывается группа,
server_id должен быть NULL, а group_name содержит название группы.
"""
import sqlite3
import os
import sys
from pathlib import Path

# Добавляем путь к backend для импорта utils
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from utils.logging import log
except ImportError:
    # Fallback если utils недоступен
    def log(msg, level="INFO"):
        print(f"[{level}] {msg}")


def get_db_path() -> str:
    """
    Получить путь к БД.
    
    Проверяет несколько возможных путей:
    1. Относительный путь от текущей директории (./moonbot_commander.db)
    2. Путь в директории backend
    3. Путь относительно расположения этого файла
    """
    # 1. Проверяем текущую рабочую директорию
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
        
        # Проверяем ограничение NOT NULL на server_id
        cursor.execute("PRAGMA table_info(scheduled_command_servers)")
        columns = cursor.fetchall()
        
        for col in columns:
            # col[1] = name, col[3] = notnull
            if col[1] == 'server_id' and col[3] == 1:  # 1 = NOT NULL
                conn.close()
                return True
        
        conn.close()
        return False
    except Exception as e:
        log(f"[MIGRATION] Ошибка при проверке миграции fix_scheduled_command_servers_nullable: {e}", level="ERROR")
        return False


def run_migration():
    """
    Выполнить миграцию.
    
    SQLite не поддерживает ALTER COLUMN, поэтому нужно:
    1. Создать новую таблицу с правильной структурой
    2. Скопировать данные
    3. Удалить старую таблицу
    4. Переименовать новую таблицу
    """
    db_path = get_db_path()
    if not os.path.exists(db_path):
        log(f"[MIGRATION] БД не найдена по пути: {db_path}", level="WARNING")
        return
    
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        log("[MIGRATION] Исправление ограничения server_id в scheduled_command_servers...")
        
        # Начинаем транзакцию
        cursor.execute("BEGIN TRANSACTION")
        
        # 1. Создаём временную таблицу с правильной структурой
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_command_servers_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scheduled_command_id INTEGER NOT NULL,
                server_id INTEGER,
                group_name TEXT,
                FOREIGN KEY (scheduled_command_id) REFERENCES scheduled_commands(id),
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        log("[MIGRATION] Создана временная таблица scheduled_command_servers_new")
        
        # 2. Копируем данные
        cursor.execute("""
            INSERT INTO scheduled_command_servers_new (id, scheduled_command_id, server_id, group_name)
            SELECT id, scheduled_command_id, server_id, group_name
            FROM scheduled_command_servers
        """)
        copied_rows = cursor.rowcount
        log(f"[MIGRATION] Скопировано {copied_rows} записей")
        
        # 3. Удаляем старую таблицу
        cursor.execute("DROP TABLE scheduled_command_servers")
        log("[MIGRATION] Старая таблица удалена")
        
        # 4. Переименовываем новую таблицу
        cursor.execute("ALTER TABLE scheduled_command_servers_new RENAME TO scheduled_command_servers")
        log("[MIGRATION] Новая таблица переименована")
        
        # 5. Восстанавливаем индексы
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_scheduled_command_servers_cmd_id 
            ON scheduled_command_servers(scheduled_command_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_scheduled_command_servers_server_id 
            ON scheduled_command_servers(server_id)
        """)
        log("[MIGRATION] Индексы восстановлены")
        
        # Фиксируем транзакцию
        conn.commit()
        log("[MIGRATION] Миграция fix_scheduled_command_servers_nullable завершена успешно")
        
    except sqlite3.OperationalError as e:
        if conn:
            conn.rollback()
        log(f"[MIGRATION] Ошибка SQL при миграции: {e}", level="ERROR")
    except Exception as e:
        if conn:
            conn.rollback()
        log(f"[MIGRATION] Неизвестная ошибка при миграции: {e}", level="ERROR")
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    if check_migration_needed():
        run_migration()
    else:
        log("[MIGRATION] Миграция fix_scheduled_command_servers_nullable не требуется")

