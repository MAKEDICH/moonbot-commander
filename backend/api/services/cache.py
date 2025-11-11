"""
Сервис кэширования для частых запросов
"""
import json
import time
from typing import Any, Optional, Callable
from functools import wraps
from config import settings

# Простой in-memory кэш (для продакшена лучше использовать Redis)
_cache = {}
_cache_timestamps = {}


class CacheService:
    """Сервис для кэширования данных"""
    
    @staticmethod
    def get(key: str) -> Optional[Any]:
        """Получить значение из кэша"""
        if not settings.CACHE_ENABLED:
            return None
        
        if key not in _cache:
            return None
        
        # Проверяем TTL
        timestamp = _cache_timestamps.get(key, 0)
        if time.time() - timestamp > settings.CACHE_TTL_SECONDS:
            # Кэш устарел
            CacheService.delete(key)
            return None
        
        return _cache[key]
    
    @staticmethod
    def set(key: str, value: Any, ttl: Optional[int] = None):
        """Сохранить значение в кэш"""
        if not settings.CACHE_ENABLED:
            return
        
        _cache[key] = value
        _cache_timestamps[key] = time.time()
    
    @staticmethod
    def delete(key: str):
        """Удалить значение из кэша"""
        if key in _cache:
            del _cache[key]
        if key in _cache_timestamps:
            del _cache_timestamps[key]
    
    @staticmethod
    def clear():
        """Очистить весь кэш"""
        _cache.clear()
        _cache_timestamps.clear()
    
    @staticmethod
    def clear_pattern(pattern: str):
        """Удалить все ключи, содержащие паттерн"""
        keys_to_delete = [k for k in _cache.keys() if pattern in k]
        for key in keys_to_delete:
            CacheService.delete(key)


def cached(
    ttl: Optional[int] = None,
    key_prefix: str = "",
    key_builder: Optional[Callable] = None
):
    """
    Декоратор для кэширования результатов функции
    
    Args:
        ttl: Time to live в секундах
        key_prefix: Префикс для ключа кэша
        key_builder: Функция для построения ключа кэша
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            if not settings.CACHE_ENABLED:
                return await func(*args, **kwargs)
            
            # Строим ключ кэша
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Дефолтный ключ из имени функции и аргументов
                args_str = json.dumps(
                    {"args": [str(a) for a in args], "kwargs": kwargs},
                    sort_keys=True,
                    default=str
                )
                cache_key = f"{key_prefix}{func.__name__}:{args_str}"
            
            # Проверяем кэш
            cached_value = CacheService.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Выполняем функцию
            result = await func(*args, **kwargs)
            
            # Сохраняем в кэш
            CacheService.set(cache_key, result, ttl)
            
            return result
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            if not settings.CACHE_ENABLED:
                return func(*args, **kwargs)
            
            # Строим ключ кэша
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                args_str = json.dumps(
                    {"args": [str(a) for a in args], "kwargs": kwargs},
                    sort_keys=True,
                    default=str
                )
                cache_key = f"{key_prefix}{func.__name__}:{args_str}"
            
            # Проверяем кэш
            cached_value = CacheService.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Выполняем функцию
            result = func(*args, **kwargs)
            
            # Сохраняем в кэш
            CacheService.set(cache_key, result, ttl)
            
            return result
        
        # Возвращаем нужный wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Вспомогательные функции для построения ключей
def user_cache_key(user_id: int, suffix: str = "") -> str:
    """Построить ключ кэша для пользователя"""
    return f"user:{user_id}:{suffix}"


def server_cache_key(server_id: int, suffix: str = "") -> str:
    """Построить ключ кэша для сервера"""
    return f"server:{server_id}:{suffix}"


def invalidate_user_cache(user_id: int):
    """Инвалидировать весь кэш пользователя"""
    CacheService.clear_pattern(f"user:{user_id}:")


def invalidate_server_cache(server_id: int):
    """Инвалидировать весь кэш сервера"""
    CacheService.clear_pattern(f"server:{server_id}:")


import asyncio

