"""
Эндпоинт: GET /api/profit-chart-all
Функция: get_profit_chart_all_servers
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


@app.get("/api/profit-chart-all")
async def get_profit_chart_all_servers(
    period: str = "day",  # day, week, month
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить агрегированные данные графика прибыли со всех серверов пользователя
    
    period: day (24 часа), week (7 дней), month (30 дней)
    """
    from sqlalchemy import func
    
    # Используем ЛОКАЛЬНОЕ время сервера!
    now = datetime.now()
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
    
    # Получаем все сервера пользователя
    import asyncio
    user_servers = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.user_id == current_user.id
        ).all()
    )
    
    if not user_servers:
        return {
            "period": period,
            "data": []
        }
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем закрытые ордера за период со всех серверов
    closed_orders = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.server_id.in_(server_ids),
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
    
    return {
        "period": period,
        "data": chart_data
    }