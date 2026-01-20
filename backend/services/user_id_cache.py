"""
Кэш user_id для серверов.

Оптимизация для высоких нагрузок - избегает повторных запросов к БД
для получения user_id при обработке UDP сообщений.
"""

import threading
from typing import Optional, Dict

from utils.logging import log


# Глобальный кэш: server_id -> user_id
_server_user_id_cache: Dict[int, int] = {}
_cache_lock = threading.Lock()


def get_user_id_for_server(server_id: int) -> Optional[int]:
    """
    Получить user_id для сервера из кэша.
    
    Args:
        server_id: ID сервера
        
    Returns:
        user_id или None если не найден
    """
    with _cache_lock:
        return _server_user_id_cache.get(server_id)


def set_user_id_for_server(server_id: int, user_id: int) -> None:
    """
    Установить user_id для сервера в кэш.
    
    Args:
        server_id: ID сервера
        user_id: ID пользователя
    """
    with _cache_lock:
        _server_user_id_cache[server_id] = user_id


def remove_user_id_for_server(server_id: int) -> None:
    """
    Удалить user_id для сервера из кэша.
    
    Args:
        server_id: ID сервера
    """
    with _cache_lock:
        _server_user_id_cache.pop(server_id, None)


def get_all_cached_servers() -> Dict[int, int]:
    """
    Получить копию всего кэша.
    
    Returns:
        Словарь server_id -> user_id
    """
    with _cache_lock:
        return _server_user_id_cache.copy()


def clear_cache() -> None:
    """
    Очистить весь кэш.
    """
    with _cache_lock:
        _server_user_id_cache.clear()
    log("[USER-ID-CACHE] Cache cleared")


def populate_cache_from_db() -> int:
    """
    Заполнить кэш из БД.
    
    Returns:
        Количество загруженных записей
    """
    from models.database import SessionLocal
    from models import models
    
    db = SessionLocal()
    try:
        servers = db.query(models.Server).filter(
            models.Server.user_id.isnot(None)
        ).all()
        
        with _cache_lock:
            for server in servers:
                _server_user_id_cache[server.id] = server.user_id
        
        count = len(servers)
        log(f"[USER-ID-CACHE] Populated with {count} servers")
        return count
    except Exception as e:
        log(f"[USER-ID-CACHE] Failed to populate: {e}", level="ERROR")
        return 0
    finally:
        db.close()


def get_cache_stats() -> Dict:
    """
    Получить статистику кэша.
    
    Returns:
        Dict со статистикой
    """
    with _cache_lock:
        return {
            "cached_servers": len(_server_user_id_cache),
            "server_ids": list(_server_user_id_cache.keys())[:10]  # Первые 10 для отладки
        }


