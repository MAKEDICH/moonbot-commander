"""
Эндпоинт: GET /api/strategies/comparison-all
Функция: get_strategies_comparison_all
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
from utils.query_filters import apply_emulator_filter


@app.get("/api/strategies/comparison-all")
async def get_strategies_comparison_all(
    emulator: Optional[str] = None,  # "true", "false" или None (все)
    server_ids: Optional[str] = None,  # Список ID серверов через запятую
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить сравнительную статистику по стратегиям со всех серверов пользователя
    
    Параметры:
    - emulator: "true" для эмулятора, "false" для реальных, None для всех
    - server_ids: список ID серверов через запятую (опционально)
    """
    from sqlalchemy import func
    
    # Получаем сервера пользователя
    import asyncio
    servers_query = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтруем по конкретным ID серверов если указаны
    if server_ids:
        try:
            server_id_list = [int(sid) for sid in server_ids.split(',') if sid.strip()]
            servers_query = servers_query.filter(models.Server.id.in_(server_id_list))
        except ValueError:
            return {"strategies": []}
    
    user_servers = await asyncio.to_thread(servers_query.all)
    
    if not user_servers:
        return {"strategies": []}
    
    server_ids = [s.id for s in user_servers]
    
    # Получаем все ордера со всех серверов
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_ids)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        emulator_filter = 'emulator' if emulator.lower() == 'true' else 'real'
        query = apply_emulator_filter(query, emulator_filter, models.MoonBotOrder.is_emulator)
    
    orders = await asyncio.to_thread(query.all)
    
    # Группируем данные по стратегиям (аналогично выше)
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
        
        profit = float(order.profit_btc or 0.0)
        strategy_stats["total_profit"] += profit
        
        if profit > 0:
            strategy_stats["winning_orders"] += 1
        elif profit < 0:
            strategy_stats["losing_orders"] += 1
        
        spent = float(order.spent_btc or 0.0)
        gained = float(order.gained_btc or 0.0)
        strategy_stats["total_spent"] += spent
        strategy_stats["total_gained"] += gained
        
        if profit > strategy_stats["best_trade"]:
            strategy_stats["best_trade"] = profit
        if profit < strategy_stats["worst_trade"]:
            strategy_stats["worst_trade"] = profit
    
    # Вычисляем производные метрики
    for strategy, stats in strategies_data.items():
        if stats["closed_orders"] > 0:
            stats["avg_profit_per_order"] = stats["total_profit"] / stats["closed_orders"]
            stats["win_rate"] = (stats["winning_orders"] / stats["closed_orders"]) * 100
        
        total_wins = sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) > 0)
        total_losses = abs(sum(float(o.profit_btc or 0.0) for o in orders if o.strategy == strategy and float(o.profit_btc or 0.0) < 0))
        
        if total_losses > 0:
            stats["profit_factor"] = total_wins / total_losses
        elif total_wins > 0:
            stats["profit_factor"] = 999.99
        else:
            stats["profit_factor"] = 0.0
    
    strategies_list = sorted(strategies_data.values(), key=lambda x: x["total_profit"], reverse=True)
    
    return {"strategies": strategies_list}