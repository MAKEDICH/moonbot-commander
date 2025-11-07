"""
Migration: Add recovery codes table
"""
import sqlite3
from datetime import datetime

def run_migration():
    try:
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        # Проверяем существование таблицы
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='recovery_codes'
        """)
        
        if cursor.fetchone():
            print("[OK] Table 'recovery_codes' already exists")
            conn.close()
            return
        
        # Создаем таблицу recovery_codes
        cursor.execute("""
            CREATE TABLE recovery_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                code_hash VARCHAR NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )
        """)
        
        conn.commit()
        print("[OK] Table 'recovery_codes' created successfully")
        print("[OK] Migration completed!")
        print()
        print("INFO: Users will receive 10 recovery codes on registration")
        print("      These codes can be used to recover account access")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        raise

if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add recovery codes support")
    print("=" * 60)
    print()
    run_migration()
    print()
    print("=" * 60)




