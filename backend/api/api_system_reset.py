"""
Эндпоинт: POST /api/system/reset

Полный сброс системы - удаление всех данных.
Критическая операция, требует специальный код доступа.
"""
import asyncio
import os
import traceback
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services import udp
from utils.config_loader import get_config_value
from utils.logging import log


@app.post("/api/system/reset")
async def api_system_reset(
    reset_data: schemas.SystemResetRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Полный сброс системы - удаление всех данных.
    
    Критическая операция! Удаляет ВСЕ данные из базы:
    - Всех пользователей
    - Все серверы
    - Все ордера и логи
    - Все настройки
    
    Требует специальный код доступа из конфигурации.
    
    Args:
        reset_data: Код доступа для сброса
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом операции
        
    Raises:
        HTTPException: Если код неверный или произошла ошибка
    """
    # Загружаем код доступа из конфигурации
    reset_code_env: str = get_config_value('security', 'security.system_reset.code_env', default='SYSTEM_RESET_CODE')
    default_reset_code: str = get_config_value('security', 'security.system_reset.default_code', default='aezakmi')
    system_reset_code: str = os.getenv(reset_code_env, default_reset_code)
    
    if reset_data.code.lower() != system_reset_code.lower():
        raise HTTPException(status_code=403, detail="Неверный код доступа")
    
    try:
        log("[SYSTEM RESET] WARNING: Starting complete system wipe...", level="WARNING")
        log(f"[SYSTEM RESET] Initiated by user: {current_user.username}")
        
        # Удаляем все данные из всех таблиц (в правильном порядке из-за foreign keys)
        await asyncio.to_thread(lambda: db.query(models.CommandHistory).delete())
        await asyncio.to_thread(lambda: db.query(models.ScheduledCommandServer).delete())
        await asyncio.to_thread(lambda: db.query(models.ScheduledCommand).delete())
        await asyncio.to_thread(lambda: db.query(models.CommandPreset).delete())
        await asyncio.to_thread(lambda: db.query(models.QuickCommand).delete())
        await asyncio.to_thread(lambda: db.query(models.MoonBotOrder).delete())
        await asyncio.to_thread(lambda: db.query(models.SQLCommandLog).delete())
        await asyncio.to_thread(lambda: db.query(models.UDPListenerStatus).delete())
        await asyncio.to_thread(lambda: db.query(models.ServerStatus).delete())
        await asyncio.to_thread(lambda: db.query(models.Server).delete())
        await asyncio.to_thread(lambda: db.query(models.TwoFactorAttempt).delete())
        await asyncio.to_thread(lambda: db.query(models.RecoveryCode).delete())
        await asyncio.to_thread(lambda: db.query(models.UserSettings).delete())
        await asyncio.to_thread(lambda: db.query(models.User).delete())
        await asyncio.to_thread(lambda: db.query(models.SchedulerSettings).delete())
        await asyncio.to_thread(lambda: db.query(models.CommandImage).delete())
        await asyncio.to_thread(lambda: db.query(models.CleanupSettings).delete())
        await asyncio.to_thread(lambda: db.query(models.ServerBalance).delete())
        await asyncio.to_thread(lambda: db.query(models.StrategyCache).delete())
        
        await asyncio.to_thread(db.commit)
        
        log("[SYSTEM RESET] OK: All database tables wiped")
        
        # Останавливаем все UDP listeners
        try:
            for listener in udp.active_listeners.values():
                if listener.running:
                    listener.stop()
            udp.active_listeners.clear()
            log("[SYSTEM RESET] OK: All UDP listeners stopped")
        except Exception as e:
            log(f"[SYSTEM RESET] WARNING: Could not stop UDP listeners: {e}", level="WARNING")
        
        log("[SYSTEM RESET] OK: System reset completed successfully")
        return {
            "success": True,
            "message": "Система успешно сброшена. Все данные удалены."
        }
        
    except Exception as e:
        log(f"[SYSTEM RESET] ERROR: {str(e)}", level="ERROR")
        traceback.print_exc()
        await asyncio.to_thread(db.rollback)
        raise HTTPException(status_code=500, detail=f"Ошибка при сбросе системы: {str(e)}")
