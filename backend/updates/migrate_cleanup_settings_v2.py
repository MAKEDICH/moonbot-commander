"""Добавление новых полей в cleanup_settings для гибкого выбора"""
from sqlalchemy import create_engine, Column, Boolean, Integer, text
from models.database import Base, SessionLocal, engine
from models.models import CleanupSettings


def migrate():
    """Добавить новые поля в таблицу cleanup_settings"""
    try:
        with engine.connect() as conn:
            # Проверить существуют ли уже колонки
            result = conn.execute(text("PRAGMA table_info(cleanup_settings)"))
            columns = [row[1] for row in result]
            
            # Добавить колонки если их нет
            if 'auto_cleanup_sql_logs' not in columns:
                conn.execute(text("ALTER TABLE cleanup_settings ADD COLUMN auto_cleanup_sql_logs BOOLEAN DEFAULT 1"))
                conn.commit()
                print("[OK] Added column auto_cleanup_sql_logs")
            
            if 'auto_cleanup_command_history' not in columns:
                conn.execute(text("ALTER TABLE cleanup_settings ADD COLUMN auto_cleanup_command_history BOOLEAN DEFAULT 1"))
                conn.commit()
                print("[OK] Added column auto_cleanup_command_history")
            
            if 'auto_cleanup_backend_logs' not in columns:
                conn.execute(text("ALTER TABLE cleanup_settings ADD COLUMN auto_cleanup_backend_logs BOOLEAN DEFAULT 0"))
                conn.commit()
                print("[OK] Added column auto_cleanup_backend_logs")
            
            if 'backend_logs_max_size_mb' not in columns:
                conn.execute(text("ALTER TABLE cleanup_settings ADD COLUMN backend_logs_max_size_mb INTEGER DEFAULT 10"))
                conn.commit()
                print("[OK] Added column backend_logs_max_size_mb")
        
        print("[SUCCESS] Migration completed!")
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")


if __name__ == "__main__":
    migrate()

