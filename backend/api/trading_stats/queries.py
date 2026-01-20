"""
Запросы к БД для trading stats

Функции построения SQL запросов для статистики
"""
from sqlalchemy.orm import Session, Query
from sqlalchemy import func, case
from typing import Optional
from models import models
from .filters import apply_all_filters


def build_base_query(db: Session, user_id: int) -> Query:
    """Построить базовый запрос для ЗАКРЫТЫХ ордеров пользователя"""
    return db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed"  # Только закрытые ордера для статистики
    )


def get_strategy_stats(db: Session, user_id: int, server_ids: Optional[str],
                      strategies: Optional[str], emulator: Optional[str]):
    """Получить статистику по стратегиям (только закрытые ордера)"""
    query = db.query(
        models.MoonBotOrder.strategy,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.avg(models.MoonBotOrder.profit_percent).label('avg_profit_percent')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed"
    )
    
    query = apply_all_filters(query, server_ids, strategies, emulator, None, None, None)
    return query.group_by(models.MoonBotOrder.strategy).all()


def get_server_stats(db: Session, user_id: int, server_ids: Optional[str],
                    strategies: Optional[str]):
    """Получить статистику по серверам (только закрытые ордера)"""
    query = db.query(
        models.Server.id,
        models.Server.name,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit')
    ).join(
        models.MoonBotOrder,
        models.Server.id == models.MoonBotOrder.server_id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed"
    )
    
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            query = query.filter(models.Server.id.in_(server_id_list))
        except (ValueError, AttributeError):
            pass  # Неверный формат - игнорируем фильтр
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        query = query.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    return query.group_by(models.Server.id, models.Server.name).all()


def get_symbol_stats(db: Session, user_id: int, server_ids: Optional[str],
                    strategies: Optional[str]):
    """Получить статистику по символам (только закрытые ордера)"""
    query = db.query(
        models.MoonBotOrder.symbol,
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit'),
        func.avg(models.MoonBotOrder.profit_percent).label('avg_profit_percent')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed"
    )
    
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            query = query.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except (ValueError, AttributeError):
            pass  # Неверный формат - игнорируем фильтр
    
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        query = query.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    
    return query.group_by(models.MoonBotOrder.symbol).order_by(
        func.sum(models.MoonBotOrder.profit_btc).desc()
    ).all()


def get_profit_by_date(db: Session, user_id: int, server_ids: Optional[str],
                      strategies: Optional[str], emulator: Optional[str],
                      time_period: Optional[str], date_from: Optional[str],
                      date_to: Optional[str]):
    """Получить прибыль по датам"""
    from datetime import datetime, timedelta
    
    query = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.sum(models.MoonBotOrder.profit_btc).label('profit')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    query = apply_all_filters(query, server_ids, strategies, emulator, time_period, date_from, date_to)
    return query.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').all()


def get_winrate_by_date(db: Session, user_id: int, server_ids: Optional[str],
                       strategies: Optional[str], emulator: Optional[str],
                       time_period: Optional[str], date_from: Optional[str],
                       date_to: Optional[str]):
    """Получить винрейт по датам"""
    query = db.query(
        func.date(models.MoonBotOrder.closed_at).label('date'),
        func.count(models.MoonBotOrder.id).label('total'),
        func.sum(case((models.MoonBotOrder.profit_btc > 0, 1), else_=0)).label('wins')
    ).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    query = apply_all_filters(query, server_ids, strategies, emulator, time_period, date_from, date_to)
    return query.group_by(func.date(models.MoonBotOrder.closed_at)).order_by('date').all()


def get_available_strategies(db: Session, user_id: int):
    """Получить список всех доступных стратегий"""
    return db.query(models.MoonBotOrder.strategy).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == user_id,
        models.MoonBotOrder.strategy.isnot(None)
    ).distinct().all()


def get_available_servers(db: Session, user_id: int):
    """Получить список всех доступных серверов пользователя"""
    return db.query(models.Server.id, models.Server.name).filter(
        models.Server.user_id == user_id,
        models.Server.is_active == True
    ).all()




