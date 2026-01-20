"""
Утилиты для фильтрации запросов
Устраняет дублирование логики фильтров
"""

from sqlalchemy.orm import Query
from typing import Optional
from models import models


def apply_emulator_filter(
    query: Query,
    emulator_filter: Optional[str],
    model_field
) -> Query:
    """
    Применить фильтр эмулятор/реальные к запросу
    
    Args:
        query: SQLAlchemy Query объект
        emulator_filter: Тип фильтра ("emulator", "real", "all", None)
        model_field: Поле модели для фильтрации (например, models.Server.is_emulator)
    
    Returns:
        Query с примененным фильтром
    """
    if emulator_filter == "emulator":
        query = query.filter(model_field == True)
    elif emulator_filter == "real":
        query = query.filter(model_field == False)
    # "all" или None - не фильтруем
    
    return query


def apply_server_filter(
    query: Query,
    server_ids: Optional[list[int]],
    server_field
) -> Query:
    """
    Применить фильтр по списку серверов
    
    Args:
        query: SQLAlchemy Query объект
        server_ids: Список ID серверов или None
        server_field: Поле для фильтрации (например, models.Order.server_id)
    
    Returns:
        Query с примененным фильтром
    """
    if server_ids:
        query = query.filter(server_field.in_(server_ids))
    
    return query


def apply_date_range_filter(
    query: Query,
    start_date: Optional[str],
    end_date: Optional[str],
    date_field
) -> Query:
    """
    Применить фильтр по диапазону дат
    
    Args:
        query: SQLAlchemy Query объект
        start_date: Начальная дата (ISO формат)
        end_date: Конечная дата (ISO формат)
        date_field: Поле даты для фильтрации
    
    Returns:
        Query с примененным фильтром
    """
    from datetime import datetime
    
    if start_date:
        try:
            start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(date_field >= start)
        except ValueError:
            pass  # Игнорируем невалидные даты
    
    if end_date:
        try:
            end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(date_field <= end)
        except ValueError:
            pass  # Игнорируем невалидные даты
    
    return query


def apply_pagination(
    query: Query,
    skip: int = 0,
    limit: Optional[int] = None
) -> Query:
    """
    Применить пагинацию к запросу
    
    Args:
        query: SQLAlchemy Query объект
        skip: Количество записей для пропуска
        limit: Максимальное количество записей или None
    
    Returns:
        Query с примененной пагинацией
    """
    query = query.offset(skip)
    
    if limit is not None:
        query = query.limit(limit)
    
    return query


def apply_search_filter(
    query: Query,
    search_term: Optional[str],
    search_fields: list
) -> Query:
    """
    Применить поисковый фильтр по нескольким полям
    
    Args:
        query: SQLAlchemy Query объект
        search_term: Поисковый запрос
        search_fields: Список полей для поиска
    
    Returns:
        Query с примененным фильтром поиска
    """
    if not search_term:
        return query
    
    from sqlalchemy import or_
    
    filters = [field.ilike(f"%{search_term}%") for field in search_fields]
    return query.filter(or_(*filters))

