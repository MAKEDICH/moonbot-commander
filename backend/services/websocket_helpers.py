"""
Helper-функции для WebSocket уведомлений.

Содержит legacy функции для обратной совместимости
и удобные методы отправки типизированных уведомлений.
"""

from utils.datetime_utils import utcnow, format_iso


def notify_sql_log_sync(ws_manager, user_id: int, server_id: int, log_data: dict):
    """Thread-safe уведомление о новой SQL команде"""
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_order_update_sync(ws_manager, user_id: int, server_id: int):
    """Thread-safe уведомление об обновлении ордера"""
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": {"message": "Order updated - refresh needed"},
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_api_error_sync(ws_manager, user_id: int, server_id: int, bot_name: str, count: int):
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


def notify_balance_update_sync(ws_manager, user_id: int, server_id: int, balance_data: dict):
    """Thread-safe уведомление об обновлении баланса"""
    message = {
        "type": "balance_update",
        "server_id": server_id,
        "data": balance_data,
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


def notify_chart_update_sync(ws_manager, user_id: int, server_id: int, chart_data: dict):
    """Thread-safe уведомление о новом графике"""
    message = {
        "type": "chart_update",
        "server_id": server_id,
        "data": chart_data,
        "timestamp": format_iso(utcnow())
    }
    ws_manager.send_message_threadsafe(message, user_id)


async def notify_sql_log(ws_manager, user_id: int, server_id: int, log_data: dict):
    """Уведомить пользователя о новой SQL команде (async версия)"""
    message = {
        "type": "sql_log",
        "server_id": server_id,
        "data": log_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_order_update(ws_manager, user_id: int, server_id: int, order_data: dict):
    """Уведомить пользователя об обновлении ордера (async версия)"""
    message = {
        "type": "order_update",
        "server_id": server_id,
        "data": order_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_server_status(ws_manager, user_id: int, server_id: int, status_data: dict):
    """Уведомить пользователя об изменении статуса сервера"""
    message = {
        "type": "server_status",
        "server_id": server_id,
        "data": status_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_api_error(ws_manager, user_id: int, server_id: int, error_data: dict):
    """Уведомить пользователя об ошибке API (async версия)"""
    message = {
        "type": "api_error",
        "server_id": server_id,
        "data": error_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)


async def notify_balance_update(ws_manager, user_id: int, server_id: int, balance_data: dict):
    """Уведомить пользователя об обновлении баланса (async версия)"""
    message = {
        "type": "balance_update",
        "server_id": server_id,
        "data": balance_data,
        "timestamp": format_iso(utcnow())
    }
    await ws_manager.send_personal_message(message, user_id)
