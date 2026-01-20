"""
Unified helper для отправки команд через UDP
Устраняет дублирование логики listener/direct UDP
"""

from typing import Tuple, Optional
from models import models
from services import udp
from services.udp_client import UDPClient
from services import encryption
from utils.logging import log


async def send_command_unified(
    server: models.Server,
    command: str,
    timeout: float = 5.0,
    use_listener_if_available: bool = True
) -> Tuple[bool, str]:
    """
    Унифицированная отправка команды на сервер.
    Автоматически выбирает listener или прямое UDP подключение.
    
    Args:
        server: Объект сервера из БД
        command: Команда для отправки
        timeout: Таймаут ожидания ответа в секундах
        use_listener_if_available: Использовать listener если он запущен
    
    Returns:
        Tuple[bool, str]: (success, response)
    """
    # Проверяем активен ли listener для этого сервера
    listener = udp.active_listeners.get(server.id) if use_listener_if_available else None
    
    # Расшифровываем пароль
    password = encryption.decrypt_password(server.password) if server.password else None
    
    # Отправка через listener (если доступен)
    if listener and listener.running:
        log(f"[UDP-HELPER] Sending command to server {server.id} through listener")
        try:
            success, response = listener.send_command_with_response(
                command,
                timeout=timeout
            )
            log(f"[UDP-HELPER] Listener response: success={success}")
            return success, response
        except Exception as e:
            log(f"[UDP-HELPER] Error sending through listener: {e}", level="ERROR")
            # Fallback к прямому UDP
            log(f"[UDP-HELPER] Falling back to direct UDP")
    
    # Отправка напрямую через UDP (если listener недоступен или ошибка)
    log(f"[UDP-HELPER] Sending command to server {server.id} directly (no listener)")
    client = UDPClient()
    success, response = await client.send_command(
        server.host,
        server.port,
        command,
        timeout=timeout,
        password=password
    )
    log(f"[UDP-HELPER] Direct UDP response: success={success}")
    return success, response


def send_command_unified_sync(
    server: models.Server,
    command: str,
    timeout: float = 5.0,
    use_listener_if_available: bool = True
) -> Tuple[bool, str]:
    """
    Синхронная версия unified отправки команды (для scheduler).
    
    Args:
        server: Объект сервера из БД
        command: Команда для отправки
        timeout: Таймаут ожидания ответа в секундах
        use_listener_if_available: Использовать listener если он запущен
    
    Returns:
        Tuple[bool, str]: (success, response)
    """
    # Проверяем активен ли listener для этого сервера
    listener = udp.active_listeners.get(server.id) if use_listener_if_available else None
    
    # Расшифровываем пароль
    password = encryption.decrypt_password(server.password) if server.password else None
    
    # Отправка через listener (если доступен)
    if listener and listener.running:
        log(f"[UDP-HELPER] Sending command to server {server.id} through listener (sync)")
        try:
            success, response = listener.send_command_with_response(
                command,
                timeout=timeout
            )
            return success, response
        except Exception as e:
            log(f"[UDP-HELPER] Error sending through listener: {e}", level="ERROR")
            # Fallback к прямому UDP
    
    # Отправка напрямую через UDP
    log(f"[UDP-HELPER] Sending command to server {server.id} directly (sync, no listener)")
    client = UDPClient(timeout=int(timeout))
    success, response = client.send_command_sync(
        server.host,
        server.port,
        command,
        timeout=int(timeout),
        password=password
    )
    return success, response

