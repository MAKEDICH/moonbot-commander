"""
Утилиты для работы с датой и временем

=============================================================================
ЕДИНАЯ СТРАТЕГИЯ РАБОТЫ СО ВРЕМЕНЕМ (ОКОНЧАТЕЛЬНАЯ)
=============================================================================

ПРИНЦИП: ВСЁ в локальном времени машины!

1. ПОЛУЧЕНИЕ ТЕКУЩЕГО ВРЕМЕНИ:
   - now() или utcnow() → локальное время машины
   - current_timestamp() → Unix timestamp (для сравнений)

2. КОНВЕРТАЦИЯ TIMESTAMP:
   - timestamp_to_datetime(ts) → локальное datetime
   - MoonBot шлёт Unix timestamp, мы конвертируем в локальное

3. ХРАНЕНИЕ В БД:
   - Все datetime хранятся в локальном времени
   - default=now для новых записей

4. ОТОБРАЖЕНИЕ ПОЛЬЗОВАТЕЛЮ:
   - Всё уже в локальном времени, просто форматируем

5. СРАВНЕНИЯ:
   - Для сравнения дат: используем datetime напрямую
   - Для сравнения с timestamp от MoonBot: 
     current_timestamp() vs moonbot_timestamp (оба int)

=============================================================================
"""
from datetime import datetime, timedelta
from typing import Optional
import time


# =============================================================================
# ПОЛУЧЕНИЕ ТЕКУЩЕГО ВРЕМЕНИ
# =============================================================================

def now() -> datetime:
    """
    Получить текущее локальное время машины.
    
    Это ОСНОВНАЯ функция для получения текущего времени.
    
    Returns:
        datetime: Текущее локальное время (naive, без timezone)
    
    Примеры использования:
        - Запись created_at в БД
        - Логирование
        - Сравнение с другими datetime
    """
    return datetime.now()


def utcnow() -> datetime:
    """
    Получить текущее локальное время.
    
    ПРИМЕЧАНИЕ: Для согласованности возвращает локальное время,
    несмотря на название.
    
    Returns:
        datetime: Текущее локальное время (naive)
    """
    return datetime.now()


def localnow() -> datetime:
    """
    Получить текущее локальное время машины.
    
    Returns:
        datetime: Текущее локальное время (naive)
    """
    return datetime.now()


def current_timestamp() -> int:
    """
    Получить текущий Unix timestamp.
    
    Unix timestamp - количество секунд с 1970-01-01 00:00:00 UTC.
    Это универсальный формат для сравнений, не зависит от timezone.
    
    Используется для:
        - Сравнения с timestamp от MoonBot
        - Проверки "дата в прошлом/будущем"
    
    Returns:
        int: Текущий Unix timestamp
    """
    return int(time.time())


# Алиас для обратной совместимости
def utc_timestamp() -> int:
    """Алиас для current_timestamp()."""
    return current_timestamp()


# =============================================================================
# КОНВЕРТАЦИЯ TIMESTAMP В DATETIME
# =============================================================================

def timestamp_to_datetime(timestamp: int) -> Optional[datetime]:
    """
    Преобразовать Unix timestamp в datetime.
    
    ВАЖНО: Используем utcfromtimestamp для согласованности с datetime.now()
    на серверах где системное время = UTC но timezone может быть другой.
    
    Args:
        timestamp: Unix timestamp (секунды с 1970-01-01 UTC)
        
    Returns:
        datetime: UTC время или None если timestamp = 0
    """
    if timestamp == 0:
        return None
    try:
        # Используем utcfromtimestamp для согласованности
        # Это гарантирует что время будет таким же как datetime.now() на UTC сервере
        return datetime.utcfromtimestamp(timestamp)
    except (ValueError, OSError, OverflowError):
        return None


def timestamp_to_utc(timestamp: int) -> Optional[datetime]:
    """
    АЛИАС для timestamp_to_datetime() - для обратной совместимости.
    
    ВНИМАНИЕ: Несмотря на название, возвращает ЛОКАЛЬНОЕ время!
    
    Args:
        timestamp: Unix timestamp
        
    Returns:
        datetime: Локальное время или None
    """
    return timestamp_to_datetime(timestamp)


def timestamp_to_local(timestamp: int) -> Optional[datetime]:
    """
    Алиас для timestamp_to_datetime().
    
    Args:
        timestamp: Unix timestamp
        
    Returns:
        datetime: Локальное время или None
    """
    return timestamp_to_datetime(timestamp)


