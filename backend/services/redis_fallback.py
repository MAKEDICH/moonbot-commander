"""
In-memory fallback кэш если Redis недоступен.

Оптимизирован для 3000+ серверов:
- Минимальное использование locks (только для модификаций)
- Ленивая очистка просроченных ключей
- Периодическая очистка для предотвращения memory leak
"""

import asyncio
import re
import time
from typing import Any, Dict, List, Optional


class InMemoryFallback:
    """
    Fallback in-memory кэш если Redis недоступен.
    
    Оптимизирован для 3000+ серверов:
    - Минимальное использование locks (только для модификаций)
    - Ленивая очистка просроченных ключей
    - Периодическая очистка для предотвращения memory leak
    """
    
    # Максимальный размер кэша (защита от memory leak)
    MAX_CACHE_SIZE = 100000
    # Интервал принудительной очистки (секунды)
    CLEANUP_INTERVAL = 60
    
    def __init__(self):
        self._cache: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        self._lock = asyncio.Lock()
        self._last_cleanup = time.time()
    
    def _is_expired(self, key: str) -> bool:
        """Проверить истёк ли ключ (без lock)."""
        if key in self._expiry:
            return time.time() > self._expiry[key]
        return False
    
    def _lazy_cleanup(self) -> None:
        """Ленивая очистка просроченных ключей (вызывается периодически)."""
        now = time.time()
        if now - self._last_cleanup < self.CLEANUP_INTERVAL:
            return
        
        self._last_cleanup = now
        expired = [k for k, exp in self._expiry.items() if now > exp]
        for k in expired:
            self._cache.pop(k, None)
            self._expiry.pop(k, None)
        
        # Защита от переполнения памяти
        if len(self._cache) > self.MAX_CACHE_SIZE:
            # Удаляем 20% самых старых ключей
            to_remove = len(self._cache) - int(self.MAX_CACHE_SIZE * 0.8)
            sorted_keys = sorted(self._expiry.items(), key=lambda x: x[1])[:to_remove]
            for k, _ in sorted_keys:
                self._cache.pop(k, None)
                self._expiry.pop(k, None)
    
    async def get(self, key: str) -> Optional[str]:
        """Получить значение (lock-free для чтения)."""
        # Проверяем истечение без lock
        if self._is_expired(key):
            # Удаляем с lock
            async with self._lock:
                self._cache.pop(key, None)
                self._expiry.pop(key, None)
            return None
        return self._cache.get(key)
    
    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        """Установить значение."""
        async with self._lock:
            self._lazy_cleanup()
            self._cache[key] = value
            if ex:
                self._expiry[key] = time.time() + ex
            return True
    
    async def delete(self, key: str) -> int:
        """Удалить ключ."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._expiry.pop(key, None)
                return 1
            return 0
    
    async def exists(self, key: str) -> int:
        """Проверить существование ключа (lock-free)."""
        if self._is_expired(key):
            return 0
        return 1 if key in self._cache else 0
    
    async def incr(self, key: str) -> int:
        """Инкрементировать значение."""
        async with self._lock:
            val = int(self._cache.get(key, 0)) + 1
            self._cache[key] = str(val)
            return val
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Установить TTL."""
        async with self._lock:
            if key in self._cache:
                self._expiry[key] = time.time() + seconds
                return True
            return False
    
    async def keys(self, pattern: str) -> List[str]:
        """Получить ключи по паттерну."""
        async with self._lock:
            self._lazy_cleanup()
            
            # Фильтруем по паттерну
            pattern_regex = pattern.replace('*', '.*')
            regex = re.compile(f"^{pattern_regex}$")
            return [k for k in self._cache.keys() if regex.match(k)]
    
    async def mget(self, keys: List[str]) -> List[Optional[str]]:
        """Получить несколько значений (оптимизировано)."""
        results = []
        for k in keys:
            if self._is_expired(k):
                results.append(None)
            else:
                results.append(self._cache.get(k))
        return results
    
    async def mset(self, mapping: Dict[str, str]) -> bool:
        """Установить несколько значений (одна операция с lock)."""
        async with self._lock:
            self._lazy_cleanup()
            self._cache.update(mapping)
            return True
    
    async def ping(self) -> bool:
        """Проверить соединение."""
        return True
    
    async def close(self) -> None:
        """Закрыть соединение."""
        pass
    
    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику кэша."""
        return {
            "cache_size": len(self._cache),
            "expiry_count": len(self._expiry),
            "max_size": self.MAX_CACHE_SIZE,
        }


