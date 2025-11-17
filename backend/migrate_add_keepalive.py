"""Добавление поля keepalive_enabled в таблицу servers"""
from sqlalchemy import create_engine, text
from database import engine


def migrate():
    """Добавить поле keepalive_enabled в таблицу servers"""
    try:
        with engine.connect() as conn:
            # Проверить существует ли уже колонка
            result = conn.execute(text("PRAGMA table_info(servers)"))
            columns = [row[1] for row in result]
            
            if 'keepalive_enabled' not in columns:
                conn.execute(text("ALTER TABLE servers ADD COLUMN keepalive_enabled BOOLEAN DEFAULT 1"))
                conn.commit()
                print("[OK] Added column keepalive_enabled to servers table")
            else:
                print("[SKIP] Column keepalive_enabled already exists")
        
        print("[SUCCESS] Migration completed!")
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")


if __name__ == "__main__":
    migrate()


