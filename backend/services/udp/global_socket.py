"""
Глобальный UDP сокет для SERVER режима

Один сокет на фиксированном порту обслуживает все MoonBot серверы.
Оптимизирован для 3000+ серверов с использованием Worker Pool.
"""
import socket
import threading
import time
from typing import Dict, Optional, TYPE_CHECKING
from utils.logging import log
from utils.config_loader import get_config_value
from .utils import normalize_localhost_ip
from .worker_pool import UDPMessage, get_worker_pool, start_worker_pool, stop_worker_pool

if TYPE_CHECKING:
    from .listener import UDPListener


class GlobalUDPSocket:
    """
    Глобальный UDP сокет для SERVER режима
    
    Один сокет на фиксированном порту (2500) обслуживает все MoonBot серверы.
    Роутит входящие пакеты по комбинации (IP, PORT) в соответствующий UDPListener.
    
    Оптимизации для 3000+ серверов:
    - Worker Pool для параллельной обработки сообщений
    - Увеличенные системные буферы сокета
    - Метрики и мониторинг нагрузки
    """
    
    def __init__(self, port: int = None):
        """
        Args:
            port: UDP порт для прослушивания (по умолчанию из YAML конфига)
        """
        # Загружаем порт из YAML конфига, если не передан явно
        if port is None:
            port = get_config_value('udp', 'udp.default_port', default=2500)
        
        self.port = port
        self.sock = None
        self.running = False
        self.thread = None
        
        self.ip_port_to_listener: Dict[tuple, 'UDPListener'] = {}
        
        # Метрики
        self.total_packets = 0
        self.packets_per_second = 0
        self.last_error = None
        self._packets_last_second = 0
        self._last_metrics_time = time.time()
        
        # Настройки из конфига
        self._use_worker_pool = get_config_value(
            'high_load', 'udp.worker_pool.workers', default=16
        ) > 0
        
        log(f"[GLOBAL-UDP] Worker pool enabled: {self._use_worker_pool}")
    
    def register_listener(self, listener: 'UDPListener'):
        """Зарегистрировать listener для определенной комбинации (IP, PORT)"""
        normalized_host = normalize_localhost_ip(listener.host)
        key = (normalized_host, listener.port)
        self.ip_port_to_listener[key] = listener
        log(f"[GLOBAL-UDP] Registered listener for {listener.host}:{listener.port} (normalized: {normalized_host}:{listener.port}, server_id={listener.server_id})")
    
    def unregister_listener(self, listener: 'UDPListener'):
        """Отменить регистрацию listener"""
        normalized_host = normalize_localhost_ip(listener.host)
        key = (normalized_host, listener.port)
        if key in self.ip_port_to_listener:
            del self.ip_port_to_listener[key]
            log(f"[GLOBAL-UDP] Unregistered listener for {listener.host}:{listener.port} (normalized: {normalized_host}:{listener.port}, server_id={listener.server_id})")
    
    def start(self):
        """Запустить глобальный UDP сокет"""
        if self.running:
            log(f"[GLOBAL-UDP] Already running on port {self.port}")
            return True
        
        try:
            # Загрузка настроек сокета из YAML
            reuse_address = get_config_value('udp', 'udp.socket.reuse_address', default=True)
            socket_timeout = get_config_value('udp', 'udp.timeouts.receive', default=1.0)
            
            # Настройки буферов для высокой нагрузки
            recv_buffer = get_config_value(
                'high_load', 'udp.global_socket.recv_buffer_size', default=4194304
            )  # 4MB по умолчанию
            send_buffer = get_config_value(
                'high_load', 'udp.global_socket.send_buffer_size', default=1048576
            )  # 1MB по умолчанию
            
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            if reuse_address:
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Увеличиваем системные буферы для 3000+ серверов
            try:
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, recv_buffer)
                actual_recv = self.sock.getsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF)
                log(f"[GLOBAL-UDP] [OK] Set SO_RCVBUF to {actual_recv / 1024 / 1024:.1f}MB (requested {recv_buffer / 1024 / 1024:.1f}MB)")
            except Exception as e:
                log(f"[GLOBAL-UDP] [WARN] Could not set SO_RCVBUF: {e}")
            
            try:
                self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, send_buffer)
                actual_send = self.sock.getsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF)
                log(f"[GLOBAL-UDP] [OK] Set SO_SNDBUF to {actual_send / 1024 / 1024:.1f}MB")
            except Exception as e:
                log(f"[GLOBAL-UDP] [WARN] Could not set SO_SNDBUF: {e}")
            
            self.sock.bind(("", self.port))
            self.sock.settimeout(socket_timeout)
            
            log(f"[GLOBAL-UDP] [BIND] Bound to port {self.port}")
            
            # Запускаем Worker Pool для параллельной обработки
            if self._use_worker_pool:
                start_worker_pool()
                log(f"[GLOBAL-UDP] [OK] Worker pool started")
            
            self.running = True
            self.thread = threading.Thread(
                target=self._listen_loop,
                daemon=True,
                name="GlobalUDPSocket"
            )
            self.thread.start()
            
            # Запускаем поток метрик
            self._metrics_thread = threading.Thread(
                target=self._metrics_loop,
                daemon=True,
                name="GlobalUDPMetrics"
            )
            self._metrics_thread.start()
            
            log(f"[GLOBAL-UDP] [OK] Started successfully on port {self.port}")
            return True
            
        except Exception as e:
            log(f"[GLOBAL-UDP] [ERROR] Failed to start: {e}")
            self.last_error = str(e)
            self.running = False
            if self.sock:
                try:
                    self.sock.close()
                except OSError:
                    pass  # Сокет уже закрыт
            return False
    
    def stop(self):
        """Остановить глобальный UDP сокет"""
        if not self.running:
            return False
        
        log(f"[GLOBAL-UDP] Stopping...")
        
        self.running = False
        
        # Останавливаем Worker Pool
        if self._use_worker_pool:
            stop_worker_pool()
            log(f"[GLOBAL-UDP] Worker pool stopped")
        
        if self.sock:
            try:
                self.sock.close()
            except OSError:
                pass  # Сокет уже закрыт
        
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        
        log(f"[GLOBAL-UDP] Stopped (total packets: {self.total_packets})")
        return True
    
    def _metrics_loop(self):
        """Цикл обновления метрик"""
        while self.running:
            try:
                time.sleep(1.0)
                current_time = time.time()
                elapsed = current_time - self._last_metrics_time
                if elapsed > 0:
                    self.packets_per_second = int(
                        (self.total_packets - self._packets_last_second) / elapsed
                    )
                    self._packets_last_second = self.total_packets
                    self._last_metrics_time = current_time
                    
                    # Логируем если нагрузка высокая
                    if self.packets_per_second > 1000:
                        log(f"[GLOBAL-UDP] High load: {self.packets_per_second} packets/sec")
            except Exception:
                pass
    
    def _listen_loop(self):
        """
        Основной цикл прослушивания
        
        Оптимизирован для 3000+ серверов:
        - Минимальная обработка в главном потоке
        - Делегирование в Worker Pool
        """
        log(f"[GLOBAL-UDP] Listen loop started")
        
        # Загружаем размер буфера из конфига
        buffer_size = get_config_value('udp', 'udp.socket.buffer_size', default=65535)
        
        # Получаем Worker Pool если включен
        worker_pool = get_worker_pool() if self._use_worker_pool else None
        
        try:
            while self.running:
                try:
                    data, addr_tuple = self.sock.recvfrom(buffer_size)
                    source_ip = addr_tuple[0]
                    source_port = addr_tuple[1]
                    
                    self.total_packets += 1
                    
                    normalized_ip = normalize_localhost_ip(source_ip)
                    
                    key = (normalized_ip, source_port)
                    listener = self.ip_port_to_listener.get(key)
                    
                    # Fallback для localhost
                    if not listener and normalized_ip == '127.0.0.1':
                        possible_listeners = [
                            (k, l) for k, l in self.ip_port_to_listener.items() 
                            if k[1] == source_port
                        ]
                        
                        if len(possible_listeners) == 1:
                            listener = possible_listeners[0][1]
                        elif len(possible_listeners) > 1 and self.total_packets % 1000 == 0:
                            # Логируем редко чтобы не спамить
                            log(f"[GLOBAL-UDP] [WARN] Ambiguous loopback from {source_ip}:{source_port}")
                    
                    if listener:
                        # ВАЖНО: Если listener ожидает ответ на команду - обрабатываем синхронно
                        # чтобы ответ попал в command_response_queue
                        if listener.waiting_for_response:
                            try:
                                result = listener.processor.process_message(data, source_ip, source_port)
                                if result:
                                    listener.command_response_queue.put(result)
                            except Exception as e:
                                log(f"[GLOBAL-UDP] Command response processing error: {e}")
                        elif worker_pool and worker_pool._running:
                            # Делегируем в Worker Pool для параллельной обработки
                            message = UDPMessage(
                                server_id=listener.server_id,
                                data=data,
                                source_ip=source_ip,
                                source_port=source_port,
                                received_at=time.time(),
                                processor=listener.processor
                            )
                            if not worker_pool.submit(message):
                                # Queue full - обрабатываем синхронно как fallback
                                try:
                                    listener.processor.process_message(data, source_ip, source_port)
                                except Exception as e:
                                    log(f"[GLOBAL-UDP] Fallback processing error: {e}")
                        else:
                            # Синхронная обработка если Worker Pool не включен
                            try:
                                listener.processor.process_message(data, source_ip, source_port)
                            except Exception as e:
                                log(f"[GLOBAL-UDP] Error processing packet: {e}")
                    else:
                        # Логируем неизвестные источники редко
                        if self.total_packets % 100 == 0:
                            log(f"[GLOBAL-UDP] [WARN] Unknown source: {source_ip}:{source_port}")
                
                except socket.timeout:
                    continue
                
                except Exception as e:
                    if self.running:
                        log(f"[GLOBAL-UDP] Receive error: {e}")
                        self.last_error = str(e)
                        time.sleep(0.1)  # Короткая пауза при ошибке
        
        except Exception as e:
            log(f"[GLOBAL-UDP] Fatal error: {e}")
            self.last_error = str(e)
        
        finally:
            if self.sock:
                self.sock.close()
            log(f"[GLOBAL-UDP] Listen loop ended (total packets: {self.total_packets})")
    
    def get_stats(self) -> Dict:
        """
        Получить статистику глобального сокета
        
        Returns:
            Dict со статистикой
        """
        stats = {
            "running": self.running,
            "port": self.port,
            "total_packets": self.total_packets,
            "packets_per_second": self.packets_per_second,
            "registered_listeners": len(self.ip_port_to_listener),
            "last_error": self.last_error,
            "use_worker_pool": self._use_worker_pool,
        }
        
        # Добавляем статистику Worker Pool если включен
        if self._use_worker_pool:
            try:
                worker_pool = get_worker_pool()
                stats["worker_pool"] = worker_pool.get_stats()
            except Exception:
                stats["worker_pool"] = None
        
        return stats

    def send_command(self, command: str, target_host: str, target_port: int, password: Optional[str] = None) -> bool:
        """
        Отправить команду через глобальный сокет
        
        Args:
            command: Команда для отправки
            target_host: IP адрес MoonBot
            target_port: UDP порт MoonBot
            password: Пароль для HMAC (опционально)
        
        Returns:
            bool: True если отправка успешна
        """
        try:
            if not self.sock:
                log(f"[GLOBAL-UDP] [ERROR] Socket not initialized")
                return False
            
            import hmac
            import hashlib
            
            if password:
                h = hmac.new(
                    password.encode('utf-8'),
                    command.encode('utf-8'),
                    hashlib.sha256
                )
                hmac_hex = h.hexdigest()
                payload = f"{hmac_hex} {command}"
            else:
                payload = command
            
            self.sock.sendto(
                payload.encode('utf-8'),
                (target_host, target_port)
            )
            
            return True
            
        except Exception as e:
            log(f"[GLOBAL-UDP] [ERROR] Failed to send command: {e}")
            return False


