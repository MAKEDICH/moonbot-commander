"""
Migration: Add password field to servers table
"""
import sqlite3
from datetime import datetime

def run_migration():
    try:
        # Подключение к БД
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        # Проверяем, существует ли уже колонка password
        cursor.execute("PRAGMA table_info(servers)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'password' in columns:
            print("[OK] Column 'password' already exists in servers table")
            conn.close()
            return
        
        # Добавляем колонку password
        cursor.execute("""
            ALTER TABLE servers
            ADD COLUMN password VARCHAR
        """)
        
        conn.commit()
        print("[OK] Column 'password' successfully added to servers table")
        print("[OK] Migration completed successfully!")
        print()
        print("INFO: You can now specify UDP password for each server")
        print("      This is required for new MoonBot protocol (HMAC-SHA256)")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        raise

if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add UDP password support")
    print("=" * 60)
    print()
    run_migration()
    print()
    print("=" * 60)

