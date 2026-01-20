"""
Эндпоинты для работы с настройками scheduler

Управление параметрами планировщика задач.
"""
import asyncio
from fastapi import Depends
from sqlalchemy.orm import Session
from typing import Optional
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from utils.logging import log
from services import scheduler as scheduler_module


@app.get("/api/scheduler/settings", response_model=schemas.SchedulerSettings)
async def get_scheduler_settings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.SchedulerSettings:
    """
    Получение текущих настроек scheduler.
    
    Возвращает настройки планировщика, создавая их с дефолтными
    значениями если они ещё не существуют.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        SchedulerSettings: Настройки планировщика с текущим статусом
    """
    settings: Optional[models.SchedulerSettings] = await asyncio.to_thread(
        lambda: db.query(models.SchedulerSettings).first()
    )
    
    if not settings:
        # Создаем настройки по умолчанию
        settings = models.SchedulerSettings(check_interval=5)
        await asyncio.to_thread(db.add, settings)
        await asyncio.to_thread(db.commit)
        await asyncio.to_thread(db.refresh, settings)
    
    # Добавляем статус enabled из файла
    settings.enabled = await asyncio.to_thread(scheduler_module.is_scheduler_enabled)
    
    return settings


@app.put("/api/scheduler/settings", response_model=schemas.SchedulerSettings)
async def update_scheduler_settings(
    settings_data: schemas.SchedulerSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.SchedulerSettings:
    """
    Обновление настроек scheduler.
    
    Обновляет интервал проверки и/или статус планировщика.
    
    Args:
        settings_data: Новые значения настроек
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        SchedulerSettings: Обновлённые настройки планировщика
    """
    settings: Optional[models.SchedulerSettings] = await asyncio.to_thread(
        lambda: db.query(models.SchedulerSettings).first()
    )
    
    if not settings:
        settings = models.SchedulerSettings()
        await asyncio.to_thread(db.add, settings)
    
    # Обновляем только check_interval в БД
    if settings_data.check_interval is not None:
        settings.check_interval = settings_data.check_interval
        # onupdate в модели автоматически обновит updated_at
        await asyncio.to_thread(db.commit)
        await asyncio.to_thread(db.refresh, settings)
    
    # Обновляем статус enabled в файле (не в БД)
    if settings_data.enabled is not None:
        await asyncio.to_thread(scheduler_module.set_scheduler_enabled, settings_data.enabled)
        log(f"[API] Scheduler {'enabled' if settings_data.enabled else 'disabled'} by user")
    
    # Добавляем статус enabled в ответ (из файла)
    settings.enabled = await asyncio.to_thread(scheduler_module.is_scheduler_enabled)
    
    return settings
