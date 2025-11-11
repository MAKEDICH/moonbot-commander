"""
UDP Connection Pool для оптимизации производительности
Переиспользует UDP сокеты вместо создания нового для каждого запроса
"""
import socket
import threading
import time
from typing import Dict, Optional, Tuple
from collections import defaultdict


class UDPSocketPool:
    """Пул UDP сокетов для переиспользования"""
    
    def __init__(self, max_idle_time: int = 60, cleanup_interval: int = 30):
        """
        Args:
            max_idle_time: Максимальное время простоя сокета (секунды) перед закрытием
            cleanup_interval: Интервал очистки неиспользуемых сокетов (секунды)
        """
        self.max_idle_time = max_idle_time
        self.cleanup_interval = cleanup_interval
        
        # Пул сокетов: {bind_port: (socket, last_used_time)}
        self._pool: Dict[int, Tuple[socket.socket, float]] = {}
        self._lock = threading.Lock()
        
        # Флаг для остановки cleanup thread
        self._stop_cleanup = False
        
        # Запускаем cleanup thread
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()
    
    def get_socket(self, bind_port: int, timeout: int = 5) -> socket.socket:
        """
        Получить сокет из пула или создать новый
        
        Args:
            bind_port: Порт для привязки
            timeout: Таймаут для сокета
            
        Returns:
            socket.socket: UDP сокет
        """
        with self._lock:
            # Проверяем есть ли сокет в пуле
            if bind_port in self._pool:
                sock, last_used = self._pool[bind_port]
                
                # Проверяем не протух ли сокет
                if time.time() - last_used < self.max_idle_time:
                    # Обновляем время использования
                    self._pool[bind_port] = (sock, time.time())
                    sock.settimeout(timeout)
                    return sock
                else:
                    # Сокет протух, закрываем его
                    try:
                        sock.close()
                    except:
                        pass
                    del self._pool[bind_port]
            
            # Создаём новый сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind(("", bind_port))
            sock.settimeout(timeout)
            
            # Добавляем в пул
            self._pool[bind_port] = (sock, time.time())
            
            return sock
    
    def return_socket(self, bind_port: int):
        """
        Вернуть сокет в пул (обновить время использования)
        
        Args:
            bind_port: Порт сокета
        """
        with self._lock:
            if bind_port in self._pool:
                sock, _ = self._pool[bind_port]
                self._pool[bind_port] = (sock, time.time())
    
    def close_socket(self, bind_port: int):
        """
        Закрыть и удалить сокет из пула
        
        Args:
            bind_port: Порт сокета
        """
        with self._lock:
            if bind_port in self._pool:
                sock, _ = self._pool[bind_port]
                try:
                    sock.close()
                except:
                    pass
                del self._pool[bind_port]
    
    def _cleanup_loop(self):
        """Цикл очистки протухших сокетов"""
        while not self._stop_cleanup:
            time.sleep(self.cleanup_interval)
            
            with self._lock:
                now = time.time()
                expired_ports = []
                
                for bind_port, (sock, last_used) in self._pool.items():
                    if now - last_used > self.max_idle_time:
                        expired_ports.append(bind_port)
                
                for port in expired_ports:
                    sock, _ = self._pool[port]
                    try:
                        sock.close()
                    except:
                        pass
                    del self._pool[port]
                
                if expired_ports:
                    print(f"[UDP-POOL] Cleaned up {len(expired_ports)} expired sockets")
    
    def close_all(self):
        """Закрыть все сокеты и остановить cleanup thread"""
        self._stop_cleanup = True
        
        with self._lock:
            for sock, _ in self._pool.values():
                try:
                    sock.close()
                except:
                    pass
            self._pool.clear()
    
    def get_stats(self) -> dict:
        """Получить статистику пула"""
        with self._lock:
            return {
                "total_sockets": len(self._pool),
                "sockets_info": [
                    {
                        "bind_port": port,
                        "idle_time": time.time() - last_used
                    }
                    for port, (_, last_used) in self._pool.items()
                ]
            }


# Глобальный экземпляр пула
udp_socket_pool = UDPSocketPool(max_idle_time=60, cleanup_interval=30)






