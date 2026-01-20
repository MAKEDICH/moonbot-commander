"""
Основной цикл прослушивания UDP Listener

Содержит функцию основного цикла приёма UDP пакетов.

Оптимизировано для 3000+ серверов:
- Использует Worker Pool для параллельной обработки
- Работает во всех режимах (local, server, dev, production)
"""
import socket
import time

from utils.logging import log
from utils.config_loader import get_config_value
from datetime import datetime
from .listener_status import update_listener_status
from .worker_pool import UDPMessage, get_worker_pool, start_worker_pool


def run_listen_loop(listener):
    """
    Основной цикл прослушивания (выполняется в отдельном потоке)
    
    Оптимизирован для высокой нагрузки во всех режимах.
    
    Args:
        listener: Экземпляр UDPListener
    """
    # Загружаем конфигурации из YAML
    socket_timeout = get_config_value('udp', 'udp.timeouts.receive', default=1.0)
    buffer_size = get_config_value('udp', 'udp.socket.buffer_size', default=65535)
    reuse_address = get_config_value('udp', 'udp.socket.reuse_address', default=True)
    
    # Включаем Worker Pool для всех режимов (high-load optimization)
    use_worker_pool = get_config_value('high_load', 'udp.worker_pool.enabled', default=True)
    worker_pool = None
    
    if use_worker_pool:
        try:
            start_worker_pool()
            worker_pool = get_worker_pool()
            log(f"[UDP-LISTENER-{listener.server_id}] Worker Pool enabled for high-load processing")
        except Exception as e:
            log(f"[UDP-LISTENER-{listener.server_id}] Worker Pool init failed, using direct processing: {e}")
    
    try:
        listener.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        if reuse_address:
            listener.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        # Увеличиваем системный буфер приёма для больших пакетов
        _configure_receive_buffer(listener)
        
        listen_port = listener.local_port if listener.local_port > 0 else 0
        
        try:
            listener.sock.bind(("", listen_port))
        except OSError as e:
            if e.errno == 10048:
                log(f"[UDP-LISTENER-{listener.server_id}] [WARN]  Port {listen_port} already in use, using ephemeral port")
                listener.sock.bind(("", 0))
            else:
                raise
        
        listener.sock.settimeout(socket_timeout)
        
        local_addr = listener.sock.getsockname()
        if listen_port == 0:
            log(f"[UDP-LISTENER-{listener.server_id}] [BIND] Listening on EPHEMERAL port {local_addr[1]}")
        else:
            log(f"[UDP-LISTENER-{listener.server_id}] [BIND] Listening on FIXED port {local_addr[1]} (same as Moonbot)")
        log(f"[UDP-LISTENER-{listener.server_id}] Will send commands to {listener.host}:{listener.port}")
        log(f"[UDP-LISTENER-{listener.server_id}] Moonbot will reply to our port {local_addr[1]}")
        
        # Отправляем начальные команды
        _send_initial_commands(listener)
        
        # Основной цикл приёма
        while listener.running:
            try:
                data, addr_tuple = listener.sock.recvfrom(buffer_size)
                addr = addr_tuple[0]
                port = addr_tuple[1]
                
                _process_received_data(listener, data, addr, port)
                
            except socket.timeout:
                continue
            
            except OSError as e:
                if listener.running:
                    _handle_os_error(listener, e)
            
            except Exception as e:
                if listener.running:
                    log(f"[UDP-LISTENER-{listener.server_id}] Receive error: {e}")
                    listener.last_error = str(e)
                    time.sleep(1)
    
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] Fatal error: {e}")
        listener.last_error = str(e)
        update_listener_status(listener.server_id, is_running=False, last_error=str(e))
    
    finally:
        if listener.sock:
            listener.sock.close()
        log(f"[UDP-LISTENER-{listener.server_id}] Loop ended")


def _configure_receive_buffer(listener):
    """Настройка буфера приёма сокета"""
    try:
        # Пробуем установить 8MB, если не получится - меньше
        for buf_size in [8 * 1024 * 1024, 4 * 1024 * 1024, 2 * 1024 * 1024, 1024 * 1024]:
            try:
                listener.sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, buf_size)
                actual_size = listener.sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
                log(f"[UDP-LISTENER-{listener.server_id}] [OK] Set SO_RCVBUF to {actual_size // 1024}KB")
                break
            except Exception:
                continue
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] [WARN] Could not set SO_RCVBUF: {e}")


