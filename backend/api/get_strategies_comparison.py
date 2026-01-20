"""
Эндпоинт: GET /api/servers/{server_id}/strategies/comparison
Функция: get_strategies_comparison
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
from core.server_access import get_user_server
from utils.query_filters import apply_emulator_filter


@app.get("/api/servers/{server_id}/strategies/comparison")
async def get_strategies_comparison(
    server_id: int,
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить сравнительную статистику по стратегиям для конкретного сервера
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    """
    from sqlalchemy import func
    
    # Проверяем что сервер принадлежит пользователю
    server = await get_user_server(server_id, current_user, db)
    
    # Получаем все ордера с группировкой по стратегиям
    import asyncio
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        emulator_filter = 'emulator' if emulator.lower() == 'true' else 'real'
        query = apply_emulator_filter(query, emulator_filter, models.MoonBotOrder.is_emulator)
    
    orders = await asyncio.to_thread(query.all)
    
    # Группируем данные по стратегиям
    strategies_data = {}
    
    for order in orders:
        strategy = order.strategy or "Unknown"
        
        if strategy not in strategies_data:
            strategies_data[strategy] = {
                "strategy": strategy,
                "total_orders": 0,
                "open_orders": 0,
                "closed_orders": 0,
                "total_profit": 0.0,
                "winning_orders": 0,
                "losing_orders": 0,
                "total_spent": 0.0,
                "total_gained": 0.0,
                "avg_profit_per_order": 0.0,
                "win_rate": 0.0,
                "profit_factor": 0.0,
                "best_trade": 0.0,
                "worst_trade": 0.0
            }
        
        strategy_stats = strategies_data[strategy]
        strategy_stats["total_orders"] += 1
        
        if order.status == "Open":
            strategy_stats["open_orders"] += 1
        elif order.status == "Closed":
            strategy_stats["closed_orders"] += 1
        
        # Прибыль
        profit = float(order.profit_btc or 0.0)
        strategy_stats["total_profit"] += profit
        
        if profit > 0:
            strategy_stats["winning_orders"] += 1
        elif profit < 0:
            strategy_stats["losing_orders"] += 1
        
        # Потрачено и получено
        spent = float(order.spent_btc or 0.0)
        gained = float(order.gained_btc or 0.0)
        strategy_stats["total_spent"] += spent
        strategy_stats["total_gained"] += gained
        
        # Лучшая и худшая сделка
        if profit > strategy_stats["best_trade"]:
            strategy_stats["best_trade"] = profit
        if profit < strategy_stats["worst_trade"]:
            strategy_stats["worst_trade"] = profit
    
    # Вычисляем производные метрики
    for strategy, stats in strategies_data.items():
        if stats["closed_orders"] > 0:
            stats["avg_profit_per_order"] = stats["total_profit"] / stats["closed_orders"]
            stats["win_rate"] = (stats["winning_orders"] / stats["closed_orders"]) * 100
        
        # Profit Factor = (Суммарная прибыль по прибыльным сделкам) / (Суммарный убыток по убыточным сделкам)
        total_wins = sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) > 0)
        total_losses = abs(sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) < 0))
        
        if total_losses > 0:
            stats["profit_factor"] = total_wins / total_losses
        elif total_wins > 0:
            stats["profit_factor"] = 999.99  # Бесконечность (нет убытков)
        else:
            stats["profit_factor"] = 0.0
    
    # Преобразуем в список и сортируем по общей прибыли
    strategies_list = sorted(strategies_data.values(), key=lambda x: x["total_profit"], reverse=True)
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "strategies": strategies_list
    }