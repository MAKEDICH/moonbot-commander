"""
Роутер для аутентификации и регистрации
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional

from database import get_db
from auth import (
    create_access_token,
    get_current_user,
    verify_password,
    get_password_hash,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
import schemas
import models
from totp import generate_totp_secret, verify_totp_code, generate_qr_code
from recovery import generate_recovery_codes, hash_recovery_code
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")
async def register(
    request: Request,
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    """Регистрация нового пользователя"""
    # Проверка существующего пользователя
    existing_user = db.query(models.User).filter(
        (models.User.username == user_data.username) | 
        (models.User.email == user_data.email)
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already registered"
        )
    
    # Создание пользователя
    hashed_password = get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Создание настроек по умолчанию
    user_settings = models.UserSettings(user_id=new_user.id)
    db.add(user_settings)
    db.commit()
    
    return new_user


@router.post("/login")
@limiter.limit("10/minute")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Вход в систему"""
    user = db.query(models.User).filter(
        models.User.username == form_data.username
    ).first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
        )
    
    # Если включена 2FA, требуем второй фактор
    if user.totp_enabled:
        return {
            "requires_2fa": True,
            "message": "Two-factor authentication required"
        }
    
    # Обновляем статистику входа
    user.login_count = (user.login_count or 0) + 1
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Создание токена
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "requires_2fa": False
    }


@router.post("/2fa/setup")
async def setup_2fa(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Настройка двухфакторной аутентификации"""
    if current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is already enabled"
        )
    
    # Генерация секрета
    totp_secret = generate_totp_secret()
    qr_code = generate_qr_code(current_user.username, totp_secret)
    
    # Сохраняем секрет (но пока не активируем)
    current_user.totp_secret = totp_secret
    db.commit()
    
    # Генерация recovery кодов
    recovery_codes = generate_recovery_codes()
    for code in recovery_codes:
        recovery_code = models.RecoveryCode(
            user_id=current_user.id,
            code_hash=hash_recovery_code(code)
        )
        db.add(recovery_code)
    
    db.commit()
    
    return {
        "qr_code": qr_code,
        "secret": totp_secret,
        "recovery_codes": recovery_codes
    }


@router.post("/2fa/verify")
@limiter.limit("10/minute")
async def verify_2fa_login(
    request: Request,
    credentials: schemas.TwoFactorLogin,
    db: Session = Depends(get_db)
):
    """Вход с двухфакторной аутентификацией"""
    user = db.query(models.User).filter(
        models.User.username == credentials.username
    ).first()
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect credentials"
        )
    
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled"
        )
    
    # Проверка TOTP кода
    if not verify_totp_code(user.totp_secret, credentials.totp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA code"
        )
    
    # Обновляем статистику входа
    user.login_count = (user.login_count or 0) + 1
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Создание токена
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_info(
    current_user: models.User = Depends(get_current_user)
):
    """Получить информацию о текущем пользователе"""
    return current_user


@router.post("/change-password")
async def change_password(
    password_data: schemas.PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Изменить пароль"""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}

