"""
Проверка работоспособности всех критических функций на сервере
"""
import sys
import os
from datetime import datetime, timedelta

# Проверка импортов
print("=" * 60)
print("CHECK IMPORTS")
print("=" * 60)

try:
    import models
    print("[OK] models imported")
except Exception as e:
    print(f"[ERROR] models: {e}")
    sys.exit(1)

try:
    import schemas
    print("[OK] schemas imported")
except Exception as e:
    print(f"[ERROR] schemas: {e}")

try:
    import udp_listener
    print("[OK] udp_listener imported")
except Exception as e:
    print(f"[ERROR] udp_listener: {e}")

try:
    import scheduler
    print("[OK] scheduler imported")
except Exception as e:
    print(f"[ERROR] scheduler: {e}")

try:
    import encryption
    print("[OK] encryption imported")
except Exception as e:
    print(f"[ERROR] encryption: {e}")

# Проверка БД
print("\n" + "=" * 60)
print("CHECK DATABASE")
print("=" * 60)

try:
    from database import SessionLocal, engine
    from sqlalchemy import text
    
    db = SessionLocal()
    
    # Проверка подключения
    db.execute(text("SELECT 1"))
    print("[OK] DB connection works")
    
    # Проверка таблиц
    tables = [
        'users', 'servers', 'scheduled_commands', 
        'udp_listener_status', 'moonbot_orders', 'sql_command_log'
    ]
    
    for table in tables:
        try:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
            print(f"[OK] Table {table}: {result} records")
        except Exception as e:
            print(f"[ERROR] Table {table}: {e}")
    
    db.close()
    
except Exception as e:
    print(f"[ERROR] DB: {e}")

# Проверка файлов
print("\n" + "=" * 60)
print("CHECK FILES")
print("=" * 60)

files_to_check = [
    '.env',
    'scheduler_enabled.txt',
    'moonbot.db'
]

for file in files_to_check:
    if os.path.exists(file):
        size = os.path.getsize(file)
        print(f"[OK] {file}: {size} bytes")
    else:
        print(f"[ERROR] {file}: not found")

# Проверка UDP Listener
print("\n" + "=" * 60)
print("CHECK UDP LISTENER")
print("=" * 60)

try:
    status = udp_listener.get_all_status()
    print(f"[OK] Active listeners: {len(status)}")
    
    for listener_status in status:
        print(f"  - Server {listener_status['server_id']}: {listener_status['status']}")
        
except Exception as e:
    print(f"[ERROR] UDP Listener: {e}")

# Проверка Scheduler
print("\n" + "=" * 60)
print("CHECK SCHEDULER")
print("=" * 60)

try:
    enabled = scheduler.is_scheduler_enabled()
    print(f"[OK] Scheduler enabled: {enabled}")
    
    # Проверка файла состояния
    if os.path.exists('scheduler_enabled.txt'):
        with open('scheduler_enabled.txt', 'r') as f:
            content = f.read().strip()
        print(f"[OK] scheduler_enabled.txt content: '{content}'")
    else:
        print("[ERROR] scheduler_enabled.txt not found")
        
except Exception as e:
    print(f"[ERROR] Scheduler: {e}")

# Проверка Encryption
print("\n" + "=" * 60)
print("CHECK ENCRYPTION")
print("=" * 60)

try:
    test_password = "test123"
    encrypted = encryption.encrypt_password(test_password)
    decrypted = encryption.decrypt_password(encrypted)
    
    if decrypted == test_password:
        print("[OK] Encryption/decryption works")
    else:
        print("[ERROR] Encryption: decrypted password mismatch")
        
except Exception as e:
    print(f"[ERROR] Encryption: {e}")

# Проверка времени
print("\n" + "=" * 60)
print("CHECK TIME")
print("=" * 60)

print(f"[OK] Current local server time: {datetime.now()}")
print(f"[OK] Current UTC time: {datetime.utcnow()}")
print(f"[OK] Difference: {(datetime.now() - datetime.utcnow()).total_seconds() / 3600:.1f} hours")

# Итоги
print("\n" + "=" * 60)
print("CHECK COMPLETED")
print("=" * 60)
print("\n[OK] All critical components checked")
print("[OK] If there are errors above - fix them before using")

