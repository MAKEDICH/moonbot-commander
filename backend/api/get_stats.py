"""
Эндпоинт: GET /api/stats
Функция: get_stats
"""

from fastapi import Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user


@app.get("/api/stats", response_model=schemas.ServerStats)
async def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики"""
    import asyncio
    
    total_servers = await asyncio.to_thread(
        lambda: db.query(models.Server)
            .filter(models.Server.user_id == current_user.id).count()
    )
    
    active_servers = await asyncio.to_thread(
        lambda: db.query(models.Server)
            .filter(models.Server.user_id == current_user.id, models.Server.is_active == True).count()
    )
    
    total_commands = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory)
            .filter(models.CommandHistory.user_id == current_user.id).count()
    )
    
    successful_commands = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory)
            .filter(models.CommandHistory.user_id == current_user.id, models.CommandHistory.status == "success").count()
    )
    
    failed_commands = total_commands - successful_commands
    
    return schemas.ServerStats(
        total_servers=total_servers,
        active_servers=active_servers,
        total_commands=total_commands,
        successful_commands=successful_commands,
        failed_commands=failed_commands
    )