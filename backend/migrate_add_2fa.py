"""
Migration: Add 2FA support (TOTP/Google Authenticator)
"""
import sqlite3
from datetime import datetime

def run_migration():
    try:
        conn = sqlite3.connect('moonbot_commander.db')
        cursor = conn.cursor()
        
        # Проверяем существование колонок
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'totp_secret' in columns and 'totp_enabled' in columns:
            print("[OK] 2FA columns already exist")
            conn.close()
            return
        
        # Добавляем колонки для 2FA
        if 'totp_secret' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN totp_secret VARCHAR")
            print("[OK] Added 'totp_secret' column")
        
        if 'totp_enabled' not in columns:
            cursor.execute("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE")
            print("[OK] Added 'totp_enabled' column")
        
        conn.commit()
        print("[OK] Migration completed!")
        print()
        print("INFO: Users can now enable 2FA with Google Authenticator")
        
        conn.close()
        
    except Exception as e:
        print(f"[ERROR] Migration failed: {str(e)}")
        raise

if __name__ == "__main__":
    print("=" * 60)
    print("  Migration: Add 2FA support")
    print("=" * 60)
    print()
    run_migration()
    print()
    print("=" * 60)








