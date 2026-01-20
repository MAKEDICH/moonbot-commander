"""
Менеджер UDP Listeners

Функции управления listeners (start, stop, status)
"""
from typing import Dict, Optional
from utils.logging import log
from utils.config_loader import get_config_value
from .listener import UDPListener
from .global_socket import GlobalUDPSocket
import os


active_listeners: Dict[int, UDPListener] = {}
global_udp_socket: Optional[GlobalUDPSocket] = None


def get_moonbot_mode() -> str:
    """
    Получить режим работы MoonBot из конфигурации
    
    Returns:
        str: 'local', 'server' или 'auto'
    """
    mode_env = get_config_value('app', 'mode.moonbot_mode_env', default='MOONBOT_MODE')
    default_mode = get_config_value('app', 'mode.default_mode', default='auto')
    moonbot_mode = os.getenv(mode_env, default_mode).lower().strip()
    return moonbot_mode


def start_listener(server_id: int, host: str, port: int, password: Optional[str] = None, keepalive_enabled: bool = True) -> bool:
    """
    Запустить UDP listener для сервера
    
    Args:
        server_id: ID сервера в БД
        host: IP адрес сервера
        port: UDP порт
        password: Пароль HMAC (расшифрованный)
        keepalive_enabled: Включен ли keep-alive
    
    Returns:
        bool: True если успешно запущен
    """
    global active_listeners, global_udp_socket
    
    if server_id in active_listeners:
        existing = active_listeners[server_id]
        if existing.running:
            log(f"[UDP-LISTENER] Server {server_id} already has active listener - returning success")
            return True
        del active_listeners[server_id]
    
    moonbot_mode = get_moonbot_mode()
    
    if moonbot_mode == 'server':
        if global_udp_socket is None or not global_udp_socket.running:
            if global_udp_socket and not global_udp_socket.running:
                log(f"[UDP-LISTENER] [WARN] Previous global socket failed, recreating...")
                global_udp_socket = None
            
            log(f"[UDP-LISTENER] Creating global UDP socket on port 2500...")
            global_udp_socket = GlobalUDPSocket(port=2500)
            success = global_udp_socket.start()
            
            if not success:
                log(f"[UDP-LISTENER] [ERROR] Failed to start global socket")
                global_udp_socket = None
                return False
        
        if not global_udp_socket or not global_udp_socket.running or not global_udp_socket.sock:
            log(f"[UDP-LISTENER] [ERROR] Global socket is not running properly")
            return False
        
        listener = UDPListener(
            server_id=server_id,
            host=host,
            port=port,
            password=password,
            keepalive_enabled=keepalive_enabled,
            global_socket=global_udp_socket
        )
        
        global_udp_socket.register_listener(listener)
        
        success = listener.start()
        
        if success:
            active_listeners[server_id] = listener
            log(f"[UDP-LISTENER] [OK] Registered server {server_id} ({host}) with global socket")
            return True
        else:
            global_udp_socket.unregister_listener(listener)
            return False
    
    else:
        listener = UDPListener(
            server_id=server_id,
            host=host,
            port=port,
            password=password,
            keepalive_enabled=keepalive_enabled,
            global_socket=None
        )
        
        success = listener.start()
        
        if success:
            active_listeners[server_id] = listener
            return True
        else:
            return False


def stop_listener(server_id: int) -> bool:
    """
    Остановить UDP listener для сервера
    
    Args:
        server_id: ID сервера в БД
    
    Returns:
        bool: True если успешно остановлен
    """
    global active_listeners, global_udp_socket
    
    if server_id not in active_listeners:
        log(f"[UDP-LISTENER] No active listener for server {server_id}")
        return False
    
    listener = active_listeners[server_id]
    
    if listener.use_global_socket and global_udp_socket:
        global_udp_socket.unregister_listener(listener)
    
    success = listener.stop()
    
    if success:
        del active_listeners[server_id]
        return True
    else:
        return False


def get_listener_status(server_id: int) -> Dict:
    """
    Получить статус listener
    
    Args:
        server_id: ID сервера
    
    Returns:
        dict: Статус listener
    """
    if server_id in active_listeners:
        listener = active_listeners[server_id]
        return {
            "is_running": listener.running,
            "messages_received": listener.messages_received,
            "last_error": listener.last_error
        }
    else:
        return {
            "is_running": False,
            "messages_received": 0,
            "last_error": None
        }


def stop_all_listeners():
    """Остановить все активные listeners"""
    global active_listeners, global_udp_socket
    
    log("[UDP-LISTENER] Stopping all listeners...")
    
    for server_id in list(active_listeners.keys()):
        stop_listener(server_id)
    
    if global_udp_socket:
        log("[UDP-LISTENER] Stopping global UDP socket...")
        global_udp_socket.stop()
        global_udp_socket = None
    
    log("[UDP-LISTENER] All listeners stopped")




