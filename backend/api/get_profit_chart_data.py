"""
Эндпоинт: GET /api/servers/{server_id}/orders/profit-chart
Функция: get_profit_chart_data
"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from utils.datetime_utils import utcnow


@app.get("/api/servers/{server_id}/orders/profit-chart")
async def get_profit_chart_data(
    server_id: int,
    period: str = "day",  # day, week, month
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить данные для графика прибыли
    
    period: day (24 часа), week (7 дней), month (30 дней)
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta
    
    # Проверяем что сервер принадлежит пользователю
    server = await get_user_server(server_id, current_user, db)
    
    # Определяем период
    now = utcnow()
    if period == "day":
        start_date = now - timedelta(hours=24)
        time_format = "%H:00"  # По часам
    elif period == "week":
        start_date = now - timedelta(days=7)
        time_format = "%Y-%m-%d"  # По дням
    elif period == "month":
        start_date = now - timedelta(days=30)
        time_format = "%Y-%m-%d"  # По дням
    else:
        raise HTTPException(status_code=400, detail="Invalid period. Use: day, week, month")
    
    # Получаем закрытые ордера за период
    import asyncio
    closed_orders = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.server_id == server_id,
            models.MoonBotOrder.status == "Closed",
            models.MoonBotOrder.closed_at >= start_date
        ).order_by(models.MoonBotOrder.closed_at).all()
    )
    
    # Группируем по времени
    data_points = {}
    cumulative_profit = 0.0
    
    for order in closed_orders:
        if order.closed_at:
            time_key = order.closed_at.strftime(time_format)
            profit = float(order.profit_btc or 0.0)
            cumulative_profit += profit
            
            if time_key not in data_points:
                data_points[time_key] = {
                    "time": time_key,
                    "profit": 0.0,
                    "cumulative_profit": 0.0,
                    "orders_count": 0
                }
            
            data_points[time_key]["profit"] += profit
            data_points[time_key]["cumulative_profit"] = cumulative_profit
            data_points[time_key]["orders_count"] += 1
    
    # Преобразуем в список и сортируем
    chart_data = sorted(data_points.values(), key=lambda x: x["time"])
    
    # Если данных нет, возвращаем пустой массив
    if not chart_data:
        return {
            "server_id": server_id,
            "server_name": server.name,
            "period": period,
            "data": []
        }
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "period": period,
        "data": chart_data
    }