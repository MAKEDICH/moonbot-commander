"""
Эндпоинт: GET /api/dashboard/stats
Функция: get_dashboard_stats
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


@app.get("/api/dashboard/stats", response_model=schemas.DashboardStats)
async def get_dashboard_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики для дашборда"""
    from sqlalchemy import func, and_
    import asyncio
    
    # Общее количество серверов
    total_servers = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.user_id == current_user.id
        ).count()
    )
    
    # Онлайн/оффлайн серверы
    online_servers = await asyncio.to_thread(
        lambda: db.query(models.ServerStatus).join(models.Server).filter(
            models.Server.user_id == current_user.id,
            models.ServerStatus.is_online == True
        ).count()
    )
    
    offline_servers = total_servers - online_servers
    
    # Команды за сегодня (используем ЛОКАЛЬНОЕ время сервера!)
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    
    commands_today = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory).filter(
            models.CommandHistory.user_id == current_user.id,
            models.CommandHistory.execution_time >= today_start
        ).all()
    )
    
    total_commands_today = len(commands_today)
    successful_commands_today = len([c for c in commands_today if c.status == "success"])
    failed_commands_today = total_commands_today - successful_commands_today
    
    # Общее количество команд
    total_commands_all_time = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory).filter(
            models.CommandHistory.user_id == current_user.id
        ).count()
    )
    
    # Среднее время отклика
    avg_response = await asyncio.to_thread(
        lambda: db.query(func.avg(models.ServerStatus.response_time)).join(models.Server).filter(
            models.Server.user_id == current_user.id,
            models.ServerStatus.response_time.isnot(None)
        ).scalar()
    )
    
    return {
        "total_servers": total_servers,
        "online_servers": online_servers,
        "offline_servers": offline_servers,
        "total_commands_today": total_commands_today,
        "successful_commands_today": successful_commands_today,
        "failed_commands_today": failed_commands_today,
        "avg_response_time": float(avg_response) if avg_response else None,
        "total_commands_all_time": total_commands_all_time
    }