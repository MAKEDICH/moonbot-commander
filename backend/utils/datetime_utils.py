"""
Утилиты для работы с датой и временем

Централизованный модуль для datetime операций.
Устраняет дублирование кода в проекте.
"""
from datetime import datetime, timezone
from typing import Optional


def utcnow() -> datetime:
    """
    Получить текущее UTC время (timezone-aware).
    
    Returns:
        datetime: Текущее UTC время с информацией о часовом поясе
    
    Example:
        >>> now = utcnow()
        >>> now.tzinfo
        datetime.timezone.utc
    """
    return datetime.now(timezone.utc)


def to_utc(dt: datetime) -> datetime:
    """
    Преобразовать datetime в UTC.
    
    Args:
        dt: Объект datetime (может быть naive или aware)
        
    Returns:
        datetime: UTC время
    """
    if dt.tzinfo is None:
        # Naive datetime - считаем что это UTC
        return dt.replace(tzinfo=timezone.utc)
    else:
        # Aware datetime - конвертируем в UTC
        return dt.astimezone(timezone.utc)


def format_iso(dt: Optional[datetime]) -> Optional[str]:
    """
    Форматировать datetime в ISO 8601 строку с UTC timezone.
    
    Если datetime naive (без timezone), считаем что это UTC.
    Добавляет 'Z' суффикс для корректной интерпретации на фронтенде.
    
    Args:
        dt: Объект datetime или None
        
    Returns:
        str: ISO формат строки с 'Z' суффиксом или None
    """
    if dt is None:
        return None
    
    # Если datetime naive, добавляем UTC timezone
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Конвертируем в UTC если нужно
    dt_utc = dt.astimezone(timezone.utc)
    
    # Форматируем без микросекунд и с Z суффиксом
    return dt_utc.strftime('%Y-%m-%dT%H:%M:%SZ')


def timestamp_to_datetime(timestamp: int) -> Optional[datetime]:
    """
    Преобразовать Unix timestamp в datetime.
    
    Args:
        timestamp: Unix timestamp (секунды с 1970-01-01)
        
    Returns:
        datetime: UTC datetime или None если timestamp = 0
    """
    if timestamp == 0:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)



