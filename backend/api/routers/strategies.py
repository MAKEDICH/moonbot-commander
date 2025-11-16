from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models


router = APIRouter()


@router.get("/cache/{server_id}")
async def get_strategies_cache(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить кэшированные стратегии с сервера"""
    
    # Проверка доступа
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(404, "Сервер не найден")
    
    # Получить все пакеты стратегий
    packs = db.query(models.StrategyCache).filter(
        models.StrategyCache.server_id == server_id
    ).order_by(models.StrategyCache.pack_number).all()
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "packs": [
            {
                "pack_number": pack.pack_number,
                "data": pack.data,
                "received_at": pack.received_at.isoformat() if pack.received_at else None
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
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(404, "Сервер не найден")
    
    # Удаляем все пакеты для этого сервера
    deleted_count = db.query(models.StrategyCache).filter(
        models.StrategyCache.server_id == server_id
    ).delete()
    
    db.commit()
    
    return {
        "success": True,
        "deleted_packs": deleted_count
    }

