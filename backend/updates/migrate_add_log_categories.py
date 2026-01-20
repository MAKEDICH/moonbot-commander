"""
Миграция: Добавление поля log_categories в user_settings

Добавляет поле для хранения выбранных категорий логов (JSON).
"""

from sqlalchemy import text
from models.database import engine
from utils.logging import log


def migrate() -> bool:
    """
    Добавить колонку log_categories в таблицу user_settings.
    
    Returns:
        True если миграция применена, False если уже существует
    """
    with engine.connect() as conn:
        # Проверяем существование колонки
        result = conn.execute(text(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='user_settings'"
        ))
        row = result.fetchone()
        
        if row and 'log_categories' in row[0]:
            return False  # Колонка уже существует
        
        # Добавляем колонку
        conn.execute(text(
            "ALTER TABLE user_settings ADD COLUMN log_categories TEXT"
        ))
        conn.commit()
        
        log("[MIGRATION] Added log_categories column to user_settings")
        return True


if __name__ == "__main__":
    result = migrate()
    print(f"Migration applied: {result}")



