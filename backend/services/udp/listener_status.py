"""
Обновление статуса UDP Listener

Содержит функции для обновления статуса listener в базе данных.

Оптимизировано для 3000+ серверов:
- In-memory кэширование статуса
- Батчевое обновление в БД
- Минимизация запросов к БД
"""
import threading
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from utils.config_loader import get_config_value


@dataclass
class ListenerStatusCache:
    """Кэш статуса listener."""
    server_id: int
    is_running: bool = False
    started_at: Optional[datetime] = None
    messages_received: int = 0
    last_message_at: Optional[datetime] = None
    last_error: Optional[str] = None
    last_db_update: float = 0  # timestamp последнего обновления в БД
    dirty: bool = False  # Требуется ли обновление в БД


# Глобальный кэш статусов (thread-safe)
_status_cache: Dict[int, ListenerStatusCache] = {}
_cache_lock = threading.Lock()

# Настройки
_db_update_interval = 30.0  # Обновлять БД не чаще чем раз в N секунд
_flush_thread: Optional[threading.Thread] = None
_running = False


def update_listener_status(server_id: int, **kwargs):
    """
    Обновление статуса listener (оптимизировано для 3000+ серверов)
    
    Использует in-memory кэш и батчевое обновление в БД.
    
    Args:
        server_id: ID сервера
        **kwargs: Поля для обновления (is_running, started_at, messages_received, etc.)
    """
    global _status_cache
    
    with _cache_lock:
        if server_id not in _status_cache:
            _status_cache[server_id] = ListenerStatusCache(server_id=server_id)
        
        cache = _status_cache[server_id]
        
        # Обновляем кэш
        for key, value in kwargs.items():
            if hasattr(cache, key):
                setattr(cache, key, value)
        
        cache.dirty = True
        
        # Обновляем БД только если прошло достаточно времени
        current_time = time.time()
        if current_time - cache.last_db_update >= _db_update_interval:
            _flush_status_to_db(server_id, cache)
            cache.last_db_update = current_time
            cache.dirty = False


def _flush_status_to_db(server_id: int, cache: ListenerStatusCache):
    """
    Записать статус в БД.
    
    Args:
        server_id: ID сервера
        cache: Кэш статуса
    """
    db = SessionLocal()
    try:
        status = db.query(models.UDPListenerStatus).filter(
            models.UDPListenerStatus.server_id == server_id
        ).first()
        
        if not status:
            status = models.UDPListenerStatus(server_id=server_id)
            db.add(status)
        
        # Копируем поля из кэша
        status.is_running = cache.is_running
        status.started_at = cache.started_at
        status.messages_received = cache.messages_received
        status.last_message_at = cache.last_message_at
        status.last_error = cache.last_error
        
        db.commit()
    except Exception as e:
        db.rollback()
        # Не логируем каждую ошибку - только критические
    finally:
        db.close()


def get_listener_status_cached(server_id: int) -> Optional[Dict[str, Any]]:
    """
    Получить статус listener из кэша (без запроса к БД).
    
    Args:
        server_id: ID сервера
        
    Returns:
        Dict со статусом или None
    """
    with _cache_lock:
        cache = _status_cache.get(server_id)
        if cache:
            return {
                "server_id": cache.server_id,
                "is_running": cache.is_running,
                "started_at": cache.started_at,
                "messages_received": cache.messages_received,
                "last_message_at": cache.last_message_at,
                "last_error": cache.last_error,
            }
    return None


def start_status_flush_thread():
    """Запустить фоновый поток для периодического flush статусов в БД."""
    global _flush_thread, _running
    
    if _running:
        return
    
    _running = True
    _flush_thread = threading.Thread(
        target=_flush_loop,
        daemon=True,
        name="ListenerStatusFlusher"
    )
    _flush_thread.start()
    log("[LISTENER-STATUS] Background flush thread started")


def stop_status_flush_thread():
    """Остановить фоновый поток и выполнить финальный flush."""
    global _running
    
    _running = False
    
    # Финальный flush всех dirty статусов
    _flush_all_dirty()
    
    log("[LISTENER-STATUS] Background flush thread stopped")


