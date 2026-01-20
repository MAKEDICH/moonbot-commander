"""
Эндпоинты для работы с двухфакторной аутентификацией (2FA)

Реализует настройку, включение/отключение и проверку TOTP кодов.
Включает защиту от brute-force атак.
"""
import asyncio
from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from core import limiter
from services import auth
from services.auth import get_current_user
from services import totp
from utils.datetime_utils import utcnow


@app.get("/api/auth/2fa/setup")
async def setup_2fa(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Генерация QR-кода для настройки Google Authenticator.
    
    Создаёт TOTP секрет для пользователя если его ещё нет,
    и генерирует QR-код для сканирования в приложении.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с секретом, QR-кодом (base64) и статусом 2FA
    """
    # Генерируем новый секрет если его нет
    if not current_user.totp_secret:
        current_user.totp_secret = totp.generate_totp_secret()
        await asyncio.to_thread(db.commit)
        await asyncio.to_thread(db.refresh, current_user)
    
    # Создаем provisioning URI
    uri: str = totp.get_totp_uri(current_user.username, current_user.totp_secret)
    
    # Генерируем QR-код
    qr_code: str = totp.generate_qr_code(uri)
    
    return {
        "secret": current_user.totp_secret,
        "qr_code": qr_code,
        "enabled": current_user.totp_enabled
    }


@app.post("/api/auth/2fa/enable")
async def enable_2fa(
    verify_data: schemas.TwoFactorVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Включение 2FA после проверки кода.
    
    Пользователь должен сначала настроить 2FA через /setup,
    затем подтвердить кодом из приложения.
    
    Args:
        verify_data: TOTP код для проверки
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с сообщением об успехе
        
    Raises:
        HTTPException: Если 2FA не настроен или код неверный
    """
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сначала настройте 2FA через /api/auth/2fa/setup"
        )
    
    # Проверяем код
    if not totp.verify_totp_code(current_user.totp_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код. Проверьте время на устройстве."
        )
    
    # Включаем 2FA
    current_user.totp_enabled = True
    await asyncio.to_thread(db.commit)
    
    return {"message": "2FA успешно включен"}


