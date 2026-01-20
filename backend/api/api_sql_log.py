"""
Эндпоинты для работы с SQL логами

Логи SQL команд от MoonBot через UDP Listener.
"""
import asyncio
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from services import encryption
from services import udp
from utils.logging import log


@app.get("/api/servers/{server_id}/sql-log")
async def get_sql_log(
    server_id: int,
    limit: int = 100,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить лог SQL команд от сервера.
    
    Автоматически запускает UDP listener если он не запущен.
    
    Args:
        server_id: ID сервера
        limit: Количество записей (max 500)
        offset: Смещение для пагинации
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с логами SQL команд и метаданными пагинации
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # АВТОСТАРТ LISTENER: Проверяем что listener запущен, если нет - запускаем
    if server.is_active and server_id not in udp.active_listeners:
        log(f"[AUTO-START] Listener not running for server {server_id}, starting...")
        try:
            password: Optional[str] = None
            if server.password:
                password = encryption.decrypt_password(server.password)
            
            success: bool = udp.start_listener(
                server_id=server.id,
                host=server.host,
                port=server.port,
                password=password
            )
            
            if success:
                log(f"[AUTO-START] OK: Listener started for server {server_id}")
            else:
                log(f"[AUTO-START] FAIL: Could not start listener for server {server_id}")
        except Exception as e:
            log(f"[AUTO-START] Error starting listener for server {server_id}: {e}")
    
    # Ограничение на limit
    if limit > 500:
        limit = 500
    
    # Получаем записи
    logs: List[models.SQLCommandLog] = await asyncio.to_thread(
        lambda: db.query(models.SQLCommandLog).filter(
            models.SQLCommandLog.server_id == server_id
        ).order_by(
            models.SQLCommandLog.received_at.desc()
        ).offset(offset).limit(limit).all()
    )
    
    # Считаем общее количество
    total: int = await asyncio.to_thread(
        lambda: db.query(models.SQLCommandLog).filter(
            models.SQLCommandLog.server_id == server_id
        ).count()
    )
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "total": total,
        "offset": offset,
        "limit": limit,
        "logs": [
            {
                "id": log_entry.id,
                "command_id": log_entry.command_id,
                "sql_text": log_entry.sql_text,
                "received_at": log_entry.received_at,
                "processed": log_entry.processed
            }
            for log_entry in logs
        ]
    }


@app.delete("/api/servers/{server_id}/sql-log/clear")
async def clear_sql_logs(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Очистить все SQL логи для сервера.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с количеством удалённых записей
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Удаляем все логи
    deleted_count: int = await asyncio.to_thread(
        lambda: db.query(models.SQLCommandLog).filter(
            models.SQLCommandLog.server_id == server_id
        ).delete()
    )
    
    await asyncio.to_thread(db.commit)
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} записей SQL логов",
        "server_id": server_id,
        "deleted_count": deleted_count
    }


@app.delete("/api/sql-log/clear-all")
async def clear_all_sql_logs(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Очистить все SQL логи для ВСЕХ серверов пользователя.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с количеством удалённых записей и серверов
    """
    # Получаем все серверы пользователя
    user_server_ids = await asyncio.to_thread(
        lambda: db.query(models.Server.id).filter(
            models.Server.user_id == current_user.id
        ).all()
    )
    server_ids: List[int] = [sid[0] for sid in user_server_ids]
    
    # Удаляем все логи для этих серверов
    deleted_count: int = await asyncio.to_thread(
        lambda: db.query(models.SQLCommandLog).filter(
            models.SQLCommandLog.server_id.in_(server_ids)
        ).delete(synchronize_session=False)
    )
    
    await asyncio.to_thread(db.commit)
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} записей SQL логов со всех серверов",
        "deleted_count": deleted_count,
        "servers_count": len(server_ids)
    }
