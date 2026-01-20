"""
API для системы обновлений MoonBot Commander

Эндпоинты:
- GET /api/updates/check - Проверить наличие обновлений
- GET /api/updates/versions - Получить список всех версий
- GET /api/updates/status - Получить статус обновления
- POST /api/updates/prepare - Подготовить обновление
- POST /api/updates/execute - Выполнить обновление
- POST /api/updates/rollback - Откатить обновление
- GET /api/updates/backups - Получить список бэкапов
- GET /api/updates/system-info - Информация о системе
"""

import os
import sys
import asyncio
import logging
from typing import Optional
from fastapi import Depends, Query, HTTPException, BackgroundTasks
from pydantic import BaseModel
from models import models
from main import app
from services.auth import get_current_user

# Добавляем путь для импорта
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.updates.update_manager import update_manager
from services.updates.safe_executor import safe_executor, UpdateStatus

logger = logging.getLogger(__name__)


class PrepareUpdateRequest(BaseModel):
    """Запрос на подготовку обновления"""
    target_version: str
    download_url: str


class RollbackRequest(BaseModel):
    """Запрос на откат обновления"""
    backup_path: str


@app.get("/api/updates/check")
async def check_updates(
    force: bool = Query(False, description="Принудительная проверка, игнорируя кэш"),
    current_user: models.User = Depends(get_current_user)
):
    """
    Проверить наличие обновлений.
    
    Возвращает информацию о доступных обновлениях, включая:
    - Текущую и последнюю версии
    - Список промежуточных версий
    - Информацию о необходимости миграций
    """
    try:
        result = await update_manager.check_for_updates(force=force)
        return result
    except Exception as e:
        logger.error(f"Ошибка проверки обновлений: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/updates/versions")
async def get_available_versions(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить список всех доступных версий.
    
    Возвращает полный список релизов с GitHub для выбора версии.
    """
    try:
        versions = await update_manager.get_available_versions()
        return {
            "current_version": update_manager.current_version,
            "versions": versions
        }
    except Exception as e:
        logger.error(f"Ошибка получения версий: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Ошибка получения версий: {str(e)}")


@app.get("/api/updates/status")
async def get_update_status(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить текущий статус обновления.
    
    Возвращает:
    - status: текущий статус (idle, downloading, preparing, etc.)
    - progress: прогресс в процентах
    - message: сообщение о текущем действии
    """
    return safe_executor.status


@app.post("/api/updates/prepare")
async def prepare_update(
    request: PrepareUpdateRequest,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user)
):
    """
    Подготовить обновление.
    
    Скачивает новую версию, распаковывает, создаёт бэкап.
    После успешной подготовки можно вызвать /api/updates/execute
    """
    try:
        # Проверяем что не идёт другое обновление
        current_status = safe_executor.status
        if current_status["status"] not in [UpdateStatus.IDLE, UpdateStatus.FAILED, UpdateStatus.ROLLED_BACK]:
            raise HTTPException(
                status_code=400, 
                detail=f"Обновление уже выполняется: {current_status['status']}"
            )
        
        # Запускаем подготовку
        success, message = await safe_executor.prepare_update(
            target_version=request.target_version,
            download_url=request.download_url
        )
        
        if success:
            return {
                "success": True,
                "message": message,
                "status": safe_executor.status
            }
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка подготовки обновления: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/updates/execute")
async def execute_update(
    current_user: models.User = Depends(get_current_user)
):
    """
    Выполнить обновление.
    
    ВАЖНО: После вызова этого эндпоинта приложение будет остановлено
    и перезапущено с новой версией.
    
    Перед вызовом необходимо выполнить /api/updates/prepare
    """
    try:
        # Проверяем что подготовка выполнена
        current_status = safe_executor.status
        if current_status["status"] != UpdateStatus.READY_TO_UPDATE:
            raise HTTPException(
                status_code=400,
                detail=f"Обновление не подготовлено. Текущий статус: {current_status['status']}"
            )
        
        # Запускаем обновление
        success, message = await safe_executor.execute_update()
        
        if success:
            # Планируем остановку приложения через 2 секунды
            asyncio.create_task(_shutdown_application())
            
            return {
                "success": True,
                "message": message,
                "action": "Приложение будет перезапущено через несколько секунд"
            }
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка выполнения обновления: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _shutdown_application():
    """Корректно завершить приложение для обновления"""
    await asyncio.sleep(2)
    
    logger.info("🔄 Завершение приложения для обновления...")
    
    # Отправляем сигнал завершения
    import signal
    os.kill(os.getpid(), signal.SIGTERM)


@app.post("/api/updates/rollback")
async def rollback_update(
    request: RollbackRequest,
    current_user: models.User = Depends(get_current_user)
):
    """
    Откатить обновление из бэкапа.
    
    Восстанавливает БД и конфигурацию из указанного бэкапа.
    После отката необходимо перезапустить приложение.
    """
    try:
        success, message = await safe_executor.rollback_update(request.backup_path)
        
        if success:
            return {
                "success": True,
                "message": message,
                "action": "Перезапустите приложение для применения отката"
            }
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка отката: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/updates/backups")
async def get_backups(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить список доступных бэкапов для отката.
    
    Возвращает список бэкапов, созданных перед обновлениями.
    """
    try:
        backups = safe_executor.get_available_backups()
        return {
            "backups": backups,
            "count": len(backups)
        }
    except Exception as e:
        logger.error(f"Ошибка получения бэкапов: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/updates/system-info")
async def get_system_info(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получить информацию о системе.
    
    Возвращает информацию для диагностики:
    - ОС и версия
    - Версия Python
    - Текущая версия приложения
    - Пути к директориям
    """
    try:
        return update_manager.get_system_info()
    except Exception as e:
        logger.error(f"Ошибка получения информации о системе: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/updates/cleanup-backups")
async def cleanup_old_backups(
    keep_count: int = Query(5, description="Сколько последних бэкапов оставить"),
    current_user: models.User = Depends(get_current_user)
):
    """
    Удалить старые бэкапы.
    
    Оставляет только последние N бэкапов, удаляя остальные.
    """
    try:
        safe_executor.cleanup_old_backups(keep_count=keep_count)
        
        return {
            "success": True,
            "message": f"Старые бэкапы удалены, оставлено {keep_count}"
        }
    except Exception as e:
        logger.error(f"Ошибка очистки бэкапов: {e}")
        raise HTTPException(status_code=500, detail=str(e))

