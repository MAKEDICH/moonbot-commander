"""
Фильтры для trading stats

Функции применения фильтров к запросам
"""
from sqlalchemy.orm import Query
from fastapi import HTTPException
from datetime import datetime, timedelta
from typing import Optional
from models import models
from utils.query_filters import apply_emulator_filter as apply_emulator_filter_util


def apply_server_filter(query: Query, server_ids: Optional[str]) -> Query:
    """Применить фильтр по серверам"""
    if server_ids and server_ids != "all":
        try:
            server_id_list = [int(sid.strip()) for sid in server_ids.split(',')]
            query = query.filter(models.MoonBotOrder.server_id.in_(server_id_list))
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Неверный формат server_ids")
    return query


def apply_strategy_filter(query: Query, strategies: Optional[str]) -> Query:
    """Применить фильтр по стратегиям"""
    if strategies and strategies != "all":
        strategy_list = [s.strip() for s in strategies.split(',')]
        query = query.filter(models.MoonBotOrder.strategy.in_(strategy_list))
    return query


def apply_emulator_filter(query: Query, emulator: Optional[str]) -> Query:
    """Применить фильтр по эмулятору (используется общая утилита)"""
    # Преобразуем формат фильтра: 'true'/'false' -> 'emulator'/'real'
    emulator_filter = None
    if emulator and emulator.lower() == 'true':
        emulator_filter = 'emulator'
    elif emulator and emulator.lower() == 'false':
        emulator_filter = 'real'
    
    return apply_emulator_filter_util(query, emulator_filter, models.MoonBotOrder.is_emulator)


def apply_time_period_filter(query: Query, time_period: Optional[str], 
                             date_from: Optional[str], date_to: Optional[str]) -> Query:
    """Применить фильтр по времени (по дате ЗАКРЫТИЯ сделки)"""
    if not time_period:
        return query
    
    # Используем ЛОКАЛЬНОЕ время сервера!
    now = datetime.now()
    
    # Фильтруем по closed_at (дата закрытия), а не opened_at!
    if time_period == "today":
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(models.MoonBotOrder.closed_at >= start_of_day)
    elif time_period == "week":
        start_of_week = now - timedelta(days=7)
        query = query.filter(models.MoonBotOrder.closed_at >= start_of_week)
    elif time_period == "month":
        start_of_month = now - timedelta(days=30)
        query = query.filter(models.MoonBotOrder.closed_at >= start_of_month)
    elif time_period == "custom":
        if date_from and date_to:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d")
                to_date = datetime.strptime(date_to, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
                query = query.filter(
                    models.MoonBotOrder.closed_at >= from_date,
                    models.MoonBotOrder.closed_at <= to_date
                )
            except ValueError:
                raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")
    
    return query


def apply_all_filters(query: Query, server_ids: Optional[str], strategies: Optional[str],
                     emulator: Optional[str], time_period: Optional[str],
                     date_from: Optional[str], date_to: Optional[str]) -> Query:
    """Применить все фильтры к запросу"""
    query = apply_server_filter(query, server_ids)
    query = apply_strategy_filter(query, strategies)
    query = apply_emulator_filter(query, emulator)
    query = apply_time_period_filter(query, time_period, date_from, date_to)
    return query


