from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from services.auth import get_current_user
from models import models
from api.services import cleanup_service
from pydantic import BaseModel
from utils.datetime_utils import format_iso


router = APIRouter()


class CleanupSettingsSchema(BaseModel):
    enabled: bool = False
    trigger_type: str = "time"
    days_to_keep: int = 30
    disk_threshold_percent: int = 80
    auto_cleanup_sql_logs: bool = True
    auto_cleanup_command_history: bool = True
    auto_cleanup_backend_logs: bool = False
    backend_logs_max_size_mb: int = 10


class CleanupActionSchema(BaseModel):
    days: int = 30


class BackendLogsCleanupSchema(BaseModel):
    max_size_mb: int = 0  # 0 = удалить полностью


@router.get("/stats")
async def get_cleanup_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить статистику размера БД и количества записей"""
    import asyncio
    stats = await asyncio.to_thread(cleanup_service.get_database_stats, current_user.id, db)
    return stats


@router.get("/settings")
async def get_cleanup_settings(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить настройки автоочистки"""
    import asyncio
    settings = await asyncio.to_thread(
        lambda: db.query(models.CleanupSettings).filter(
            models.CleanupSettings.user_id == current_user.id
        ).first()
    )
    
    if not settings:
        # Создать настройки по умолчанию
        settings = models.CleanupSettings(user_id=current_user.id)
        await asyncio.to_thread(db.add, settings)
        await asyncio.to_thread(db.commit)
        await asyncio.to_thread(db.refresh, settings)
    
    return {
        'enabled': settings.enabled,
        'trigger_type': settings.trigger_type,
        'days_to_keep': settings.days_to_keep,
        'disk_threshold_percent': settings.disk_threshold_percent,
        'auto_cleanup_sql_logs': settings.auto_cleanup_sql_logs,
        'auto_cleanup_command_history': settings.auto_cleanup_command_history,
        'auto_cleanup_backend_logs': settings.auto_cleanup_backend_logs,
        'backend_logs_max_size_mb': settings.backend_logs_max_size_mb,
        'last_cleanup': format_iso(settings.last_cleanup)
    }


@router.post("/settings")
async def save_cleanup_settings(
    settings_data: CleanupSettingsSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Сохранить настройки автоочистки"""
    import asyncio
    settings = await asyncio.to_thread(
        lambda: db.query(models.CleanupSettings).filter(
            models.CleanupSettings.user_id == current_user.id
        ).first()
    )
    
    if not settings:
        settings = models.CleanupSettings(user_id=current_user.id)
        await asyncio.to_thread(db.add, settings)
    
    settings.enabled = settings_data.enabled
    settings.trigger_type = settings_data.trigger_type
    settings.days_to_keep = settings_data.days_to_keep
    settings.disk_threshold_percent = settings_data.disk_threshold_percent
    settings.auto_cleanup_sql_logs = settings_data.auto_cleanup_sql_logs
    settings.auto_cleanup_command_history = settings_data.auto_cleanup_command_history
    settings.auto_cleanup_backend_logs = settings_data.auto_cleanup_backend_logs
    settings.backend_logs_max_size_mb = settings_data.backend_logs_max_size_mb
    
    await asyncio.to_thread(db.commit)
    
    return {'status': 'success', 'message': 'Настройки сохранены'}


@router.post("/logs")
async def cleanup_logs(
    action_data: CleanupActionSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить старые логи"""
    import asyncio
    result = await asyncio.to_thread(cleanup_service.cleanup_old_logs, current_user.id, action_data.days, db)
    return result


@router.get("/logs")
async def get_logs_info(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о логах (заглушка для prefetch)"""
    return {"status": "ok", "message": "Use POST method to cleanup logs"}


@router.post("/history")
async def cleanup_history(
    action_data: CleanupActionSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить старую историю команд"""
    import asyncio
    result = await asyncio.to_thread(cleanup_service.cleanup_command_history, current_user.id, action_data.days, db)
    return result


@router.post("/vacuum")
async def vacuum_db(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Оптимизировать базу данных"""
    import asyncio
    result = await asyncio.to_thread(cleanup_service.vacuum_database, db)
    return result


@router.post("/backend-logs")
async def cleanup_backend_logs(
    action_data: BackendLogsCleanupSchema,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить логи backend"""
    import asyncio
    result = await asyncio.to_thread(cleanup_service.cleanup_backend_logs, action_data.max_size_mb)
    return result


@router.post("/full")
async def full_cleanup(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Полная очистка (удаляет всё кроме пользовательских данных)"""
    import asyncio
    result = await asyncio.to_thread(cleanup_service.full_cleanup, current_user.id, db)
    return result

