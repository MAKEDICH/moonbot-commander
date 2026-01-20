"""
Эндпоинт: GET /api/dashboard/commands-daily
Функция: get_commands_daily_stats
"""

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user


@app.get("/api/dashboard/commands-daily", response_model=List[schemas.CommandStatsDaily])
async def get_commands_daily_stats(
    days: int = 7,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение статистики команд по дням"""
    from datetime import timedelta, date
    from sqlalchemy import func, case
    import asyncio
    
    # Валидация days для защиты от DoS
    if days < 1 or days > 365:
        raise HTTPException(
            status_code=400,
            detail="Days parameter must be between 1 and 365"
        )
    
    # Используем ЛОКАЛЬНОЕ время сервера!
    start_date = datetime.now() - timedelta(days=days)
    
    # Группировка в SQL для оптимизации (избегаем OOM при большом количестве данных)
    
    results = await asyncio.to_thread(
        lambda: db.query(
            func.date(models.CommandHistory.execution_time).label('date'),
            func.count(models.CommandHistory.id).label('total'),
            func.sum(
                case(
                    (models.CommandHistory.status == 'success', 1),
                    else_=0
                )
            ).label('successful'),
            func.sum(
                case(
                    (models.CommandHistory.status != 'success', 1),
                    else_=0
                )
            ).label('failed')
        ).filter(
            models.CommandHistory.user_id == current_user.id,
            models.CommandHistory.execution_time >= start_date
        ).group_by(
            func.date(models.CommandHistory.execution_time)
        ).order_by(
            func.date(models.CommandHistory.execution_time)
        ).all()
    )
    
    # Создаем словарь с результатами из БД
    results_dict = {}
    for row in results:
        results_dict[str(row.date)] = {
            "date": str(row.date),
            "count": row.total,
            "successful": row.successful or 0,
            "failed": row.failed or 0
        }
    
    # Заполняем все дни периода (включая дни без команд)
    result = []
    today = date.today()
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        day_str = str(day)
        if day_str in results_dict:
            result.append(results_dict[day_str])
        else:
            result.append({
                "date": day_str,
                "count": 0,
                "successful": 0,
                "failed": 0
            })
    
    return result