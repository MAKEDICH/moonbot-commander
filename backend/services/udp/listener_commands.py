"""
Отправка команд для UDP Listener

Содержит функции для отправки команд на MoonBot сервер.
"""
import hmac
import hashlib
import queue
import time

from utils.logging import log
from utils.config_loader import get_config_value


def send_command_with_response(
    listener,
    command: str,
    timeout: float = None
) -> tuple:
    """
    Отправка команды через listener socket и ожидание ответа через queue
    
    Args:
        listener: Экземпляр UDPListener
        command: Команда для отправки
        timeout: Таймаут ожидания ответа
    
    Returns:
        tuple[bool, str]: (успех, ответ от MoonBot)
    """
    try:
        # Загружаем таймаут из конфига, если не передан
        if timeout is None:
            timeout = get_config_value('udp', 'udp.timeouts.command', default=10.0)
        
        if listener.use_global_socket:
            if not listener.global_socket or not listener.global_socket.running or not listener.global_socket.sock:
                return False, "Global socket не готов"
        else:
            if not listener.sock:
                return False, "Listener socket не создан"
        
        # Очищаем очередь от старых ответов
        while not listener.command_response_queue.empty():
            try:
                listener.command_response_queue.get_nowait()
            except queue.Empty:
                break
        
        listener.waiting_for_response = True
        
        # Формируем payload с HMAC если есть пароль
        if listener.password:
            h = hmac.new(
                listener.password.encode('utf-8'),
                command.encode('utf-8'),
                hashlib.sha256
            )
            hmac_hex = h.hexdigest()
            payload = f"{hmac_hex} {command}"
            
            password_masked = f"{listener.password[:4]}****{listener.password[-4:]}" if len(listener.password) > 8 else "****"
            log(f"[UDP-LISTENER-{listener.server_id}] [SEND] Sending command with response:")
            log(f"  Command: {command}")
            log(f"  Target: {listener.host}:{listener.port}")
            log(f"  Password: {password_masked}")
            log(f"  HMAC: {hmac_hex[:16]}...")
        else:
            payload = command
            log(f"[UDP-LISTENER-{listener.server_id}] [SEND] Sending command with response (no password):")
            log(f"  Command: {command}")
            log(f"  Target: {listener.host}:{listener.port}")
        
        # Отправляем через соответствующий сокет
        if listener.use_global_socket and listener.global_socket:
            listener.global_socket.sock.sendto(
                payload.encode('utf-8'),
                (listener.host, listener.port)
            )
        else:
            listener.sock.sendto(
                payload.encode('utf-8'),
                (listener.host, listener.port)
            )
        
        log(f"[UDP-LISTENER-{listener.server_id}] [OK] Command sent, waiting for response in queue...")
        
        try:
            response = listener.command_response_queue.get(timeout=timeout)
            log(f"[UDP-LISTENER-{listener.server_id}] 📥 Response received from queue: {response[:100]}...")
            
            if response.startswith('ERR'):
                return False, response
            
            return True, response
            
        except queue.Empty:
            log(f"[UDP-LISTENER-{listener.server_id}] ⏱️ Timeout waiting for response in queue")
            return False, "Timeout: не получен ответ от сервера"
        finally:
            listener.waiting_for_response = False
            
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Failed to send command with response: {e}")
        listener.waiting_for_response = False
        return False, f"Ошибка: {str(e)}"


def send_command_from_listener(listener, command: str):
    """
    Отправка команды через сокет listener
    
    Args:
        listener: Экземпляр UDPListener
        command: Команда для отправки
    """
    try:
        if listener.use_global_socket and listener.global_socket:
            success = listener.global_socket.send_command(
                command=command,
                target_host=listener.host,
                target_port=listener.port,
                password=listener.password
            )
            if success:
                log(f"[UDP-LISTENER-{listener.server_id}] [OK] Command sent via global socket")
            else:
                log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Failed to send via global socket")
            return
        
        # Формируем payload с HMAC если есть пароль
        if listener.password:
            h = hmac.new(
                listener.password.encode('utf-8'),
                command.encode('utf-8'),
                hashlib.sha256
            )
            hmac_hex = h.hexdigest()
            payload = f"{hmac_hex} {command}"
            
            password_masked = f"{listener.password[:4]}****{listener.password[-4:]}" if len(listener.password) > 8 else "****"
            log(f"[UDP-LISTENER-{listener.server_id}] [SEND] Sending command from listener:")
            log(f"  Command: {command}")
            log(f"  Target: {listener.host}:{listener.port}")
            log(f"  Password: {password_masked}")
            log(f"  HMAC: {hmac_hex[:16]}...")
        else:
            payload = command
            log(f"[UDP-LISTENER-{listener.server_id}] [SEND] Sending command (no password):")
            log(f"  Command: {command}")
            log(f"  Target: {listener.host}:{listener.port}")
        
        if listener.sock:
            try:
                listener.sock.sendto(
                    payload.encode('utf-8'),
                    (listener.host, listener.port)
                )
                log(f"[UDP-LISTENER-{listener.server_id}] [OK] Command sent successfully")
            except Exception as e:
                log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Failed to send command: {e}")
                raise
        else:
            log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Socket not initialized!")
    except Exception as e:
        log(f"[UDP-LISTENER-{listener.server_id}] [ERROR] Failed to send command: {e}")


