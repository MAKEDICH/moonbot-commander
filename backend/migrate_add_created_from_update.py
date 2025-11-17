"""
Миграция: Добавление поля created_from_update в moonbot_orders

Решает проблему UNKNOWN ордеров когда UPDATE приходит раньше INSERT
"""

from sqlalchemy import create_engine, text
from database import DATABASE_URL
import sys

def run_migration():
    print("=" * 60)
    print("  Миграция: Добавление created_from_update")
    print("=" * 60)
    print()
    
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    
    with engine.connect() as conn:
        try:
            # Проверяем существует ли уже поле
            result = conn.execute(text("PRAGMA table_info(moonbot_orders)"))
            columns = [row[1] for row in result]
            
            if 'created_from_update' in columns:
                print("[OK] Pole 'created_from_update' uzhe sushchestvuet")
            else:
                print("[+] Dobavlyayu pole 'created_from_update'...")
                conn.execute(text("ALTER TABLE moonbot_orders ADD COLUMN created_from_update BOOLEAN DEFAULT 0"))
                conn.commit()
                print("[OK] Pole 'created_from_update' dobavleno")
            
            if 'buy_date' in columns:
                print("[OK] Pole 'buy_date' uzhe sushchestvuet")
            else:
                print("[+] Dobavlyayu pole 'buy_date'...")
                conn.execute(text("ALTER TABLE moonbot_orders ADD COLUMN buy_date DATETIME"))
                conn.commit()
                print("[OK] Pole 'buy_date' dobavleno")
            
            print()
            print("=" * 60)
            print("  [SUCCESS] Migratsiya zavershena uspeshno!")
            print("=" * 60)
            
        except Exception as e:
            print(f"[ERROR] Oshibka migratsii: {e}")
            import traceback
            traceback.print_exc()
            conn.rollback()
            return False
    
    return True

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

