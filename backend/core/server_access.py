"""
Утилиты для проверки доступа к серверам
Устраняет дублирование логики проверки прав доступа
"""

from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from models import models
from models.database import get_db
from services.auth import get_current_user


async def get_user_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.Server:
    """
    Получить сервер и проверить доступ пользователя к нему
    
    Args:
        server_id: ID сервера
        current_user: Текущий пользователь
        db: Сессия БД
    
    Returns:
        Объект сервера
    
    Raises:
        HTTPException: Если сервер не найден или доступ запрещён
    """
    import asyncio
    
    server = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(models.Server.id == server_id).first()
    )
    
    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")
    
    if server.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому серверу")
    
    return server


async def check_server_access(
    server_id: int,
    user_id: int,
    db: Session
) -> bool:
    """
    Проверить доступ пользователя к серверу
    
    Args:
        server_id: ID сервера
        user_id: ID пользователя
        db: Сессия БД
    
    Returns:
        True если доступ разрешён, False иначе
    """
    import asyncio
    
    server = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.id == server_id,
            models.Server.user_id == user_id
        ).first()
    )
    
    return server is not None


async def get_user_servers(
    current_user: models.User,
    db: Session,
    emulator_only: Optional[bool] = None
) -> list[models.Server]:
    """
    Получить список серверов пользователя
    
    Args:
        current_user: Текущий пользователь
        db: Сессия БД
        emulator_only: Фильтр по типу (True - только эмуляторы, False - только реальные, None - все)
    
    Returns:
        Список серверов пользователя
    """
    import asyncio
    
    def _get_servers():
        query = db.query(models.Server).filter(models.Server.user_id == current_user.id)
        
        if emulator_only is not None:
            query = query.filter(models.Server.is_emulator == emulator_only)
        
        return query.all()
    
    return await asyncio.to_thread(_get_servers)


async def validate_server_ownership(
    server_ids: list[int],
    user_id: int,
    db: Session
) -> tuple[bool, Optional[str]]:
    """
    Проверить что все серверы принадлежат пользователю
    
    Args:
        server_ids: Список ID серверов
        user_id: ID пользователя
        db: Сессия БД
    
    Returns:
        Кортеж (валидность, сообщение об ошибке)
    """
    import asyncio
    
    def _validate():
        servers = db.query(models.Server).filter(
            models.Server.id.in_(server_ids)
        ).all()
        
        if len(servers) != len(server_ids):
            found_ids = {s.id for s in servers}
            missing_ids = set(server_ids) - found_ids
            return False, f"Серверы не найдены: {missing_ids}"
        
        for server in servers:
            if server.user_id != user_id:
                return False, f"Нет доступа к серверу ID {server.id}"
        
        return True, None
    
    return await asyncio.to_thread(_validate)





