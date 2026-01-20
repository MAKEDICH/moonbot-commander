"""
Trading Stats API - Refactored

Модульная версия эндпоинта /api/trading-stats
"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timedelta
from models import models
from models.database import get_db
from services.auth import get_current_user

from .filters import apply_all_filters
from .calculators import (
    calculate_profit_factor,
    calculate_max_drawdown,
    calculate_avg_duration,
    calculate_streaks,
    calculate_cumulative_profit,
    calculate_winrate_timeline
)
from .queries import (
    build_base_query,
    get_strategy_stats,
    get_server_stats,
    get_symbol_stats,
    get_profit_by_date,
    get_winrate_by_date,
    get_available_strategies,
    get_available_servers
)
from .formatters import (
    format_strategy_stats,
    format_server_stats,
    format_symbol_stats,
    format_top_orders
)


def register_endpoint(app):
    """Зарегистрировать endpoint в приложении"""
    
    @app.get("/api/trading-stats")
    async def get_trading_stats(
        server_ids: Optional[str] = None,
        strategies: Optional[str] = None,
        emulator: Optional[str] = None,
        time_period: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        """
        Получить расширенную статистику торговли с фильтрацией
        
        Параметры:
        - server_ids: "all" для всех серверов, или "1,2,3" для конкретных
        - strategies: "all" для всех стратегий, или "Strategy1,Strategy2" для конкретных
        - emulator: "true" для эмулятора, "false" для реальных, None для всех
        - time_period: "today", "week", "month", "all", "custom"
        - date_from: начальная дата для кастомного периода (YYYY-MM-DD)
        - date_to: конечная дата для кастомного периода (YYYY-MM-DD)
        """
        
        # Базовый запрос (только закрытые ордера для статистики)
        import asyncio
        base_query = build_base_query(db, current_user.id)
        base_query = apply_all_filters(base_query, server_ids, strategies, emulator, time_period, date_from, date_to)
        
        # Запрос для открытых ордеров (отдельно, без фильтра по статусу)
        all_orders_query = db.query(models.MoonBotOrder).join(
            models.Server,
            models.MoonBotOrder.server_id == models.Server.id
        ).filter(models.Server.user_id == current_user.id)
        all_orders_query = apply_all_filters(all_orders_query, server_ids, strategies, emulator, time_period, date_from, date_to)
        
        # Общая статистика
        closed_orders = await asyncio.to_thread(base_query.count)
        open_orders = await asyncio.to_thread(
            lambda: all_orders_query.filter(models.MoonBotOrder.status == "Open").count()
        )
        total_orders = closed_orders  # Для статистики считаем только закрытые
        
        total_profit = await asyncio.to_thread(
            lambda: base_query.with_entities(func.sum(models.MoonBotOrder.profit_btc)).scalar() or 0.0
        )
        avg_profit = total_profit / total_orders if total_orders > 0 else 0.0
        
        profitable_count = await asyncio.to_thread(
            lambda: base_query.filter(models.MoonBotOrder.profit_btc > 0).count()
        )
        losing_count = await asyncio.to_thread(
            lambda: base_query.filter(models.MoonBotOrder.profit_btc < 0).count()
        )
        winrate = (profitable_count / total_orders * 100) if total_orders > 0 else 0.0
        
        # Расширенные метрики
        total_wins = await asyncio.to_thread(
            lambda: base_query.filter(models.MoonBotOrder.profit_btc > 0).with_entities(
                func.sum(models.MoonBotOrder.profit_btc)
            ).scalar() or 0.0
        )
        
        total_losses = abs(await asyncio.to_thread(
            lambda: base_query.filter(models.MoonBotOrder.profit_btc < 0).with_entities(
                func.sum(models.MoonBotOrder.profit_btc)
            ).scalar() or 0.0
        ))
        
        profit_factor = calculate_profit_factor(total_wins, total_losses)
        
        closed_orders_list = await asyncio.to_thread(
            lambda: base_query.filter(
                models.MoonBotOrder.status == "Closed"
            ).order_by(models.MoonBotOrder.closed_at.asc()).all()
        )
        
        max_drawdown = calculate_max_drawdown(closed_orders_list)
        
        closed_with_times = await asyncio.to_thread(
            lambda: base_query.filter(
                models.MoonBotOrder.status == "Closed",
                models.MoonBotOrder.opened_at.isnot(None),
                models.MoonBotOrder.closed_at.isnot(None)
            ).all()
        )
        
        avg_duration_hours = calculate_avg_duration(closed_with_times)
        
        total_spent = await asyncio.to_thread(
            lambda: base_query.with_entities(func.sum(models.MoonBotOrder.spent_btc)).scalar() or 0.0
        )
        roi = ((total_profit / total_spent) * 100) if total_spent > 0 else 0.0
        
        all_orders_sorted = await asyncio.to_thread(
            lambda: base_query.filter(
                models.MoonBotOrder.status == "Closed"
            ).order_by(models.MoonBotOrder.closed_at.asc()).all()
        )
        
        max_win_streak, max_loss_streak = calculate_streaks(all_orders_sorted)
        
        # Статистика по группам
        strategy_stats = await asyncio.to_thread(get_strategy_stats, db, current_user.id, server_ids, strategies, emulator)
        server_stats = await asyncio.to_thread(get_server_stats, db, current_user.id, server_ids, strategies)
        symbol_stats = await asyncio.to_thread(get_symbol_stats, db, current_user.id, server_ids, strategies)
        
        # Топ сделок
        top_profitable = await asyncio.to_thread(
            lambda: base_query.filter(
                models.MoonBotOrder.profit_btc > 0
            ).order_by(models.MoonBotOrder.profit_btc.desc()).limit(10).all()
        )
        
        top_losing = await asyncio.to_thread(
            lambda: base_query.filter(
                models.MoonBotOrder.profit_btc < 0
            ).order_by(models.MoonBotOrder.profit_btc.asc()).limit(10).all()
        )
        
        # Списки
        all_strategies = await asyncio.to_thread(get_available_strategies, db, current_user.id)
        all_servers = await asyncio.to_thread(get_available_servers, db, current_user.id)
        
        # Графики
        profit_by_date = await asyncio.to_thread(
            get_profit_by_date, db, current_user.id, server_ids, strategies, emulator, 
            time_period, date_from, date_to
        )
        profit_timeline = calculate_cumulative_profit(profit_by_date)
        
        winrate_by_date = await asyncio.to_thread(
            get_winrate_by_date, db, current_user.id, server_ids, strategies, emulator,
            time_period, date_from, date_to
        )
        winrate_timeline = calculate_winrate_timeline(winrate_by_date)
        
        # Сравнение с предыдущим периодом
        previous_stats = None
        if time_period and time_period != "all":
            from .comparison import calculate_previous_period_stats
            previous_stats = await asyncio.to_thread(
                calculate_previous_period_stats,
                db, current_user.id, time_period, server_ids, strategies, emulator,
                total_profit, winrate, total_orders
            )
        
        return {
            "overall": {
                "total_orders": total_orders,
                "open_orders": open_orders,
                "closed_orders": closed_orders,
                "total_profit": round(total_profit, 2),
                "avg_profit": round(avg_profit, 2),
                "profitable_count": profitable_count,
                "losing_count": losing_count,
                "winrate": round(winrate, 2),
                "profit_factor": round(profit_factor, 2),
                "max_drawdown": round(max_drawdown, 2),
                "avg_duration_hours": round(avg_duration_hours, 2),
                "roi": round(roi, 2),
                "max_win_streak": max_win_streak,
                "max_loss_streak": max_loss_streak,
                "total_wins": round(total_wins, 2),
                "total_losses": round(total_losses, 2)
            },
            "by_strategy": await asyncio.to_thread(format_strategy_stats, strategy_stats, base_query),
            "by_server": await asyncio.to_thread(format_server_stats, server_stats, db),
            "by_symbol": await asyncio.to_thread(format_symbol_stats, symbol_stats, base_query),
            "top_profitable": format_top_orders(top_profitable),
            "top_losing": format_top_orders(top_losing),
            "available_strategies": [s.strategy for s in all_strategies if s.strategy],
            "available_servers": [{"id": s.id, "name": s.name} for s in all_servers],
            "profit_timeline": profit_timeline,
            "winrate_timeline": winrate_timeline,
            "previous_period": previous_stats
        }
    
    return get_trading_stats

