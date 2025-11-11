"""
WebSocket Manager для real-time уведомлений

Отправляет push-уведомления клиентам при:
- Получении новых SQL команд от MoonBot
- Получении новых ордеров
- Обновлении статусов серверов
"""

from fastapi import WebSocket
from typing import Dict, Set, List
import json
import asyncio
from datetime import datetime


class ConnectionManager:
    """
    Управление WebSocket соединениями
    
    Структура:
    active_connections = {
        user_id: {
            connection_id: WebSocket
        }
    }
    """
    
    def __init__(self):
        # Активные соединения: {user_id: {connection_id: WebSocket}}
        self.active_connections: Dict[int, Dict[str, WebSocket]] = {}
        
        # Блокировка для потокобезопасности
        self._lock = asyncio.Lock()
        
        # Event loop (будет установлен при старте FastAPI)
        self._loop = None
    
    def set_event_loop(self, loop):
        """Установить event loop для thread-safe вызовов"""
        self._loop = loop
        print(f"[WS] Event loop set: {loop}")
    
    async def connect(self, websocket: WebSocket, user_id: int, connection_id: str):
        """
        Подключить нового клиента
        
        Args:
            websocket: WebSocket соединение
            user_id: ID пользователя
            connection_id: Уникальный ID соединения
        """
        await websocket.accept()
        
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = {}
            
            self.active_connections[user_id][connection_id] = websocket
        
        print(f"[WS] User {user_id} connected (connection_id: {connection_id})")
        print(f"[WS] Total connections for user {user_id}: {len(self.active_connections[user_id])}")
    
    async def disconnect(self, user_id: int, connection_id: str):
        """
        Отключить клиента
        
        Args:
            user_id: ID пользователя
            connection_id: Уникальный ID соединения
        """
        async with self._lock:
            if user_id in self.active_connections:
                if connection_id in self.active_connections[user_id]:
                    del self.active_connections[user_id][connection_id]
                    print(f"[WS] User {user_id} disconnected (connection_id: {connection_id})")
                
                # Удаляем пользователя если у него нет соединений
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                    print(f"[WS] No more connections for user {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: int):
        """
        Отправить сообщение всем соединениям конкретного пользователя
        
        Args:
            message: Сообщение (будет сериализовано в JSON)
            user_id: ID пользователя
        """
        if user_id not in self.active_connections:
            return
        
        # Получаем копию списка соединений для безопасной итерации
        connections = list(self.active_connections[user_id].items())
        
        # Список соединений для удаления (если отправка не удалась)
        to_remove = []
        
        for connection_id, websocket in connections:
            try:
                await websocket.send_json(message)
            except Exception as e:
                print(f"[WS] Failed to send to user {user_id}, connection {connection_id}: {e}")
                to_remove.append(connection_id)
        
        # Удаляем мертвые соединения
        if to_remove:
            async with self._lock:
                for connection_id in to_remove:
                    if user_id in self.active_connections:
                        if connection_id in self.active_connections[user_id]:
                            del self.active_connections[user_id][connection_id]
    
    def send_message_threadsafe(self, message: dict, user_id: int):
        """
        Thread-safe отправка сообщения (для вызова из UDP listener потока)
        
        Args:
            message: Сообщение
            user_id: ID пользователя
        """
        if not self._loop:
            print(f"[WS] ⚠️ Warning: Event loop not set, cannot send message to user {user_id}")
            return
        
        if user_id not in self.active_connections:
            print(f"[WS] ℹ️ User {user_id} has no active WebSocket connections (0 connections)")
            return
        
        connection_count = len(self.active_connections[user_id])
        print(f"[WS] 📤 Sending message to user {user_id} ({connection_count} connections): type={message.get('type')}")
        
        # Планируем coroutine в главном event loop
        future = asyncio.run_coroutine_threadsafe(
            self.send_personal_message(message, user_id),
            self._loop
        )
        
        # Ждем результат (с timeout)
        try:
            future.result(timeout=1.0)
            print(f"[WS] ✅ Message sent successfully to user {user_id}")
        except Exception as e:
            print(f"[WS] ❌ Error sending message to user {user_id}: {e}")
    
    async def send_to_all(self, message: dict):
        """
        Отправить сообщение всем подключенным клиентам
        
        Args:
            message: Сообщение (будет сериализовано в JSON)
        """
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)
    
    def get_user_connections_count(self, user_id: int) -> int:
        """
        Получить количество активных соединений пользователя
        
        Args:
            user_id: ID пользователя
            
        Returns:
            Количество соединений
        """
        if user_id not in self.active_connections:
            return 0
        return len(self.active_connections[user_id])
    
    def get_total_connections(self) -> int:
        """
        Получить общее количество активных соединений
        
        Returns:
            Количество соединений
        """
        total = 0
        for connections in self.active_connections.values():
            total += len(connections)
        return total


# Глобальный экземпляр менеджера
ws_manager = ConnectionManager()


# ==================== HELPER FUNCTIONS ====================

def notify_sql_log_sync(user_id: int, server_id: int, log_data: dict):
    """
    Thread-safe уведомление о новой SQL команде (для вызова из UDP listener)
    
    Args:
        user_id: ID пользователя
        server_id: ID сервера
        log_data: Данные SQL лога
    """
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_order_update_sync(user_id: int, server_id: int):
    """
    Thread-safe уведомление об обновлении ордера (для вызова из UDP listener)
    
    Args:
        user_id: ID пользователя
        server_id: ID сервера
    """
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": {
            "message": "Order updated - refresh needed"
        },
        "timestamp": datetime.utcnow().isoformat()
    }
    ws_manager.send_message_threadsafe(message, user_id)


async def notify_sql_log(user_id: int, server_id: int, log_data: dict):
    """
    Уведомить пользователя о новой SQL команде (async версия)
    
    Args:
        user_id: ID пользователя
        server_id: ID сервера
        log_data: Данные SQL лога
    """
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_order_update(user_id: int, server_id: int, order_data: dict):
    """
    Уведомить пользователя об обновлении ордера (async версия)
    
    Args:
        user_id: ID пользователя
        server_id: ID сервера
        order_data: Данные ордера
    """
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": order_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_server_status(user_id: int, server_id: int, status_data: dict):
    """
    Уведомить пользователя об изменении статуса сервера
    
    Args:
        user_id: ID пользователя
        server_id: ID сервера
        status_data: Данные статуса
    """
    message = {
        "type": "server_status",
        "server_id": server_id,
        "data": status_data,
        "timestamp": datetime.utcnow().isoformat()
    }
    await ws_manager.send_personal_message(message, user_id)

