"""
Redis Cache Service для высоконагруженных операций

Обеспечивает:
- Распределённое кэширование для 3000+ серверов
- Pub/Sub для real-time уведомлений между инстансами
- Очереди задач для асинхронной обработки
- Rate limiting
"""
import json
import os
import time
from typing import Any, Callable, Dict, Optional, Union
from functools import wraps

from utils.config_loader import get_config_value
from utils.logging import log
from .redis_fallback import InMemoryFallback

# Пытаемся импортировать redis
try:
    import redis.asyncio as aioredis
    from redis.asyncio import Redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    log("[REDIS] redis package not installed, using fallback in-memory cache", level="WARNING")


class RedisCache:
    """
    Сервис кэширования на Redis.
    
    Поддерживает:
    - Автоматический fallback на in-memory если Redis недоступен
    - Сериализацию/десериализацию JSON
    - Паттерн-based операции
    - Rate limiting
    """
    
    def __init__(self):
        self._client: Optional[Union[Redis, InMemoryFallback]] = None
        self._connected = False
        self._use_fallback = False
        
        # Загружаем настройки
        self._url_env = get_config_value('high_load', 'redis.url_env', default='REDIS_URL')
        self._default_url = get_config_value(
            'high_load', 'redis.default_url', default='redis://localhost:6379/0'
        )
        self._default_ttl = get_config_value(
            'high_load', 'redis.cache.default_ttl', default=300
        )
        self._balance_ttl = get_config_value(
            'high_load', 'redis.cache.balance_ttl', default=10
        )
        self._strategies_ttl = get_config_value(
            'high_load', 'redis.cache.strategies_ttl', default=60
        )
    
    async def connect(self) -> bool:
        """
        Подключиться к Redis.
        
        Returns:
            True если подключение успешно
        """
        if self._connected:
            return True
        
        if not REDIS_AVAILABLE:
            log("[REDIS] Using in-memory fallback (redis package not available)")
            self._client = InMemoryFallback()
            self._use_fallback = True
            self._connected = True
            return True
        
        redis_url = os.getenv(self._url_env, self._default_url)
        
        try:
            self._client = aioredis.from_url(
                redis_url,
                encoding="utf-8",
                decode_responses=True,
                max_connections=get_config_value('high_load', 'redis.pool.max_connections', default=100),
                socket_timeout=get_config_value('high_load', 'redis.pool.timeout', default=5),
            )
            
            # Проверяем соединение
            await self._client.ping()
            
            self._connected = True
            self._use_fallback = False
            log(f"[REDIS] Connected to {redis_url}")
            return True
            
        except Exception as e:
            log(f"[REDIS] Connection failed: {e}, using fallback", level="WARNING")
            self._client = InMemoryFallback()
            self._use_fallback = True
            self._connected = True
            return True
    
    async def disconnect(self) -> None:
        """Отключиться от Redis."""
        if self._client and not self._use_fallback:
            await self._client.close()
        self._connected = False
        log("[REDIS] Disconnected")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Получить значение из кэша.
        
        Args:
            key: Ключ
            
        Returns:
            Значение или None
        """
        if not self._connected:
            await self.connect()
        
        try:
            value = await self._client.get(key)
            if value is None:
                return None
            
            # Пытаемся десериализовать JSON
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
                
        except Exception as e:
            log(f"[REDIS] Get error for key {key}: {e}", level="ERROR")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """
        Установить значение в кэш.
        
        Args:
            key: Ключ
            value: Значение
            ttl: Time to live (секунды)
            
        Returns:
            True если успешно
        """
        if not self._connected:
            await self.connect()
        
        try:
            # Сериализуем в JSON если нужно
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            elif not isinstance(value, str):
                value = str(value)
            
            ttl = ttl or self._default_ttl
            await self._client.set(key, value, ex=ttl)
            return True
            
        except Exception as e:
            log(f"[REDIS] Set error for key {key}: {e}", level="ERROR")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Удалить ключ.
        
        Args:
            key: Ключ
            
        Returns:
            True если удалён
        """
        if not self._connected:
            await self.connect()
        
        try:
            result = await self._client.delete(key)
            return result > 0
        except Exception as e:
            log(f"[REDIS] Delete error for key {key}: {e}", level="ERROR")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Удалить ключи по паттерну.
        
        Args:
            pattern: Паттерн (например, "balance:*")
            
        Returns:
            Количество удалённых ключей
        """
        if not self._connected:
            await self.connect()
        
        try:
            keys = await self._client.keys(pattern)
            if keys:
                return await self._client.delete(*keys)
            return 0
        except Exception as e:
            log(f"[REDIS] Delete pattern error for {pattern}: {e}", level="ERROR")
            return 0
    
    # === СПЕЦИАЛИЗИРОВАННЫЕ МЕТОДЫ ДЛЯ MOONBOT ===
    
    async def get_balance(self, server_id: int) -> Optional[Dict]:
        """Получить кэшированный баланс сервера."""
        return await self.get(f"balance:{server_id}")
    
    async def set_balance(
        self, 
        server_id: int, 
        available: float, 
        total: float,
        bot_name: Optional[str] = None,
        is_running: Optional[bool] = None,
        version: Optional[int] = None
    ) -> bool:
        """Кэшировать баланс сервера."""
        data = {
            "available": available,
            "total": total,
            "bot_name": bot_name,
            "is_running": is_running,
            "version": version,
            "cached_at": time.time(),
        }
        return await self.set(f"balance:{server_id}", data, ttl=self._balance_ttl)
    
    async def get_strategies(self, server_id: int) -> Optional[Dict]:
        """Получить кэшированные стратегии сервера."""
        return await self.get(f"strategies:{server_id}")
    
    async def set_strategies(self, server_id: int, strategies: Dict) -> bool:
        """Кэшировать стратегии сервера."""
        strategies["cached_at"] = time.time()
        return await self.set(f"strategies:{server_id}", strategies, ttl=self._strategies_ttl)
    
    async def get_server_status(self, server_id: int) -> Optional[Dict]:
        """Получить кэшированный статус сервера."""
        return await self.get(f"status:{server_id}")
    
    async def set_server_status(self, server_id: int, status: Dict) -> bool:
        """Кэшировать статус сервера."""
        status["cached_at"] = time.time()
        return await self.set(f"status:{server_id}", status, ttl=30)
    
    # === RATE LIMITING ===
    
    async def check_rate_limit(
        self, 
        key: str, 
        max_requests: int, 
        window_seconds: int
    ) -> bool:
        """
        Проверить rate limit.
        
        Args:
            key: Ключ (например, "api:user:123")
            max_requests: Максимум запросов
            window_seconds: Окно в секундах
            
        Returns:
            True если лимит не превышен
        """
        if not self._connected:
            await self.connect()
        
        try:
            rate_key = f"rate:{key}"
            current = await self._client.incr(rate_key)
            
            if current == 1:
                await self._client.expire(rate_key, window_seconds)
            
            return current <= max_requests
            
        except Exception as e:
            log(f"[REDIS] Rate limit error: {e}", level="ERROR")
            return True  # Пропускаем при ошибках
    
    # === СТАТИСТИКА ===
    
    async def get_stats(self) -> Dict[str, Any]:
        """
        Получить статистику Redis.
        
        Returns:
            Dict со статистикой
        """
        return {
            "connected": self._connected,
            "using_fallback": self._use_fallback,
            "default_ttl": self._default_ttl,
        }


# Глобальный экземпляр
_redis_cache: Optional[RedisCache] = None


async def get_redis_cache() -> RedisCache:
    """
    Получить глобальный экземпляр Redis cache.
    
    Returns:
        RedisCache
    """
    global _redis_cache
    if _redis_cache is None:
        _redis_cache = RedisCache()
        await _redis_cache.connect()
    return _redis_cache


async def close_redis_cache() -> None:
    """Закрыть Redis соединение."""
    global _redis_cache
    if _redis_cache:
        await _redis_cache.disconnect()
        _redis_cache = None


def cached_async(
    ttl: Optional[int] = None,
    key_prefix: str = "",
    key_builder: Optional[Callable] = None
):
    """
    Декоратор для кэширования результатов async функций в Redis.
    
    Args:
        ttl: Time to live (секунды)
        key_prefix: Префикс ключа
        key_builder: Функция для построения ключа
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache = await get_redis_cache()
            
            # Строим ключ
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
            cached = await cache.get(cache_key)
            if cached is not None:
                return cached
            
            # Выполняем функцию
            result = await func(*args, **kwargs)
            
            # Сохраняем в кэш
            await cache.set(cache_key, result, ttl=ttl)
            
            return result
        
        return wrapper
    return decorator
