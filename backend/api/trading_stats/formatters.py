"""
Форматтеры ответов для trading stats

Функции форматирования данных для API ответов
"""
from typing import List
from models import models
from sqlalchemy.orm import Session, Query
from sqlalchemy import func


def format_strategy_stats(strategy_stats, base_query: Query) -> List[dict]:
    """Форматировать статистику по стратегиям"""
    return [
        {
            "strategy": s.strategy or "Unknown",
            "total_orders": s.total or 0,
            "total_profit": round(s.profit or 0, 2),
            "avg_profit_percent": round(s.avg_profit_percent or 0, 2),
            "winrate": round(
                (base_query.filter(
                    models.MoonBotOrder.strategy == s.strategy,
                    models.MoonBotOrder.profit_btc > 0
                ).count() / s.total * 100) if s.total > 0 else 0.0, 2
            )
        }
        for s in strategy_stats
    ]


def format_server_stats(server_stats, db: Session) -> List[dict]:
    """Форматировать статистику по серверам"""
    return [
        {
            "server_id": s.id,
            "server_name": s.name,
            "total_orders": s.total or 0,
            "total_profit": round(s.profit or 0, 2),
            "open_orders": db.query(func.count(models.MoonBotOrder.id)).filter(
                models.MoonBotOrder.server_id == s.id,
                models.MoonBotOrder.status == "Open"
            ).scalar() or 0,
            "winrate": round(
                (db.query(func.count(models.MoonBotOrder.id)).filter(
                    models.MoonBotOrder.server_id == s.id,
                    models.MoonBotOrder.profit_btc > 0
                ).scalar() / s.total * 100) if s.total > 0 else 0.0, 2
            )
        }
        for s in server_stats
    ]


def format_symbol_stats(symbol_stats, base_query: Query) -> List[dict]:
    """Форматировать статистику по символам"""
    return [
        {
            "symbol": s.symbol or "UNKNOWN",
            "total_orders": s.total or 0,
            "total_profit": round(s.profit or 0, 2),
            "avg_profit_percent": round(s.avg_profit_percent or 0, 2),
            "winrate": round(
                (base_query.filter(
                    models.MoonBotOrder.symbol == s.symbol,
                    models.MoonBotOrder.profit_btc > 0
                ).count() / s.total * 100) if s.total > 0 else 0.0, 2
            )
        }
        for s in symbol_stats
    ]


def format_top_orders(orders: List[models.MoonBotOrder]) -> List[dict]:
    """Форматировать топ ордеров"""
    return [
        {
            "id": o.moonbot_order_id,
            "symbol": o.symbol,
            "strategy": o.strategy,
            "profit": round(o.profit_btc or 0, 2),
            "profit_percent": round(o.profit_percent or 0, 2)
        }
        for o in orders
    ]






