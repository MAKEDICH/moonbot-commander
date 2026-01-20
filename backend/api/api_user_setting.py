"""
Эндпоинты для работы с настройками пользователя

Управление персональными настройками: интервал пинга, уведомления, логирование и т.д.
"""
import asyncio
import logging
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from models import models
from models import schemas
from models.database import get_db, SessionLocal
from main import app
from services.auth import get_current_user
from utils.logging import log


def apply_log_level(level: int) -> None:
    """
    Применить уровень логирования к backend.
    
    Args:
        level: Уровень логирования (1-3)
            1 - Только критические (WARNING+)
            2 - Неполное логирование (INFO+)
            3 - Полное логирование (DEBUG+)
    """
    root_logger = logging.getLogger()
    
    if level == 1:
        # Только критические события
        root_logger.setLevel(logging.WARNING)
        log_level_name = "WARNING (только критические)"
    elif level == 2:
        # Неполное логирование
        root_logger.setLevel(logging.INFO)
        log_level_name = "INFO (стандартное)"
    else:
        # Полное логирование
        root_logger.setLevel(logging.DEBUG)
        log_level_name = "DEBUG (полное)"
    
    # Обновляем уровень для всех handlers
    for handler in root_logger.handlers:
        if level == 1:
            handler.setLevel(logging.WARNING)
        elif level == 2:
            handler.setLevel(logging.INFO)
        else:
            handler.setLevel(logging.DEBUG)
    
    log(f"[SETTINGS] Уровень логирования изменён на: {log_level_name}")


def init_log_level_from_db() -> None:
    """
    Загрузить и применить уровень логирования из БД при старте приложения.
    
    Берёт настройки первого пользователя (обычно единственного).
    Если настроек нет - использует уровень 2 (INFO).
    """
    try:
        db = SessionLocal()
        try:
            # Берём настройки любого пользователя (для однопользовательской системы)
            settings = db.query(models.UserSettings).first()
            
            if settings and settings.backend_log_level:
                apply_log_level(settings.backend_log_level)
                log(f"[STARTUP] Загружен уровень логирования из БД: {settings.backend_log_level}")
            else:
                # По умолчанию - стандартное логирование
                apply_log_level(2)
                log("[STARTUP] Используется уровень логирования по умолчанию: 2 (INFO)")
        finally:
            db.close()
    except Exception as e:
        log(f"[STARTUP] Ошибка загрузки уровня логирования: {e}", level="WARNING")
        # При ошибке используем стандартный уровень
        apply_log_level(2)


# Применяем уровень логирования при импорте модуля
init_log_level_from_db()


@app.get("/api/user/settings", response_model=schemas.UserSettings)
async def get_user_settings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.UserSettings:
    """
    Получение настроек пользователя.
    
    Если настройки ещё не созданы, создаёт их с дефолтными значениями.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        UserSettings: Настройки пользователя
    """
    settings: Optional[models.UserSettings] = await asyncio.to_thread(
        lambda: db.query(models.UserSettings).filter(
            models.UserSettings.user_id == current_user.id
        ).first()
    )
    
    # Если настроек нет - создаем с дефолтными значениями
    if not settings:
        settings = models.UserSettings(
            user_id=current_user.id,
            ping_interval=30,
            enable_notifications=True,
            notification_sound=True,
            backend_log_level=2  # По умолчанию - неполное логирование
        )
        await asyncio.to_thread(db.add, settings)
        await asyncio.to_thread(db.commit)
        await asyncio.to_thread(db.refresh, settings)
    
    return settings


@app.put("/api/user/settings", response_model=schemas.UserSettings)
async def update_user_settings(
    settings_update: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.UserSettings:
    """
    Обновление настроек пользователя.
    
    Валидирует входные данные и обновляет только переданные поля.
    
    Args:
        settings_update: Новые значения настроек (частичное обновление)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        UserSettings: Обновлённые настройки
        
    Raises:
        HTTPException: Если ping_interval выходит за допустимые границы
    """
    settings: Optional[models.UserSettings] = await asyncio.to_thread(
        lambda: db.query(models.UserSettings).filter(
            models.UserSettings.user_id == current_user.id
        ).first()
    )
    
    if not settings:
        settings = models.UserSettings(user_id=current_user.id)
        await asyncio.to_thread(db.add, settings)
    
    # Обновляем только переданные поля
    if settings_update.ping_interval is not None:
        # Валидация ping_interval на уровне API (защита от обхода frontend)
        if settings_update.ping_interval < 5 or settings_update.ping_interval > 3600:
            raise HTTPException(
                status_code=400,
                detail="ping_interval must be between 5 and 3600 seconds"
            )
        settings.ping_interval = settings_update.ping_interval
    if settings_update.enable_notifications is not None:
        settings.enable_notifications = settings_update.enable_notifications
    if settings_update.notification_sound is not None:
        settings.notification_sound = settings_update.notification_sound
    if settings_update.backend_log_level is not None:
        # Валидация уровня логирования
        if settings_update.backend_log_level < 1 or settings_update.backend_log_level > 3:
            raise HTTPException(
                status_code=400,
                detail="backend_log_level must be between 1 and 3"
            )
        settings.backend_log_level = settings_update.backend_log_level
        # Применяем новый уровень логирования сразу
        apply_log_level(settings_update.backend_log_level)
    
    # onupdate в модели автоматически обновит updated_at
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, settings)
    
    return settings
