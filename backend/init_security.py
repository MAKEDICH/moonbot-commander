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
    env_path = Path('.env')
    env_example_path = Path('.env.example')
    
    # Read existing .env if exists
    existing_env = {}
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    existing_env[key] = value
    
    # Check if SECRET_KEY needs to be generated
    secret_key = existing_env.get('SECRET_KEY', '')
    if not secret_key or secret_key == 'your-secret-key-change-this-in-production':
        secret_key = generate_secret_key()
        print('[SECURITY] Generated new SECRET_KEY')
    else:
        print('[OK] SECRET_KEY already exists')
    
    # Check if ENCRYPTION_KEY needs to be generated
    encryption_key = existing_env.get('ENCRYPTION_KEY', '')
    if not encryption_key:
        encryption_key = generate_encryption_key()
        print('[SECURITY] Generated new ENCRYPTION_KEY')
    else:
        print('[OK] ENCRYPTION_KEY already exists')
    
    # Update .env file
    env_content = f"""# Security keys (DO NOT COMMIT TO GIT!)
SECRET_KEY={secret_key}
ENCRYPTION_KEY={encryption_key}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Database
DATABASE_URL=sqlite:///./moonbot_commander.db

# CORS (comma-separated list of allowed origins)
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
"""
    
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print('[OK] .env file updated')
    print()
    print('=' * 60)
    print('  IMPORTANT: Add .env to .gitignore!')
    print('=' * 60)
    return secret_key, encryption_key

if __name__ == '__main__':
    print('=' * 60)
    print('  Security Initialization')
    print('=' * 60)
    print()
    init_env_file()
    print()
    print('[OK] Security initialization completed')