@app.post("/api/auth/2fa/disable")
async def disable_2fa(
    verify_data: schemas.TwoFactorVerify,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Отключение 2FA.
    
    Требует подтверждения кодом из приложения для безопасности.
    
    Args:
        verify_data: TOTP код для подтверждения
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с сообщением об успехе
        
    Raises:
        HTTPException: Если 2FA не включен или код неверный
    """
    if not current_user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA не включен"
        )
    
    # Проверяем код перед отключением
    if not totp.verify_totp_code(current_user.totp_secret, verify_data.code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный код"
        )
    
    # Отключаем 2FA
    current_user.totp_enabled = False
    await asyncio.to_thread(db.commit)
    
    return {"message": "2FA отключен"}


@app.post("/api/auth/2fa/verify")
@limiter.limit("10/minute")  # Rate limiting для 2FA
async def verify_2fa(
    request: Request,
    verify_data: schemas.TwoFactorVerify,
    username: str,
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Проверка 2FA кода при логине с защитой от brute-force.
    
    Реализует защиту:
    - Максимум 5 неудачных попыток за 15 минут
    - После 5 попыток блокировка на 15 минут
    
    Args:
        request: HTTP запрос (для получения IP и rate limiting)
        verify_data: TOTP код для проверки
        username: Имя пользователя
        db: Сессия базы данных
        
    Returns:
        Dict с JWT токеном при успешной проверке
        
    Raises:
        HTTPException: Если код неверный или превышен лимит попыток
    """
    user: Optional[models.User] = await asyncio.to_thread(
        lambda: db.query(models.User).filter(models.User.username == username).first()
    )
    
    if not user or not user.totp_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA не настроен"
        )
    
    # Проверка количества неудачных попыток за последние 15 минут
    fifteen_minutes_ago = utcnow() - timedelta(minutes=15)
    
    failed_attempts: int = await asyncio.to_thread(
        lambda: db.query(models.TwoFactorAttempt)
        .filter(
            models.TwoFactorAttempt.username == username,
            models.TwoFactorAttempt.success == False,
            models.TwoFactorAttempt.attempt_time >= fifteen_minutes_ago
        )
        .count()
    )
    
    if failed_attempts >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток. Попробуйте через 15 минут."
        )
    
    # Получаем IP адрес клиента
    client_ip: str = request.client.host if request.client else "unknown"
    
    # Проверяем 2FA код
    is_valid: bool = totp.verify_totp_code(user.totp_secret, verify_data.code)
    
    # Записываем попытку в БД
    attempt: models.TwoFactorAttempt = models.TwoFactorAttempt(
        username=username,
        success=is_valid,
        ip_address=client_ip
    )
    await asyncio.to_thread(db.add, attempt)
    await asyncio.to_thread(db.commit)
    
    if not is_valid:
        remaining_attempts: int = 5 - (failed_attempts + 1)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Неверный код. Осталось попыток: {remaining_attempts}"
        )
    
    # Успешная авторизация - очищаем старые попытки
    await asyncio.to_thread(
        lambda: db.query(models.TwoFactorAttempt)
        .filter(models.TwoFactorAttempt.username == username)
        .delete()
    )
    await asyncio.to_thread(db.commit)
    
    # Создаем токен
    access_token: str = auth.create_access_token(data={"sub": user.username})
    
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/api/auth/2fa/recover-password")
@limiter.limit("5/hour")  # Строгий rate limiting для восстановления пароля
async def recover_password_2fa(
    request: Request,
    recovery_data: schemas.TwoFactorRecovery,
    db: Session = Depends(get_db)
) -> Dict[str, str]:
    """
    Восстановление пароля через Google Authenticator код.
    
    Принимает username или email. Реализует защиту от brute-force:
    - Максимум 3 неудачных попытки за 15 минут
    - После 3 попыток блокировка на 15 минут
    
    Args:
        request: HTTP запрос (для получения IP и rate limiting)
        recovery_data: Данные для восстановления (username, totp_code, new_password)
        db: Сессия базы данных
        
    Returns:
        Dict с сообщением об успехе
        
    Raises:
        HTTPException: Если пользователь не найден, 2FA не настроен,
                      код неверный или превышен лимит попыток
    """
    # Находим пользователя по username или email
    user: Optional[models.User] = await asyncio.to_thread(
        lambda: db.query(models.User).filter(
            (models.User.username == recovery_data.username) | (models.User.email == recovery_data.username)
        ).first()
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный username или код"
        )
    
    # Проверяем что у пользователя включен 2FA
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У этого пользователя не настроен Google Authenticator"
        )
    
    # Проверка количества неудачных попыток (более строго чем для логина)
    fifteen_minutes_ago = utcnow() - timedelta(minutes=15)
    
    failed_attempts: int = await asyncio.to_thread(
        lambda: db.query(models.TwoFactorAttempt)
        .filter(
            models.TwoFactorAttempt.username == recovery_data.username,
            models.TwoFactorAttempt.success == False,
            models.TwoFactorAttempt.attempt_time >= fifteen_minutes_ago
        )
        .count()
    )
    
    if failed_attempts >= 3:  # Для восстановления пароля лимит строже: 3 попытки
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Слишком много неудачных попыток восстановления. Попробуйте через 15 минут."
        )
    
    # Получаем IP адрес клиента
    client_ip: str = request.client.host if request.client else "unknown"
    
    # Проверяем TOTP код
    is_valid: bool = totp.verify_totp_code(user.totp_secret, recovery_data.totp_code)
    
    # Записываем попытку
    attempt: models.TwoFactorAttempt = models.TwoFactorAttempt(
        username=recovery_data.username,
        success=is_valid,
        ip_address=client_ip
    )
    await asyncio.to_thread(db.add, attempt)
    await asyncio.to_thread(db.commit)
    
    if not is_valid:
        remaining_attempts: int = 3 - (failed_attempts + 1)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Неверный код. Осталось попыток: {remaining_attempts}"
        )
    
    # Успешная проверка - очищаем попытки
    await asyncio.to_thread(
        lambda: db.query(models.TwoFactorAttempt)
        .filter(models.TwoFactorAttempt.username == recovery_data.username)
        .delete()
    )
    await asyncio.to_thread(db.commit)
    
    # Обновляем пароль
    user.hashed_password = auth.get_password_hash(recovery_data.new_password)
    await asyncio.to_thread(db.commit)
    
    return {
        "message": "Пароль успешно восстановлен через Google Authenticator"
    }