def _send_initial_commands(listener):
    """Отправка начальных команд после привязки сокета"""
    try:
        time.sleep(0.5)
        log(f"[UDP-LISTENER-{listener.server_id}] 📡 Sending initial 'lst' to establish UDP connection...")
        
        listener._initial_lst_pending = True
        listener._send_command_from_listener("lst")
        log(f"[UDP-LISTENER-{listener.server_id}] [OK] Initial 'lst' sent to {listener.host}:{listener.port}")
        
        # Автоматически подписываемся на графики
        time.sleep(0.2)
        listener._send_command_from_listener("SubscribeCharts")
        log(f"[UDP-LISTENER-{listener.server_id}] 📊 Auto-subscribed to charts")
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Error sending initial commands: {e}")
        import traceback
        traceback.print_exc()


def _process_received_data(listener, data: bytes, addr: str, port: int):
    """
    Обработка полученных данных
    
    Использует Worker Pool для параллельной обработки если доступен.
    
    ВАЖНО: 
    - Если ожидаем ответ на команду - обрабатываем синхронно!
    - Графики (chart packets) обрабатываем синхронно - они фрагментированы
      и ChartFragmentAssembler требует последовательной обработки
    """
    # Если ожидаем ответ на команду (lst, etc) - обрабатываем синхронно
    # чтобы ответ попал в command_response_queue
    if listener.waiting_for_response:
        try:
            result = listener.processor.process_message(data, addr, port)
            if result:
                listener.command_response_queue.put(result)
        except EOFError:
            pass
        except Exception as e:
            log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Command response processing error: {e}")
        
        listener.messages_received += 1
        _update_status_periodically(listener)
        return
    
    # ВАЖНО: Графики обрабатываем синхронно!
    # Они фрагментированы и ChartFragmentAssembler не thread-safe
    # Также это гарантирует что все фрагменты одного графика обрабатываются последовательно
    if listener.processor.chart_processor.is_chart_packet(data):
        try:
            listener.processor.chart_processor.process_chart_packet(data)
        except Exception as e:
            log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Chart processing error: {e}")
        
        listener.messages_received += 1
        _update_status_periodically(listener)
        return
    
    # Проверяем, есть ли Worker Pool для обычных сообщений
    use_worker_pool = get_config_value('high_load', 'udp.worker_pool.enabled', default=True)
    
    if use_worker_pool:
        try:
            worker_pool = get_worker_pool()
            if worker_pool._running:
                # Отправляем в Worker Pool для параллельной обработки
                message = UDPMessage(
                    server_id=listener.server_id,
                    data=data,
                    source_ip=addr,
                    source_port=port,
                    received_at=time.time(),
                    processor=listener.processor
                )
                if worker_pool.submit(message):
                    listener.messages_received += 1
                    _update_status_periodically(listener)
                    return
                # Queue full - fallback to direct processing
        except Exception:
            pass  # Fallback to direct processing
    
    # Direct processing (fallback or if Worker Pool disabled)
    try:
        listener.processor.process_message(data, addr, port)
    except EOFError:
        pass  # Incomplete packet, skip silently
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Message processing error: {e}")
    
    listener.messages_received += 1
    _update_status_periodically(listener)


def _update_status_periodically(listener):
    """Периодическое обновление статуса (каждые 100 сообщений)"""
    if listener.messages_received % 100 == 0:
        try:
            update_listener_status(
                listener.server_id,
                messages_received=listener.messages_received,
                last_message_at=datetime.now()
            )
        except Exception:
            pass  # Не критично


def _handle_os_error(listener, e: OSError):
    """Обработка OSError при приёме данных"""
    error_code = getattr(e, 'winerror', None) or getattr(e, 'errno', None)
    
    # WinError 10040 - пакет больше буфера
    if error_code == 10040 or 'buffer' in str(e).lower():
        log(f"[UDP-LISTENER-{listener.server_id}] ⚠️ Large packet received (likely chart data) - packet was truncated")
        # Пытаемся увеличить буфер для следующих пакетов
        try:
            current_buf = listener.sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
            new_buf = min(current_buf * 2, 8 * 1024 * 1024)  # Максимум 8MB
            listener.sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, new_buf)
            log(f"[UDP-LISTENER-{listener.server_id}] 📈 Increased SO_RCVBUF from {current_buf} to {new_buf}")
        except Exception:
            pass
    else:
        log(f"[UDP-LISTENER-{listener.server_id}] Receive error: {e}")
        listener.last_error = str(e)
        time.sleep(1)

