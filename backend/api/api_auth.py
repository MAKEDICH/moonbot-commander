"""
Эндпоинты для аутентификации и управления пользователями
"""
import asyncio
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from core import limiter
from services import auth
from services.auth import get_current_user
from services import recovery
from utils.datetime_utils import utcnow


@app.post("/api/auth/register", response_model=schemas.RegisterResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/hour")  # Максимум 5 регистраций в час с одного IP
async def register(request: Request, user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    """
    Регистрация нового пользователя.
    
    Args:
        request: HTTP запрос (для rate limiting)
        user_data: Данные для создания пользователя
        db: Сессия базы данных
        
    Returns:
        RegisterResponse: Пользователь и recovery коды
        
    Raises:
        HTTPException: Если пользователь уже существует
    """
    # Проверка существующего пользователя
    existing_user = await asyncio.to_thread(
        lambda: db.query(models.User).filter(models.User.username == user_data.username).first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким именем уже существует")
    
    existing_email = await asyncio.to_thread(
        lambda: db.query(models.User).filter(models.User.email == user_data.email).first()
    )
    if existing_email:
        raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
    
    # Создание нового пользователя
    hashed_password = auth.get_password_hash(user_data.password)
    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_password
    )
    
    await asyncio.to_thread(db.add, new_user)
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, new_user)
    
    # Генерируем recovery коды
    plain_codes = recovery.generate_recovery_codes(10)
    
    # Сохраняем хешированные коды в БД
    for code in plain_codes:
        code_hash = recovery.hash_recovery_code(code)
        recovery_code = models.RecoveryCode(
            user_id=new_user.id,
            code_hash=code_hash
        )
        await asyncio.to_thread(db.add, recovery_code)
    
    await asyncio.to_thread(db.commit)
    
    return {
        "user": new_user,
        "recovery_codes": plain_codes
    }


@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("10/minute")  # Максимум 10 попыток входа в минуту
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Вход в систему (по username или email).
    
    Args:
        request: HTTP запрос (для rate limiting)
        form_data: Форма с username и password
        db: Сессия базы данных
        
    Returns:
        Token: JWT токен или указание на необходимость 2FA
        
    Raises:
        HTTPException: Если учетные данные неверны
    """
    # Ищем пользователя по username или email
    user = await asyncio.to_thread(
        lambda: db.query(models.User).filter(
            (models.User.username == form_data.username) | (models.User.email == form_data.username)
        ).first()
    )
    
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Пользователь неактивен")
    
    # Если у пользователя включен 2FA - не даем токен сразу
    if user.totp_enabled:
        return {
            "access_token": "2FA_REQUIRED",
            "token_type": "2fa_required",
            "username": user.username
        }
    
    access_token = auth.create_access_token(data={"sub": user.username})
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.get("/api/auth/me", response_model=schemas.User)
async def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """
    Получение информации о текущем пользователе.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        
    Returns:
        User: Информация о пользователе
    """
    return current_user


@app.put("/api/auth/change-password")
async def change_password(
    password_data: schemas.PasswordChange,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Изменение пароля пользователя.
    
    Args:
        password_data: Текущий и новый пароль
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        dict: Сообщение об успехе
        
    Raises:
        HTTPException: Если текущий пароль неверен
    """
    # Проверяем текущий пароль
    if not auth.verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный текущий пароль"
        )
    
    # Проверяем что новый пароль отличается от текущего
    if password_data.current_password == password_data.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Новый пароль должен отличаться от текущего"
        )
    
    # Обновляем пароль
    current_user.hashed_password = auth.get_password_hash(password_data.new_password)
    await asyncio.to_thread(db.commit)
    
    return {"message": "Пароль успешно изменен"}


@app.post("/api/auth/recover-password")
async def recover_password(
    recovery_data: schemas.PasswordRecovery,
    db: Session = Depends(get_db)
):
    """
    Восстановление пароля через recovery код (принимает username или email).
    
    Args:
        recovery_data: Username/email, recovery код и новый пароль
        db: Сессия базы данных
        
    Returns:
        dict: Сообщение об успехе и количество оставшихся кодов
        
    Raises:
        HTTPException: Если recovery код неверен
    """
    # Находим пользователя по username или email
    user = await asyncio.to_thread(
        lambda: db.query(models.User).filter(
            (models.User.username == recovery_data.username) | (models.User.email == recovery_data.username)
        ).first()
    )
    
    if not user:
        # Не сообщаем что пользователь не найден (безопасность)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или recovery код"
        )
    
    # Получаем неиспользованные recovery коды пользователя
    recovery_codes = await asyncio.to_thread(
        lambda: db.query(models.RecoveryCode).filter(
            models.RecoveryCode.user_id == user.id,
            models.RecoveryCode.used == False
        ).all()
    )
    
    if not recovery_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У вас не осталось recovery кодов. Обратитесь к администратору."
        )
    
    # Проверяем введенный код против всех неиспользованных кодов
    valid_code = None
    for code_record in recovery_codes:
        if recovery.verify_recovery_code(recovery_data.recovery_code, code_record.code_hash):
            valid_code = code_record
            break
    
    if not valid_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или recovery код"
        )
    
    # Помечаем код как использованный
    valid_code.used = True
    valid_code.used_at = utcnow()
    
    # Обновляем пароль
    user.hashed_password = auth.get_password_hash(recovery_data.new_password)
    
    await asyncio.to_thread(db.commit)
    
    # Считаем оставшиеся коды
    remaining_codes = await asyncio.to_thread(
        lambda: db.query(models.RecoveryCode).filter(
            models.RecoveryCode.user_id == user.id,
            models.RecoveryCode.used == False
        ).count()
    )
    
    return {
        "message": "Пароль успешно восстановлен",
        "remaining_codes": remaining_codes
    }