def _flush_loop():
    """Фоновый цикл для периодического flush статусов."""
    flush_interval = get_config_value('high_load', 'monitoring.health.check_interval', default=30)
    
    while _running:
        try:
            time.sleep(flush_interval)
            _flush_all_dirty()
        except Exception as e:
            log(f"[LISTENER-STATUS] Flush loop error: {e}", level="ERROR")


def _flush_all_dirty():
    """Записать все dirty статусы в БД."""
    with _cache_lock:
        dirty_servers = [
            (server_id, cache) 
            for server_id, cache in _status_cache.items() 
            if cache.dirty
        ]
    
    if not dirty_servers:
        return
    
    db = SessionLocal()
    try:
        for server_id, cache in dirty_servers:
            status = db.query(models.UDPListenerStatus).filter(
                models.UDPListenerStatus.server_id == server_id
            ).first()
            
            if not status:
                status = models.UDPListenerStatus(server_id=server_id)
                db.add(status)
            
            status.is_running = cache.is_running
            status.started_at = cache.started_at
            status.messages_received = cache.messages_received
            status.last_message_at = cache.last_message_at
            status.last_error = cache.last_error
            
            with _cache_lock:
                cache.dirty = False
                cache.last_db_update = time.time()
        
        db.commit()
    except Exception as e:
        db.rollback()
        log(f"[LISTENER-STATUS] Batch flush error: {e}", level="ERROR")
    finally:
        db.close()


# ==================== SERVER ONLINE STATUS ====================

# Кэш времени последнего обновления online статуса (чтобы не обновлять слишком часто)
_online_status_cache: Dict[int, float] = {}
_online_status_lock = threading.Lock()
_online_update_interval = 10.0  # Обновлять не чаще чем раз в 10 секунд


def cleanup_server_caches(server_id: int):
    """
    Очистить все кэши для удалённого сервера.
    
    Вызывается при удалении сервера для предотвращения memory leak.
    
    Args:
        server_id: ID сервера
    """
    global _status_cache, _online_status_cache
    
    with _cache_lock:
        if server_id in _status_cache:
            del _status_cache[server_id]
    
    with _online_status_lock:
        if server_id in _online_status_cache:
            del _online_status_cache[server_id]
    
    log(f"[LISTENER-STATUS] Cleaned up caches for server {server_id}")


def update_server_online_status(server_id: int):
    """
    Обновить статус сервера как online при получении данных.
    
    Вызывается при успешном получении баланса или других данных от MoonBot.
    Оптимизировано для 3000+ серверов - обновляет не чаще чем раз в 10 сек.
    
    Args:
        server_id: ID сервера
    """
    current_time = time.time()
    
    # Проверяем, нужно ли обновлять (не чаще чем раз в N секунд)
    with _online_status_lock:
        last_update = _online_status_cache.get(server_id, 0)
        if current_time - last_update < _online_update_interval:
            return  # Слишком рано для обновления
        _online_status_cache[server_id] = current_time
    
    # Обновляем в БД
    db = SessionLocal()
    try:
        server_status = db.query(models.ServerStatus).filter(
            models.ServerStatus.server_id == server_id
        ).first()
        
        if not server_status:
            # Создаём запись если не существует
            server_status = models.ServerStatus(
                server_id=server_id,
                is_online=True,
                last_ping=utcnow(),
                uptime_percentage=100.0,
                consecutive_failures=0
            )
            db.add(server_status)
        else:
            # Обновляем существующую
            server_status.is_online = True
            server_status.last_ping = utcnow()
            server_status.last_error = None
            server_status.consecutive_failures = 0
            # Улучшаем uptime
            current_uptime = server_status.uptime_percentage or 100.0
            server_status.uptime_percentage = min(100.0, current_uptime * 0.99 + 100.0 * 0.01)
        
        db.commit()
    except Exception as e:
        db.rollback()
        # Не логируем каждую ошибку для производительности
    finally:
        db.close()

