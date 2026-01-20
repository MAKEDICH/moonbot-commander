"""
UDP Listener - основной класс для прослушивания MoonBot

Запускается в отдельном потоке и непрерывно слушает UDP порт.

Модуль разбит на подмодули:
- listener_loop.py - основной цикл прослушивания
- listener_commands.py - отправка команд
- listener_keepalive.py - keep-alive логика
- listener_status.py - обновление статуса в БД
"""
import os
import queue
import threading
import time
from typing import Optional

from utils.logging import log
from utils.config_loader import get_config_value
from utils.datetime_utils import utcnow

from .processors import MessageProcessor
from .listener_status import update_listener_status
from .listener_loop import run_listen_loop
from .listener_commands import send_command_with_response, send_command_from_listener
from .listener_keepalive import start_keepalive_thread


class UDPListener:
    """
    UDP Listener для постоянного прослушивания одного сервера MoonBot
    """
    
    def __init__(
        self,
        server_id: int,
        host: str,
        port: int,
        password: Optional[str] = None,
        local_port: int = 0,
        keepalive_enabled: bool = True,
        global_socket: Optional['GlobalUDPSocket'] = None
    ):
        """
        Инициализация UDP Listener
        
        Args:
            server_id: ID сервера в БД
            host: IP адрес MoonBot сервера
            port: UDP порт MoonBot
            password: Пароль для HMAC (расшифрованный)
            local_port: Локальный порт для привязки (0 = эфемерный)
            keepalive_enabled: Включен ли keep-alive
            global_socket: Глобальный сокет (для SERVER режима)
        """
        self.server_id = server_id
        self.host = host
        self.port = port
        self.password = password
        self.global_socket = global_socket
        
        # Определяем режим работы
        self._configure_mode(local_port, keepalive_enabled)
        
        # Состояние listener
        self.running = False
        self.sock = None
        self.thread = None
        self.messages_received = 0
        self.last_error = None
        
        # Очередь для ответов на команды
        self.command_response_queue = queue.Queue()
        self.waiting_for_response = False
        self.keepalive_timer = None
        self._initial_lst_pending = False
        
        # Процессор сообщений
        self.processor = MessageProcessor(server_id, host, port)
    
    def _configure_mode(self, local_port: int, keepalive_enabled: bool):
        """Настройка режима работы на основе переменных окружения"""
        mode_env = get_config_value('app', 'mode.moonbot_mode_env', default='MOONBOT_MODE')
        default_mode = get_config_value('app', 'mode.default_mode', default='auto')
        moonbot_mode = os.getenv(mode_env, default_mode).lower().strip()
        
        if moonbot_mode == 'local':
            self.local_port = 0
            self.keepalive_enabled = True
            self.use_global_socket = False
            log(f"[UDP-LISTENER-{self.server_id}] MODE: LOCAL (ephemeral port + keep-alive)")
        elif moonbot_mode == 'server':
            self.local_port = 0
            self.keepalive_enabled = False
            self.use_global_socket = True
            log(f"[UDP-LISTENER-{self.server_id}] [MODE]  MODE: SERVER (global socket, no keep-alive)")
        else:
            self.local_port = local_port
            self.keepalive_enabled = keepalive_enabled
            self.use_global_socket = False
            log(f"[UDP-LISTENER-{self.server_id}] MODE: AUTO (local_port={local_port}, keepalive={keepalive_enabled})")
    
    def start(self):
        """Запустить listener в отдельном потоке"""
        if self.running:
            log(f"[UDP-LISTENER-{self.server_id}] Already running")
            return False
        
        self.running = True
        
        if self.use_global_socket:
            return self._start_with_global_socket()
        
        return self._start_with_own_socket()
    
    def _start_with_global_socket(self) -> bool:
        """Запуск в режиме глобального сокета (SERVER mode)"""
        update_listener_status(self.server_id, is_running=True, started_at=utcnow())
        
        log(f"[UDP-LISTENER-{self.server_id}] Started (using global socket) for {self.host}:{self.port}")
        
        try:
            time.sleep(0.5)
            log(f"[UDP-LISTENER-{self.server_id}] 📡 Sending initial 'lst' to establish UDP connection (SERVER MODE)...")
            
            self._initial_lst_pending = True
            self._send_command_from_listener("lst")
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Initial 'lst' sent to {self.host}:{self.port}")
            
            # Автоматически подписываемся на графики
            time.sleep(0.2)
            self._send_command_from_listener("SubscribeCharts")
            log(f"[UDP-LISTENER-{self.server_id}] 📊 Auto-subscribed to charts")
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Error sending initial commands in server mode: {e}")
            import traceback
            traceback.print_exc()
        
        return True
    
    def _start_with_own_socket(self) -> bool:
        """Запуск с собственным сокетом (LOCAL/AUTO mode)"""
        self.thread = threading.Thread(
            target=run_listen_loop,
            args=(self,),
            daemon=True,
            name=f"UDPListener-{self.server_id}"
        )
        self.thread.start()
        
        update_listener_status(self.server_id, is_running=True, started_at=utcnow())
        
        log(f"[UDP-LISTENER-{self.server_id}] Started for {self.host}:{self.port}")
        
        if self.keepalive_enabled:
            self.keepalive_timer = start_keepalive_thread(self)
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Keep-alive is ENABLED")
        else:
            log(f"[UDP-LISTENER-{self.server_id}] ⏸️  Keep-alive is DISABLED (server mode with fixed port)")
        
        return True
    
    def stop(self):
        """Остановить listener"""
        if not self.running:
            return False
        
        self.running = False
        
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass  # Сокет уже закрыт
        
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        
        update_listener_status(self.server_id, is_running=False)
        
        log(f"[UDP-LISTENER-{self.server_id}] Stopped")
        return True
    
    def send_command(self, command: str):
        """
        Публичный метод для отправки команды через listener socket
        
        Args:
            command: Команда для отправки
        """
        # Ждём пока сокет инициализируется (до 5 секунд)
        if not self.use_global_socket:
            for _ in range(50):  # 50 * 0.1 = 5 секунд
                if self.sock is not None:
                    break
                time.sleep(0.1)
            
            if self.sock is None:
                log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Socket not initialized after waiting!")
                return
        
        self._send_command_from_listener(command)
    
    def send_command_with_response(self, command: str, timeout: float = None) -> tuple:
        """
        Отправка команды через listener socket и ожидание ответа
        
        Args:
            command: Команда для отправки
            timeout: Таймаут ожидания ответа
        
        Returns:
            tuple[bool, str]: (успех, ответ от MoonBot)
        """
        return send_command_with_response(self, command, timeout)
    
    def _send_command_from_listener(self, command: str):
        """
        Внутренний метод для отправки команды через сокет
        
        Args:
            command: Команда для отправки
        """
        send_command_from_listener(self, command)
    
    def _update_status(self, **kwargs):
        """
        Обновление статуса listener в БД
        
        Args:
            **kwargs: Поля для обновления
        """
        update_listener_status(self.server_id, **kwargs)
