from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from models.database import get_db
from services.auth import get_current_user
from models import models
from utils.datetime_utils import format_iso


router = APIRouter()


@router.get("/cache/{server_id}")
async def get_strategies_cache(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить кэшированные стратегии с сервера"""
    
    # Проверка доступа
    import asyncio
    server = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.id == server_id,
            models.Server.user_id == current_user.id
        ).first()
    )
    
    if not server:
        raise HTTPException(404, "Сервер не найден")
    
    # Получить все пакеты стратегий
    packs = await asyncio.to_thread(
        lambda: db.query(models.StrategyCache).filter(
            models.StrategyCache.server_id == server_id
        ).order_by(models.StrategyCache.pack_number).all()
    )
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "packs": [
            {
                "pack_number": pack.pack_number,
                "data": pack.data,
                "received_at": format_iso(pack.received_at)
            }
            for pack in packs
        ]
    }


@router.delete("/cache/{server_id}")
async def delete_strategies_cache(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Очистить кэш стратегий для сервера перед новым запросом"""
    
    # Проверка доступа
    import asyncio
    server = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.id == server_id,
            models.Server.user_id == current_user.id
        ).first()
    )
    
    if not server:
        raise HTTPException(404, "Сервер не найден")
    
    # Удаляем все пакеты для этого сервера
    deleted_count = await asyncio.to_thread(
        lambda: db.query(models.StrategyCache).filter(
            models.StrategyCache.server_id == server_id
        ).delete()
    )
    
    await asyncio.to_thread(db.commit)
    
    return {
        "success": True,
        "deleted_packs": deleted_count
    }

