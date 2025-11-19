from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import os
import sys
from dotenv import load_dotenv
from logger_utils import log

# Load environment variables from .env file
load_dotenv()

# Check if SECRET_KEY is properly set
SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY or SECRET_KEY == "your-secret-key-change-this-in-production":
    log("\n" + "="*60)
    log("  [SECURITY ERROR] SECRET_KEY not set!")
    log("="*60)
    log("\nRun: python init_security.py")
    log("\nThis will generate a secure SECRET_KEY and ENCRYPTION_KEY\n")
    sys.exit(1)

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "43200"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверка пароля"""
    # Обрезаем пароль до 72 байт (ограничение bcrypt)
    plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Хеширование пароля"""
    # Обрезаем пароль до 72 байт (ограничение bcrypt)
    password = password[:72]
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Создание JWT токена"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str):
    """Декодирование JWT токена"""
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
    from models import User  # Локальный импорт чтобы избежать циклических зависимостей
    from database import SessionLocal
    
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
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise credentials_exception
        return user
    finally:
        db.close()

