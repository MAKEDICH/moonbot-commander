"""
🎯 Simple API for Logging

Оптимизировано для 3000+ серверов:
- Условное логирование для уменьшения overhead
- Thread-safe счётчики
"""

import logging
import threading
from typing import Dict


# Thread-safe счётчики для условного логирования
_log_counters: Dict[str, int] = {}
_log_counters_lock = threading.Lock()


def log(message: str, level: str = "INFO"):
    """
    Простой API для логирования

    Args:
        message: Сообщение для логирования
        level: Уровень логирования (DEBUG, INFO, WARNING, ERROR, CRITICAL)

    Examples:
        log("Server started")
        log("Connection failed", level="ERROR")
        log("Debugging info", level="DEBUG")
    """
    logger = logging.getLogger("moonbot")

    level = level.upper()
    if level == "DEBUG":
        logger.debug(message)
    elif level == "INFO":
        logger.info(message)
    elif level == "WARNING" or level == "WARN":
        logger.warning(message)
    elif level == "ERROR":
        logger.error(message)
    elif level == "CRITICAL":
        logger.critical(message)
    else:
        logger.info(message)


def get_logger(name: str = None) -> logging.Logger:
    """
    Получить logger для модуля (advanced API)

    Args:
        name: Имя модуля (обычно __name__)

    Returns:
        logging.Logger instance

    Example:
        logger = get_logger(__name__)
        logger.info("Processing data...")
        logger.error("Failed to connect")
    """
    if name is None:
        name = "moonbot"
    return logging.getLogger(name)


def log_if_high_load(
    counter_key: str,
    message: str,
    every_n: int = 100,
    level: str = "INFO"
) -> bool:
    """
    Условное логирование для высоких нагрузок.
    
    Логирует сообщение только каждый N-й раз для уменьшения overhead.
    
    Оптимизировано для 3000+ серверов:
    - Минимальный overhead при пропуске логов
    - Thread-safe счётчики
    
    Args:
        counter_key: Уникальный ключ счётчика (например, "balance_update")
        message: Сообщение для логирования
        every_n: Логировать каждый N-й вызов
        level: Уровень логирования
        
    Returns:
        True если сообщение было залогировано
        
    Example:
        log_if_high_load("balance", f"Balance updated for server {server_id}", every_n=500)
    """
    global _log_counters
    
    with _log_counters_lock:
        count = _log_counters.get(counter_key, 0) + 1
        _log_counters[counter_key] = count
    
    if count % every_n == 0:
        log(f"{message} (count: {count})", level=level)
        return True
    
    return False


def get_log_counter(counter_key: str) -> int:
    """
    Получить текущее значение счётчика логов.
    
    Args:
        counter_key: Ключ счётчика
        
    Returns:
        Текущее значение
    """
    with _log_counters_lock:
        return _log_counters.get(counter_key, 0)


def reset_log_counters() -> None:
    """Сбросить все счётчики логов."""
    global _log_counters
    with _log_counters_lock:
        _log_counters.clear()