# =============================================================================
# ФОРМАТИРОВАНИЕ ДЛЯ API
# =============================================================================

def format_iso(dt: Optional[datetime]) -> Optional[str]:
    """
    Форматировать datetime в ISO 8601 строку.
    
    Используется для отправки времени на frontend.
    
    Args:
        dt: Объект datetime или None
        
    Returns:
        str: ISO строка (YYYY-MM-DDTHH:MM:SS) или None
    
    Пример:
        >>> format_iso(datetime(2023, 12, 9, 15, 30, 45))
        "2023-12-09T15:30:45"
    """
    if dt is None:
        return None
    return dt.strftime('%Y-%m-%dT%H:%M:%S')


def format_iso_utc(dt: Optional[datetime]) -> Optional[str]:
    """
    Алиас для format_iso() - для обратной совместимости.
    
    Args:
        dt: Объект datetime или None
        
    Returns:
        str: ISO строка или None
    """
    return format_iso(dt)


def format_datetime(dt: Optional[datetime], fmt: str = '%Y-%m-%d %H:%M:%S') -> Optional[str]:
    """
    Форматировать datetime в произвольный формат.
    
    Args:
        dt: Объект datetime или None
        fmt: Формат strftime (по умолчанию YYYY-MM-DD HH:MM:SS)
        
    Returns:
        str: Отформатированная строка или None
    """
    if dt is None:
        return None
    return dt.strftime(fmt)


# =============================================================================
# DEPRECATED ФУНКЦИИ (для обратной совместимости)
# =============================================================================

def to_local(dt: Optional[datetime]) -> Optional[datetime]:
    """
    DEPRECATED: Возвращает datetime как есть.
    
    Раньше конвертировала UTC в локальное, теперь не нужно -
    всё уже в локальном.
    
    Args:
        dt: Объект datetime
        
    Returns:
        datetime: Тот же объект
    """
    return dt


def to_utc(dt: datetime) -> datetime:
    """
    DEPRECATED: Возвращает datetime как есть.
    
    Args:
        dt: Объект datetime
        
    Returns:
        datetime: Тот же объект
    """
    return dt


# =============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =============================================================================

def is_timestamp_in_past(timestamp: int) -> bool:
    """
    Проверить, находится ли timestamp в прошлом.
    
    Args:
        timestamp: Unix timestamp для проверки
        
    Returns:
        bool: True если в прошлом
    """
    return timestamp < current_timestamp()


def is_timestamp_in_future(timestamp: int) -> bool:
    """
    Проверить, находится ли timestamp в будущем.
    
    Args:
        timestamp: Unix timestamp для проверки
        
    Returns:
        bool: True если в будущем
    """
    return timestamp > current_timestamp()


def seconds_since(dt: Optional[datetime]) -> Optional[int]:
    """
    Сколько секунд прошло с указанного момента.
    
    Args:
        dt: Момент времени
        
    Returns:
        int: Количество секунд или None
    """
    if dt is None:
        return None
    delta = now() - dt
    return int(delta.total_seconds())


def seconds_until(dt: Optional[datetime]) -> Optional[int]:
    """
    Сколько секунд осталось до указанного момента.
    
    Args:
        dt: Момент времени
        
    Returns:
        int: Количество секунд (отрицательное если в прошлом) или None
    """
    if dt is None:
        return None
    delta = dt - now()
    return int(delta.total_seconds())


def datetime_to_timestamp(dt: Optional[datetime]) -> Optional[int]:
    """
    Преобразовать datetime в Unix timestamp.
    
    Args:
        dt: Объект datetime (локальное время)
        
    Returns:
        int: Unix timestamp или None
    """
    if dt is None:
        return None
    return int(dt.timestamp())


def add_seconds(dt: datetime, seconds: int) -> datetime:
    """
    Добавить секунды к datetime.
    
    Args:
        dt: Исходное время
        seconds: Количество секунд (может быть отрицательным)
        
    Returns:
        datetime: Новое время
    """
    return dt + timedelta(seconds=seconds)


def add_days(dt: datetime, days: int) -> datetime:
    """
    Добавить дни к datetime.
    
    Args:
        dt: Исходное время
        days: Количество дней (может быть отрицательным)
        
    Returns:
        datetime: Новое время
    """
    return dt + timedelta(days=days)
