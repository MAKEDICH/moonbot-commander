"""
Сравнение с предыдущим периодом

Функции расчёта статистики за предыдущий период для сравнения
"""
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, Dict
from models import models
from .filters import apply_server_filter, apply_strategy_filter, apply_emulator_filter


def calculate_previous_period_stats(
    db: Session,
    user_id: int,
    time_period: str,
    server_ids: Optional[str],
    strategies: Optional[str],
    emulator: Optional[str],
    current_total_profit: float,
    current_winrate: float,
    current_total_orders: int
) -> Optional[Dict]:
    """Рассчитать статистику за предыдущий период для сравнения"""
    
    # Используем ЛОКАЛЬНОЕ время сервера!
    now = datetime.now()
    
    # Определяем границы предыдущего периода
    if time_period == "today":
        prev_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
        prev_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif time_period == "week":
        prev_start = now - timedelta(days=14)
        prev_end = now - timedelta(days=7)
    elif time_period == "month":
        prev_start = now - timedelta(days=60)
        prev_end = now - timedelta(days=30)
    else:
        return None
    
    # Базовый запрос для предыдущего периода
    prev_query = db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.opened_at >= prev_start,
        models.MoonBotOrder.opened_at < prev_end
    )
    
    # Применяем фильтры
    prev_query = apply_server_filter(prev_query, server_ids)
    prev_query = apply_strategy_filter(prev_query, strategies)
    prev_query = apply_emulator_filter(prev_query, emulator)
    
    # Считаем метрики
    prev_total_orders = prev_query.count()
    prev_total_profit = db.query(func.sum(models.MoonBotOrder.profit_btc)).filter(
        models.MoonBotOrder.id.in_([o.id for o in prev_query.all()])
    ).scalar() or 0.0
    
    prev_profitable_count = prev_query.filter(models.MoonBotOrder.profit_btc > 0).count()
    prev_winrate = (prev_profitable_count / prev_total_orders * 100) if prev_total_orders > 0 else 0.0
    
    # Вычисляем изменения
    profit_change = current_total_profit - prev_total_profit
    
    # Процент изменения прибыли:
    # - Если предыдущая прибыль была 0 или очень маленькая, не показываем процент
    # - Ограничиваем максимум ±999% для читаемости
    if abs(prev_total_profit) < 0.01:
        # Если предыдущей прибыли почти не было, процент не имеет смысла
        profit_change_percent = 0.0
    else:
        profit_change_percent = (profit_change / abs(prev_total_profit)) * 100
        # Ограничиваем диапазон
        profit_change_percent = max(-999.0, min(999.0, profit_change_percent))
    
    winrate_change = current_winrate - prev_winrate
    
    orders_change = current_total_orders - prev_total_orders
    orders_change_percent = ((current_total_orders - prev_total_orders) / prev_total_orders * 100) if prev_total_orders > 0 else 0.0
    
    return {
        "profit_change": round(profit_change, 2),
        "profit_change_percent": round(profit_change_percent, 1),
        "winrate_change": round(winrate_change, 1),
        "orders_change": orders_change,
        "orders_change_percent": round(orders_change_percent, 1),
        "prev_total_profit": round(prev_total_profit, 2),
        "prev_winrate": round(prev_winrate, 1),
        "prev_total_orders": prev_total_orders
    }




