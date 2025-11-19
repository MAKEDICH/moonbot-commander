
"""
FIX: Remove multi-level encryption from server passwords
This script will decrypt passwords multiple times until we get the real password,
then re-encrypt it properly just once.
"""
import sqlite3
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import os
from logger_utils import log

load_dotenv()
key = os.getenv('ENCRYPTION_KEY')
f = Fernet(key)

conn = sqlite3.connect('moonbot_commander.db')
cursor = conn.cursor()

# Get all servers with passwords
cursor.execute('SELECT id, name, password FROM servers WHERE password IS NOT NULL AND password != ""')
servers = cursor.fetchall()

log(f'=== FIXING {len(servers)} SERVERS ===', level="INFO")
log('')

for server_id, server_name, encrypted_pass in servers:
    log(f'Server {server_id} ({server_name}):', level="INFO")
    
    # Multi-level decrypt
    current = encrypted_pass
    level = 0
    
    while current.startswith('gAAAAA') and level < 20:
        level += 1
        try:
            current = f.decrypt(current.encode()).decode()
        except Exception as e:
            log(f'  [ERROR] Decryption failed at level {level}: {e}', level="ERROR")
            log(f'  Skipping this server', level="WARNING")
            current = None
            break
    
    if current is None:
        continue
    
    real_password = current
    # SECURITY: НЕ выводим реальный пароль в логи!
    log(f'  Password length: {len(real_password)} characters', level="INFO")
    log(f'  Was encrypted {level} times!', level="INFO")
    
    # Re-encrypt properly (just once)
    new_encrypted = f.encrypt(real_password.encode()).decode()
    
    # Update in database
    cursor.execute('UPDATE servers SET password = ? WHERE id = ?', (new_encrypted, server_id))
    log(f'  [OK] Fixed and updated!', level="INFO")
    log('')

conn.commit()
conn.close()

log('=== ALL DONE ===', level="INFO")
log('Please restart the application', level="INFO")



