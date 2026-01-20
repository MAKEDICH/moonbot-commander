"""
WebSocket Manager для real-time уведомлений

Отправляет push-уведомления клиентам при:
- Получении новых SQL команд от MoonBot
- Получении новых ордеров
- Обновлении статусов серверов

Оптимизирован для высоких нагрузок (3000+ серверов):
- Батчинг сообщений для уменьшения количества отправок
- Сжатие больших сообщений
- Ограничение соединений на пользователя
"""
import gzip
import json
import time
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from fastapi import WebSocket
import asyncio

from utils.config_loader import get_config_value
from utils.logging import log
from utils.datetime_utils import utcnow, format_iso


@dataclass
class MessageBatch:
    """Пакет сообщений для отправки."""
    messages: List[Dict] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)


@dataclass
class ConnectionMetrics:
    """Метрики соединения."""
    messages_sent: int = 0
    messages_batched: int = 0
    bytes_sent: int = 0
    bytes_compressed: int = 0
    errors: int = 0
    last_activity: float = field(default_factory=time.time)


class ConnectionManager:
    """
    Управление WebSocket соединениями с поддержкой высоких нагрузок.
    
    Оптимизации:
    - Батчинг сообщений (группировка нескольких сообщений в один пакет)
    - Сжатие больших сообщений (gzip)
    - Ограничение соединений на пользователя
    - Метрики и мониторинг
    """
    
    def __init__(self):
        # Активные соединения: {user_id: {connection_id: WebSocket}}
        self.active_connections: Dict[int, Dict[str, WebSocket]] = {}
        self._lock = asyncio.Lock()
        self._loop = None
        self.update_notification = None
        
        # Настройки батчинга
        self._batch_enabled = get_config_value(
            'high_load', 'websocket.batch.enabled', default=True
        )
        self._batch_max_size = get_config_value(
            'high_load', 'websocket.batch.max_size', default=50
        )
        self._batch_interval_ms = get_config_value(
            'high_load', 'websocket.batch.interval_ms', default=100
        )
        
        # Настройки сжатия
        self._compression_enabled = get_config_value(
            'high_load', 'websocket.compression.enabled', default=True
        )
        self._compression_min_size = get_config_value(
            'high_load', 'websocket.compression.min_size', default=1024
        )
        
        # Лимиты
        self._max_connections_per_user = get_config_value(
            'high_load', 'websocket.limits.max_connections_per_user', default=10
        )
        self._max_messages_per_second = get_config_value(
            'high_load', 'websocket.limits.max_messages_per_second', default=100
        )
        
        # Буферы и метрики
        self._message_batches: Dict[int, MessageBatch] = defaultdict(MessageBatch)
        self._batch_lock = threading.Lock()
        self._metrics: Dict[str, ConnectionMetrics] = {}
        self._rate_limits: Dict[int, List[float]] = defaultdict(list)
        
        # Глобальные метрики
        self._total_messages_sent = 0
        self._total_bytes_sent = 0
        self._total_connections = 0
        self._flush_task: Optional[asyncio.Task] = None
    
    def set_event_loop(self, loop):
        """Установить event loop для thread-safe вызовов."""
        self._loop = loop
        log(f"[WS] Event loop set: {loop}")
        
        if self._batch_enabled and loop:
            self._flush_task = loop.create_task(self._batch_flush_loop())
    
    async def _batch_flush_loop(self) -> None:
        """Background loop для периодического flush батчей."""
        interval = self._batch_interval_ms / 1000.0
        
        while True:
            try:
                await asyncio.sleep(interval)
                await self._flush_all_batches()
            except asyncio.CancelledError:
                break
            except Exception as e:
                log(f"[WS] Batch flush error: {e}", level="ERROR")
    
    async def _flush_all_batches(self) -> None:
        """Flush всех накопленных батчей."""
        with self._batch_lock:
            batches_to_flush = dict(self._message_batches)
            self._message_batches.clear()
        
        for user_id, batch in batches_to_flush.items():
            if batch.messages:
                await self._send_batch(user_id, batch)
    
    async def _send_batch(self, user_id: int, batch: MessageBatch) -> None:
        """Отправить пакет сообщений пользователю."""
        if not batch.messages:
            return
        
        if len(batch.messages) == 1:
            message = batch.messages[0]
        else:
            message = {
                "type": "batch",
                "messages": batch.messages,
                "count": len(batch.messages),
                "timestamp": format_iso(utcnow())
            }
        
        await self._send_message_internal(message, user_id)
    
    async def _send_message_internal(self, message: dict, user_id: int) -> None:
        """Внутренняя отправка сообщения с поддержкой сжатия."""
        if user_id not in self.active_connections:
            return
        
        json_data = json.dumps(message)
        data_bytes = json_data.encode('utf-8')
        
        use_compression = (
            self._compression_enabled and 
            len(data_bytes) >= self._compression_min_size
        )
        
        if use_compression:
            compressed = gzip.compress(data_bytes)
            send_data = b'\x01' + compressed
        else:
            send_data = json_data
        
        connections = list(self.active_connections[user_id].items())
        to_remove = []
        
        for connection_id, websocket in connections:
            try:
                if use_compression:
                    await websocket.send_bytes(send_data)
                else:
                    await websocket.send_text(send_data)
                
                if connection_id in self._metrics:
                    self._metrics[connection_id].messages_sent += 1
                    self._metrics[connection_id].bytes_sent += len(data_bytes)
                    if use_compression:
                        self._metrics[connection_id].bytes_compressed += len(compressed)
                    self._metrics[connection_id].last_activity = time.time()
                
                self._total_messages_sent += 1
                self._total_bytes_sent += len(data_bytes)
                
            except Exception as e:
                log(f"[WS] Failed to send to user {user_id}, connection {connection_id}: {e}",
                    level="ERROR")
                to_remove.append(connection_id)
                if connection_id in self._metrics:
                    self._metrics[connection_id].errors += 1
        
        if to_remove:
            async with self._lock:
                for connection_id in to_remove:
                    if user_id in self.active_connections:
                        if connection_id in self.active_connections[user_id]:
                            del self.active_connections[user_id][connection_id]
                            if connection_id in self._metrics:
                                del self._metrics[connection_id]
    
    async def connect(self, websocket: WebSocket, user_id: int, connection_id: str):
        """Подключить нового клиента."""
        async with self._lock:
            current_connections = len(self.active_connections.get(user_id, {}))
            if current_connections >= self._max_connections_per_user:
                log(f"[WS] User {user_id} exceeded connection limit ({current_connections})",
                    level="WARNING")
                await websocket.close(code=1008, reason="Too many connections")
                return
        
        await websocket.accept()
        
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = {}
            
            self.active_connections[user_id][connection_id] = websocket
            self._metrics[connection_id] = ConnectionMetrics()
            self._total_connections += 1
        
        log(f"[WS] User {user_id} connected (connection_id: {connection_id})")
        log(f"[WS] Total connections for user {user_id}: {len(self.active_connections[user_id])}")
        
        if self.update_notification:
            try:
                await websocket.send_json(self.update_notification)
                log(f"[WS] Sent update notification to user {user_id}")
            except Exception as e:
                log(f"[WS] Failed to send update notification: {e}")
    
    async def disconnect(self, user_id: int, connection_id: str):
        """Отключить клиента."""
        async with self._lock:
            if user_id in self.active_connections:
                if connection_id in self.active_connections[user_id]:
                    del self.active_connections[user_id][connection_id]
                    if connection_id in self._metrics:
                        del self._metrics[connection_id]
                    log(f"[WS] User {user_id} disconnected (connection_id: {connection_id})")
                
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    if user_id in self._rate_limits:
                        del self._rate_limits[user_id]
                    with self._batch_lock:
                        if user_id in self._message_batches:
                            del self._message_batches[user_id]
                    log(f"[WS] No more connections for user {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """Отправить сообщение всем соединениям пользователя."""
        if user_id not in self.active_connections:
            return
        
        if not self._check_rate_limit(user_id):
            log(f"[WS] Rate limit exceeded for user {user_id}", level="WARNING")
            return
        
        if self._batch_enabled:
            with self._batch_lock:
                if user_id not in self._message_batches:
                    self._message_batches[user_id] = MessageBatch()
                
                batch = self._message_batches[user_id]
                batch.messages.append(message)
                
                if len(batch.messages) >= self._batch_max_size:
                    messages = batch.messages
                    self._message_batches[user_id] = MessageBatch()
                    asyncio.create_task(
                        self._send_batch(user_id, MessageBatch(messages=messages))
                    )
            return
        
        await self._send_message_internal(message, user_id)
    
    def _check_rate_limit(self, user_id: int) -> bool:
        """Проверить rate limit для пользователя."""
        current_time = time.time()
        window = 1.0
        
        self._rate_limits[user_id] = [
            ts for ts in self._rate_limits[user_id]
            if current_time - ts < window
        ]
        
        if len(self._rate_limits[user_id]) >= self._max_messages_per_second:
            return False
        
        self._rate_limits[user_id].append(current_time)
        return True
    
    def send_message_threadsafe(self, message: dict, user_id: int):
        """Thread-safe отправка сообщения (для вызова из UDP listener потока)."""
        if not self._loop:
            return
        
        if user_id not in self.active_connections:
            return
        
        try:
            asyncio.run_coroutine_threadsafe(
                self.send_personal_message(message, user_id),
                self._loop
            )
        except Exception:
            pass
    
    async def send_to_all(self, message: dict):
        """Отправить сообщение всем подключенным клиентам."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)
    
    def get_user_connections_count(self, user_id: int) -> int:
        """Получить количество активных соединений пользователя."""
        if user_id not in self.active_connections:
            return 0
        return len(self.active_connections[user_id])
    
    def get_total_connections(self) -> int:
        """Получить общее количество активных соединений."""
        total = 0
        for connections in self.active_connections.values():
            total += len(connections)
        return total
    
    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику WebSocket менеджера."""
        return {
            "total_connections": self.get_total_connections(),
            "total_users": len(self.active_connections),
            "total_messages_sent": self._total_messages_sent,
            "total_bytes_sent": self._total_bytes_sent,
            "batch_enabled": self._batch_enabled,
            "compression_enabled": self._compression_enabled,
            "pending_batches": sum(len(b.messages) for b in self._message_batches.values()),
        }
    
    def get_connection_metrics(self, connection_id: str) -> Optional[Dict[str, Any]]:
        """Получить метрики конкретного соединения."""
        metrics = self._metrics.get(connection_id)
        if not metrics:
            return None
        
        return {
            "messages_sent": metrics.messages_sent,
            "messages_batched": metrics.messages_batched,
            "bytes_sent": metrics.bytes_sent,
            "bytes_compressed": metrics.bytes_compressed,
            "errors": metrics.errors,
            "last_activity": metrics.last_activity,
            "compression_ratio": (
                metrics.bytes_compressed / metrics.bytes_sent 
                if metrics.bytes_sent > 0 else 0
            ),
        }


# Глобальный экземпляр менеджера
ws_manager = ConnectionManager()


# ==================== LEGACY HELPER FUNCTIONS ====================
# Для обратной совместимости сохраняем функции на уровне модуля

def notify_sql_log_sync(user_id: int, server_id: int, log_data: dict):
    """Thread-safe уведомление о новой SQL команде"""
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_order_update_sync(user_id: int, server_id: int):
    """Thread-safe уведомление об обновлении ордера"""
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": {"message": "Order updated - refresh needed"},
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_api_error_sync(user_id: int, server_id: int, bot_name: str, count: int):
    """Thread-safe уведомление об ошибках API"""
    message = {
        "type": "api_error",
        "server_id": server_id,
        "data": {
            "bot_name": bot_name,
            "error_count": count,
            "message": f"Получено {count} ошибок API от {bot_name}"
        },
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


async def notify_sql_log(user_id: int, server_id: int, log_data: dict):
    """Уведомить пользователя о новой SQL команде (async версия)"""
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_order_update(user_id: int, server_id: int, order_data: dict):
    """Уведомить пользователя об обновлении ордера (async версия)"""
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": order_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_server_status(user_id: int, server_id: int, status_data: dict):
    """Уведомить пользователя об изменении статуса сервера"""
    message = {
        "type": "server_status",
        "server_id": server_id,
        "data": status_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)
