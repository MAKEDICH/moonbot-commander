
"""
FIX: Remove multi-level encryption from server passwords
This script will decrypt passwords multiple times until we get the real password,
then re-encrypt it properly just once.
"""
import os
import sqlite3
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from dotenv import load_dotenv

# Определяем директории
UPDATES_DIR = Path(__file__).resolve().parent
BACKEND_DIR = UPDATES_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from utils.logging import log

# Загружаем .env (проверяем Docker директорию)
docker_env = Path('/app/data/.env')
if docker_env.exists():
    load_dotenv(docker_env)
else:
    load_dotenv(BACKEND_DIR / '.env')
key = os.getenv('ENCRYPTION_KEY')
f = Fernet(key)

# Определяем путь к БД
db_path = BACKEND_DIR / 'moonbot_commander.db'
if not db_path.exists():
    # Проверяем корень проекта
    db_path = BACKEND_DIR.parent / 'moonbot_commander.db'

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Get all servers with passwords
cursor.execute(
    'SELECT id, name, password FROM servers WHERE password IS NOT NULL AND password != ""')
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
            log(
                f'  [ERROR] Decryption failed at level {level}: {e}', level="ERROR")
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
    cursor.execute('UPDATE servers SET password = ? WHERE id = ?',
                   (new_encrypted, server_id))
    log(f'  [OK] Fixed and updated!', level="INFO")
    log('')

conn.commit()
conn.close()

log('=== ALL DONE ===', level="INFO")
log('Please restart the application', level="INFO")
