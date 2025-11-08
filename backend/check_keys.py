"""
Check if security keys are valid
Returns exit code 0 if valid, 1 if invalid
"""
import sys
from pathlib import Path
from cryptography.fernet import Fernet

def check_keys():
    env_path = Path('.env')
    
    if not env_path.exists():
        print('[ERROR] .env file not found')
        return False
    
    # Read .env
    env_vars = {}
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                env_vars[key] = value
    
    # Check SECRET_KEY
    secret_key = env_vars.get('SECRET_KEY', '')
    if not secret_key or len(secret_key) < 32 or secret_key in [
        'your-secret-key-change-this-in-production',
        'change-me-to-random-secret-key-minimum-32-characters'
    ]:
        print('[ERROR] SECRET_KEY is invalid or placeholder')
        return False
    
    # Check ENCRYPTION_KEY
    encryption_key = env_vars.get('ENCRYPTION_KEY', '')
    if not encryption_key or encryption_key == 'change-me-to-fernet-encryption-key':
        print('[ERROR] ENCRYPTION_KEY is invalid or placeholder')
        return False
    
    # Validate Fernet key format
    try:
        Fernet(encryption_key.encode())
    except Exception as e:
        print(f'[ERROR] ENCRYPTION_KEY is not a valid Fernet key: {e}')
        return False
    
    print('[OK] All security keys are valid')
    return True

if __name__ == '__main__':
    if check_keys():
        sys.exit(0)
    else:
        sys.exit(1)

