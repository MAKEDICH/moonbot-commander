"""
Security initialization script
Generates SECRET_KEY and ENCRYPTION_KEY if they don't exist
"""
import os
import secrets
from pathlib import Path
from cryptography.fernet import Fernet

def generate_secret_key():
    """Generate a secure random secret key"""
    return secrets.token_urlsafe(32)

def generate_encryption_key():
    """Generate a Fernet-compatible encryption key"""
    return Fernet.generate_key().decode()

def init_env_file():
    """Initialize .env file with secure keys"""
    # Check if we're in Docker (data directory exists)
    data_dir = Path('/app/data')
    is_docker = data_dir.exists()
    
    if is_docker:
        env_path = data_dir / '.env'
    else:
        env_path = Path('.env')
    
    env_example_path = Path('.env.example')
    
    keys_regenerated = False
    
    # Read existing .env if exists
    existing_env = {}
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    existing_env[key] = value
    
    # Check if SECRET_KEY needs to be generated
    secret_key = existing_env.get('SECRET_KEY', '')
    secret_key_is_valid = secret_key and len(secret_key) > 32 and secret_key not in [
        'your-secret-key-change-this-in-production',
        'change-me-to-random-secret-key-minimum-32-characters'
    ]
    
    if not secret_key_is_valid:
        secret_key = generate_secret_key()
        print('[SECURITY] Generated new SECRET_KEY')
        keys_regenerated = True
    else:
        print('[OK] SECRET_KEY already exists')
    
    # Check if ENCRYPTION_KEY needs to be generated
    encryption_key = existing_env.get('ENCRYPTION_KEY', '')
    encryption_key_is_valid = False
    
    if encryption_key and encryption_key not in ['change-me-to-fernet-encryption-key']:
        # Validate that it's a proper Fernet key
        try:
            Fernet(encryption_key.encode())
            encryption_key_is_valid = True
        except Exception:
            encryption_key_is_valid = False
    
    if not encryption_key_is_valid:
        encryption_key = generate_encryption_key()
        print('[SECURITY] Generated new ENCRYPTION_KEY')
        keys_regenerated = True
    else:
        print('[OK] ENCRYPTION_KEY already exists')
    
    # Get existing DATABASE_URL or use default
    database_url = existing_env.get('DATABASE_URL', os.environ.get('DATABASE_URL', 'sqlite:///./moonbot_commander.db'))
    cors_origins = existing_env.get('CORS_ORIGINS', os.environ.get('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'))
    
    # Update .env file
    env_content = f"""# Security keys (DO NOT COMMIT TO GIT!)
SECRET_KEY={secret_key}
ENCRYPTION_KEY={encryption_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Database
DATABASE_URL={database_url}

# CORS (comma-separated list of allowed origins)
CORS_ORIGINS={cors_origins}
"""
    
    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    # Create symlink in app directory for compatibility (Docker only)
    if is_docker:
        app_env = Path('.env')
        if not app_env.exists():
            try:
                app_env.symlink_to(env_path)
                print('[OK] Created symlink .env -> /app/data/.env')
            except (OSError, FileExistsError):
                pass
    
    if keys_regenerated:
        print('[WARNING] Security keys were regenerated!')
        print('[ACTION] Old database is incompatible and should be deleted')
    
    print(f'[OK] .env file updated at {env_path}')
    print()
    print('=' * 60)
    print('  IMPORTANT: Add .env to .gitignore!')
    print('=' * 60)
    return keys_regenerated

if __name__ == '__main__':
    print('=' * 60)
    print('  Security Initialization')
    print('=' * 60)
    print()
    init_env_file()
    print()
    print('[OK] Security initialization completed')

