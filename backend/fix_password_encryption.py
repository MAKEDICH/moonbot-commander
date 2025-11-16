
"""
FIX: Remove multi-level encryption from server passwords
This script will decrypt passwords multiple times until we get the real password,
then re-encrypt it properly just once.
"""
import sqlite3
from cryptography.fernet import Fernet
from dotenv import load_dotenv
import os

load_dotenv()
key = os.getenv('ENCRYPTION_KEY')
f = Fernet(key)

conn = sqlite3.connect('moonbot_commander.db')
cursor = conn.cursor()

# Get all servers with passwords
cursor.execute('SELECT id, name, password FROM servers WHERE password IS NOT NULL AND password != ""')
servers = cursor.fetchall()

print(f'=== FIXING {len(servers)} SERVERS ===')
print()

for server_id, server_name, encrypted_pass in servers:
    print(f'Server {server_id} ({server_name}):')
    
    # Multi-level decrypt
    current = encrypted_pass
    level = 0
    
    while current.startswith('gAAAAA') and level < 20:
        level += 1
        try:
            current = f.decrypt(current.encode()).decode()
        except Exception as e:
            print(f'  [ERROR] Decryption failed at level {level}: {e}')
            print(f'  Skipping this server')
            current = None
            break
    
    if current is None:
        continue
    
    real_password = current
    print(f'  Real password: {real_password}')
    print(f'  Was encrypted {level} times!')
    
    # Re-encrypt properly (just once)
    new_encrypted = f.encrypt(real_password.encode()).decode()
    
    # Update in database
    cursor.execute('UPDATE servers SET password = ? WHERE id = ?', (new_encrypted, server_id))
    print(f'  [OK] Fixed and updated!')
    print()

conn.commit()
conn.close()

print('=== ALL DONE ===')
print('Please restart the application')



