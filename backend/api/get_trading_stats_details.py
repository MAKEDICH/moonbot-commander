"""
Эндпоинт: GET /api/trading-stats/details/{entity_type}/{entity_value}
Функция: get_trading_stats_details
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
from utils.datetime_utils import format_iso


@app.get("/api/trading-stats/details/{entity_type}/{entity_value}")
async def get_trading_stats_details(
    entity_type: str,  # "strategy", "server", "symbol"
    entity_value: str,  # название стратегии/сервера/символа
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить детальную информацию о конкретной стратегии/боте/монете
    - График прибыли по времени
    - Список сделок
    - Распределение по символам (для стратегии)
    """
    from sqlalchemy import func
    from datetime import datetime, timedelta
    import asyncio
    
    # Базовый запрос
    base_query = db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed"
    )
    
    # Фильтр по типу сущности
    if entity_type == "strategy":
        base_query = base_query.filter(models.MoonBotOrder.strategy == entity_value)
    elif entity_type == "server":
        # entity_value - это server_name
        base_query = base_query.filter(models.Server.name == entity_value)
    elif entity_type == "symbol":
        base_query = base_query.filter(models.MoonBotOrder.symbol == entity_value)
    else:
        raise HTTPException(status_code=400, detail="Неверный entity_type")
    
    # График прибыли по времени
    profit_by_date = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.count(models.MoonBotOrder.id).label('count')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    if entity_type == "strategy":
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.strategy == entity_value)
    elif entity_type == "server":
        profit_by_date = profit_by_date.filter(models.Server.name == entity_value)
    elif entity_type == "symbol":
        profit_by_date = profit_by_date.filter(models.MoonBotOrder.symbol == entity_value)
    
    profit_by_date = await asyncio.to_thread(
        lambda: profit_by_date.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').limit(30).all()
    )
    
    profit_timeline = []
    cumulative_profit = 0.0
    for item in profit_by_date:
        cumulative_profit += float(item.profit or 0.0)
        profit_timeline.append({
            "date": str(item.date),
            "daily_profit": round(float(item.profit or 0.0), 2),
            "cumulative_profit": round(cumulative_profit, 2),
            "orders_count": item.count
        })
    
    # Список последних сделок (топ-20)
    recent_orders = await asyncio.to_thread(
        lambda: base_query.order_by(models.MoonBotOrder.closed_at.desc()).limit(20).all()
    )
    orders_list = []
    for order in recent_orders:
        orders_list.append({
            "id": order.moonbot_order_id,
            "symbol": order.symbol,
            "strategy": order.strategy,
            "opened_at": format_iso(order.opened_at),
            "closed_at": format_iso(order.closed_at),
            "profit": round(order.profit_btc or 0, 2),
            "profit_percent": round(order.profit_percent or 0, 2),
            "order_type": order.order_type,
            "is_emulator": order.is_emulator
        })
    
    # Распределение по символам (только для стратегии)
    symbol_distribution = []
    if entity_type == "strategy":
        symbol_stats = await asyncio.to_thread(
            lambda: db.query(
                models.MoonBotOrder.symbol,
                func.count(models.MoonBotOrder.id).label('count'),
                func.sum(models.MoonBotOrder.profit_btc).label('profit')
            ).join(
                models.Server,
                models.MoonBotOrder.server_id == models.Server.id
            ).filter(
                models.Server.user_id == current_user.id,
                models.MoonBotOrder.strategy == entity_value,
                models.MoonBotOrder.status == "Closed"
            ).group_by(models.MoonBotOrder.symbol).all()
        )
        
        for item in symbol_stats:
            symbol_distribution.append({
                "symbol": item.symbol or "UNKNOWN",
                "count": item.count,
                "profit": round(float(item.profit or 0), 2)
            })
    
    return {
        "profit_timeline": profit_timeline,
        "recent_orders": orders_list,
        "symbol_distribution": symbol_distribution
    }