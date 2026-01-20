"""
Эндпоинт: GET /api/dashboard/monthly-profit
Функция: get_monthly_profit
"""

from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from calendar import monthrange
from models import models
from models.database import get_db
from main import app
from services.auth import get_current_user
import asyncio


@app.get("/api/dashboard/monthly-profit")
async def get_monthly_profit(
    year: int = Query(..., ge=2020, le=2100, description="Год"),
    month: int = Query(..., ge=1, le=12, description="Месяц (1-12)"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить прибыль по дням за указанный месяц.
    
    Возвращает список дней с прибылью и количеством сделок.
    """
    from sqlalchemy import func
    
    # Определяем границы месяца
    first_day = date(year, month, 1)
    last_day_num = monthrange(year, month)[1]
    last_day = date(year, month, last_day_num)
    
    # Получаем все сервера пользователя
    user_servers = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.user_id == current_user.id
        ).all()
    )
    
    if not user_servers:
        return {
            "year": year,
            "month": month,
            "days": [],
            "total_profit": 0.0,
            "total_orders": 0
        }
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем закрытые ордера за месяц
    closed_orders = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.server_id.in_(server_ids),
            models.MoonBotOrder.status == "Closed",
            func.date(models.MoonBotOrder.closed_at) >= first_day,
            func.date(models.MoonBotOrder.closed_at) <= last_day
        ).all()
    )
    
    # Группируем по дням
    days_data = {}
    for order in closed_orders:
        if order.closed_at:
            day_key = order.closed_at.date()
            if day_key not in days_data:
                days_data[day_key] = {
                    "date": str(day_key),
                    "profit": 0.0,
                    "orders_count": 0
                }
            days_data[day_key]["profit"] += float(order.profit_btc or 0.0)
            days_data[day_key]["orders_count"] += 1
    
    # Формируем список всех дней месяца
    result_days = []
    current_date = first_day
    today = date.today()
    
    while current_date <= last_day:
        # Не показываем будущие дни
        if current_date <= today:
            day_str = str(current_date)
            if current_date in days_data:
                result_days.append({
                    "date": day_str,
                    "profit": round(days_data[current_date]["profit"], 2),
                    "orders_count": days_data[current_date]["orders_count"]
                })
            else:
                result_days.append({
                    "date": day_str,
                    "profit": 0.0,
                    "orders_count": 0
                })
        current_date = date(
            current_date.year,
            current_date.month,
            current_date.day + 1
        ) if current_date.day < last_day_num else date(year + 1 if month == 12 else year, 1 if month == 12 else month + 1, 1)
        
        # Защита от бесконечного цикла
        if current_date > last_day:
            break
    
    # Считаем общую прибыль
    total_profit = sum(d["profit"] for d in result_days)
    total_orders = sum(d["orders_count"] for d in result_days)
    
    return {
        "year": year,
        "month": month,
        "days": result_days,
        "total_profit": round(total_profit, 2),
        "total_orders": total_orders
    }



