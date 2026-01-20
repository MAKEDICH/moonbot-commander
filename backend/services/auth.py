"""
Authentication and authorization service
"""
from passlib.context import CryptContext
from datetime import timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os
import sys
from dotenv import load_dotenv
from utils.logging import log
from utils.config_loader import get_config_value
from utils.datetime_utils import utcnow

# Load environment variables from .env file
# Check Docker data directory first, then current directory
from pathlib import Path
docker_env = Path('/app/data/.env')
if docker_env.exists():
    load_dotenv(docker_env)
else:
    load_dotenv()

# Загружаем настройки из YAML конфигурации
secret_key_env = get_config_value('security', 'security.keys.secret_key_env', default='SECRET_KEY')
algorithm = get_config_value('security', 'security.jwt.algorithm', default='HS256')
access_token_expire = get_config_value('security', 'security.jwt.access_token_expire_minutes', default=43200)

# Check if SECRET_KEY is properly set
SECRET_KEY = os.getenv(secret_key_env, "")
if not SECRET_KEY or SECRET_KEY == "your-secret-key-change-this-in-production":
    log("\n" + "="*60)
    log("  [SECURITY ERROR] SECRET_KEY not set!")
    log("="*60)
    log("\nRun: python utils/init_security.py")
    log("\nThis will generate a secure SECRET_KEY and ENCRYPTION_KEY\n")
    sys.exit(1)

ALGORITHM = algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = access_token_expire

# Загружаем настройки паролей
password_max_length = get_config_value('security', 'security.password.max_length', default=72)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Проверка пароля
    
    Args:
        plain_password: Открытый пароль
        hashed_password: Хешированный пароль
        
    Returns:
        bool: True если пароль верный
    """
    # Обрезаем пароль до максимальной длины (ограничение bcrypt)
    plain_password = plain_password[:password_max_length]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    Хеширование пароля
    
    Args:
        password: Открытый пароль
        
    Returns:
        str: Хешированный пароль
    """
    # Обрезаем пароль до максимальной длины (ограничение bcrypt)
    password = password[:password_max_length]
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Создание JWT токена
    
    Args:
        data: Данные для токена
        expires_delta: Время жизни токена
        
    Returns:
        str: JWT токен
    """
    to_encode = data.copy()
    if expires_delta:
        expire = utcnow() + expires_delta
    else:
        expire = utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str):
    """
    Декодирование JWT токена
    
    Args:
        token: JWT токен
        
    Returns:
        dict: Данные из токена или None при ошибке
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


# OAuth2 scheme для авторизации
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# Dependency для получения текущего пользователя
async def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> "User":
    """
    Получить текущего пользователя по JWT токену
    
    Args:
        token: JWT токен
        
    Returns:
        User: Текущий пользователь
        
    Raises:
        HTTPException: Если токен невалиден
    """
    from models.models import User  # Локальный импорт чтобы избежать циклических зависимостей
    from models.database import SessionLocal
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
    
    # Создаем новую сессию для каждого запроса
    import asyncio
    db = SessionLocal()
    try:
        user = await asyncio.to_thread(
            lambda: db.query(User).filter(User.username == username).first()
        )
        if user is None:
            raise credentials_exception
        return user
    finally:
        db.close()

