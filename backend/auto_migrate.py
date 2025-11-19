"""
Автоматическое применение миграций при запуске приложения
"""
import os
import sys
import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class AutoMigrator:
    def __init__(self, db_path="moonbot_commander.db"):
        self.db_path = db_path
        
    def check_and_apply_migrations(self):
        """Проверяет и применяет недостающие миграции"""
        if not os.path.exists(self.db_path):
            logger.info(f"Database not found at {self.db_path}")
            return
            
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Проверяем существование таблицы servers
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='servers'")
            if not cursor.fetchone():
                logger.info("Table 'servers' not found, skipping migrations")
                conn.close()
                return
            
            # Получаем список колонок
            cursor.execute("PRAGMA table_info(servers)")
            columns = {col[1] for col in cursor.fetchall()}
            
            applied = []
            
            # Проверяем и добавляем is_localhost
            if 'is_localhost' not in columns:
                logger.info("Adding column 'is_localhost'...")
                cursor.execute("ALTER TABLE servers ADD COLUMN is_localhost BOOLEAN DEFAULT FALSE")
                applied.append('is_localhost')
            
            # Проверяем и добавляем default_currency
            if 'default_currency' not in columns:
                logger.info("Adding column 'default_currency'...")
                cursor.execute("ALTER TABLE servers ADD COLUMN default_currency TEXT")
                applied.append('default_currency')
            
            # Проверяем scheduled_commands
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scheduled_commands'")
            if cursor.fetchone():
                cursor.execute("PRAGMA table_info(scheduled_commands)")
                sched_columns = {col[1] for col in cursor.fetchall()}
                
                if 'recurrence_type' not in sched_columns:
                    logger.info("Adding column 'recurrence_type'...")
                    cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN recurrence_type VARCHAR DEFAULT 'once'")
                    applied.append('recurrence_type')
                
                if 'weekdays' not in sched_columns:
                    logger.info("Adding column 'weekdays'...")
                    cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN weekdays VARCHAR")
                    applied.append('weekdays')
            
            # Создаем таблицу миграций если её нет
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS migrations_registry (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    migration_name TEXT UNIQUE NOT NULL,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Регистрируем примененные миграции
            for migration in applied:
                cursor.execute(
                    "INSERT OR IGNORE INTO migrations_registry (migration_name) VALUES (?)",
                    (f"auto_migrate_{migration}",)
                )
            
            if applied:
                conn.commit()
                logger.info(f"✅ Applied {len(applied)} migrations: {', '.join(applied)}")
            else:
                logger.debug("No migrations needed")
            
            conn.close()
            
        except Exception as e:
            logger.error(f"Error during auto-migration: {e}")
            if 'conn' in locals():
                conn.close()

def run_auto_migrations():
    """Запускает автоматические миграции для всех возможных БД"""
    # Проверяем БД в текущей папке (backend)
    migrator = AutoMigrator("moonbot_commander.db")
    migrator.check_and_apply_migrations()
    
    # Проверяем БД в корневой папке
    parent_db = "../moonbot_commander.db"
    if os.path.exists(parent_db):
        migrator = AutoMigrator(parent_db)
        migrator.check_and_apply_migrations()

if __name__ == "__main__":
    # Настраиваем логирование
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    run_auto_migrations()
