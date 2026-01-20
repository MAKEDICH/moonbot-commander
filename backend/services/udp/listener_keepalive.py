"""
Keep-alive логика для UDP Listener

Содержит функции для поддержания NAT mapping через периодическую смену портов.
"""
import socket
import threading
import time

from utils.logging import log
from utils.config_loader import get_config_value


def start_keepalive_thread(
    listener,
    keepalive_interval: int = None
) -> threading.Thread:
    """
    Запустить keep-alive поток для сохранения NAT mapping
    
    Args:
        listener: Экземпляр UDPListener
        keepalive_interval: Интервал в секундах (None = загрузить из конфига)
    
    Returns:
        Запущенный поток keep-alive
    """
    if keepalive_interval is None:
        keepalive_interval = get_config_value('udp', 'udp.listener.heartbeat_interval', default=60)
    
    def send_keepalive():
        while listener.running:
            try:
                time.sleep(keepalive_interval)
                
                if not listener.running:
                    break
                
                log(f"[UDP-LISTENER-{listener.server_id}] [KEEPALIVE] Recreating socket with NEW ephemeral port...")
                
                reuse_address = get_config_value('udp', 'udp.socket.reuse_address', default=True)
                socket_timeout = get_config_value('udp', 'udp.timeouts.receive', default=1.0)
                
                new_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                if reuse_address:
                    new_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                
                # Устанавливаем буфер для больших пакетов (графики)
                try:
                    new_sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 1024 * 1024)
                except Exception:
                    pass
                
                new_sock.bind(("", 0))
                new_sock.settimeout(socket_timeout)
                
                local_addr = new_sock.getsockname()
                log(f"[UDP-LISTENER-{listener.server_id}] [KEEPALIVE] New ephemeral port: {local_addr[1]}")
                
                old_sock = listener.sock
                if old_sock:
                    try:
                        old_sock.close()
                        log(f"[UDP-LISTENER-{listener.server_id}] [CLOSE] Old socket closed")
                    except OSError:
                        pass  # Сокет уже закрыт
                
                listener.sock = new_sock
                
                log(f"[UDP-LISTENER-{listener.server_id}] [OK] Listener switched to NEW port {local_addr[1]}")
                
                log(f"[UDP-LISTENER-{listener.server_id}] [SEND] Sending 'lst' from new port...")
                listener._send_command_from_listener("lst")
                
                # Переподписываемся на графики (новый порт = новая подписка)
                time.sleep(0.2)
                listener._send_command_from_listener("SubscribeCharts")
                log(f"[UDP-LISTENER-{listener.server_id}] 📊 Re-subscribed to charts")
                
                log(f"[UDP-LISTENER-{listener.server_id}] [OK] Keep-alive sent! Moonbot will now send to port {local_addr[1]}")
                
            except Exception as e:
                log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Keep-alive error: {e}")
                import traceback
                traceback.print_exc()
    
    keepalive_thread = threading.Thread(
        target=send_keepalive,
        daemon=True,
        name=f"KeepAlive-{listener.server_id}"
    )
    keepalive_thread.start()
    log(f"[UDP-LISTENER-{listener.server_id}] [KEEPALIVE] Keep-alive scheduled (port rotation every {keepalive_interval} sec)")
    
    return keepalive_thread


