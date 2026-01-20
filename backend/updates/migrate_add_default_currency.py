"""
Миграция: Добавление поля default_currency в таблицу servers

Автоматически определяется из lst команды (TRY, USDC, USDT, BTC, ETH, etc.)
"""

from sqlalchemy import text
from models.database import engine


def migrate():
    """Добавить поле default_currency в таблицу servers"""
    try:
        with engine.connect() as conn:
            # Проверяем существует ли уже поле
            result = conn.execute(text("PRAGMA table_info(servers)"))
            columns = [row[1] for row in result]
            
            if 'default_currency' in columns:
                print("[SKIP] Column 'default_currency' already exists")
            else:
                print("[+] Adding column 'default_currency' (VARCHAR(10), DEFAULT 'USDT')...")
                conn.execute(text(
                    "ALTER TABLE servers ADD COLUMN default_currency VARCHAR(10) DEFAULT 'USDT'"
                ))
                conn.commit()
                print("[OK] Column 'default_currency' added")
                print("[INFO] Default value: 'USDT'")
                print("[INFO] Will be auto-updated from 'lst' commands")
            
            print("[SUCCESS] Migration completed!")
            return True
            
    except Exception as e:
        print(f"[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = migrate()
    import sys
    sys.exit(0 if success else 1)




