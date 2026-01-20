"""
UDP Worker Pool для высоконагруженной обработки сообщений

Пул воркеров для параллельной обработки UDP сообщений от 3000+ серверов.
Использует очередь для буферизации и batch-обработку для оптимизации БД операций.
"""
import asyncio
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Any
from collections import defaultdict

from utils.config_loader import get_config_value
from utils.logging import log


@dataclass
class UDPMessage:
    """Сообщение для обработки в пуле воркеров."""
    server_id: int
    data: bytes
    source_ip: str
    source_port: int
    received_at: float
    processor: Any  # MessageProcessor


class WorkerPoolMetrics:
    """Метрики пула воркеров."""
    
    def __init__(self):
        self._lock = threading.Lock()
        self.messages_received: int = 0
        self.messages_processed: int = 0
        self.messages_dropped: int = 0
        self.processing_errors: int = 0
        self.queue_high_watermark: int = 0
        self.avg_processing_time_ms: float = 0.0
        self._processing_times: List[float] = []
        self._max_samples: int = 1000
    
    def record_received(self) -> None:
        """Записать получение сообщения."""
        with self._lock:
            self.messages_received += 1
    
    def record_processed(self, processing_time_ms: float) -> None:
        """Записать обработку сообщения."""
        with self._lock:
            self.messages_processed += 1
            self._processing_times.append(processing_time_ms)
            if len(self._processing_times) > self._max_samples:
                self._processing_times.pop(0)
            self.avg_processing_time_ms = sum(self._processing_times) / len(self._processing_times)
    
    def record_dropped(self) -> None:
        """Записать отброшенное сообщение."""
        with self._lock:
            self.messages_dropped += 1
    
    def record_error(self) -> None:
        """Записать ошибку обработки."""
        with self._lock:
            self.processing_errors += 1
    
    def update_queue_watermark(self, queue_size: int) -> None:
        """Обновить высшую отметку размера очереди."""
        with self._lock:
            if queue_size > self.queue_high_watermark:
                self.queue_high_watermark = queue_size
    
    def get_stats(self) -> Dict[str, Any]:
        """Получить статистику."""
        with self._lock:
            return {
                "messages_received": self.messages_received,
                "messages_processed": self.messages_processed,
                "messages_dropped": self.messages_dropped,
                "processing_errors": self.processing_errors,
                "queue_high_watermark": self.queue_high_watermark,
                "avg_processing_time_ms": round(self.avg_processing_time_ms, 2),
                "pending": self.messages_received - self.messages_processed - self.messages_dropped,
            }


class UDPWorkerPool:
    """
    Пул воркеров для обработки UDP сообщений.
    
    Особенности:
    - Многопоточная обработка сообщений
    - Очередь с ограниченным размером
    - Batch-обработка для оптимизации БД
    - Graceful shutdown
    """
    
    def __init__(
        self,
        num_workers: Optional[int] = None,
        queue_size: Optional[int] = None,
        batch_size: Optional[int] = None,
        batch_wait_ms: Optional[int] = None
    ):
        """
        Инициализация пула воркеров.
        
        Args:
            num_workers: Количество воркеров (по умолчанию из конфига)
            queue_size: Размер очереди (по умолчанию из конфига)
            batch_size: Размер пакета для batch-обработки
            batch_wait_ms: Максимальное время ожидания пакета
        """
        # Загружаем настройки из конфига
        self.num_workers = num_workers or get_config_value(
            'high_load', 'udp.worker_pool.workers', default=16
        )
        self.queue_size = queue_size or get_config_value(
            'high_load', 'udp.worker_pool.queue_size', default=10000
        )
        self.batch_size = batch_size or get_config_value(
            'high_load', 'udp.batch.max_batch_size', default=100
        )
        self.batch_wait_ms = batch_wait_ms or get_config_value(
            'high_load', 'udp.batch.max_batch_wait_ms', default=50
        )
        
        # Очередь сообщений
        self._queue: queue.Queue = queue.Queue(maxsize=self.queue_size)
        
        # Пул потоков
        self._executor: Optional[ThreadPoolExecutor] = None
        self._workers: List[threading.Thread] = []
        
        # Состояние
        self._running = False
        self._shutdown_event = threading.Event()
        
        # Метрики
        self.metrics = WorkerPoolMetrics()
        
        # Batch буферы для каждого типа операции
        self._batch_buffers: Dict[str, List[Any]] = defaultdict(list)
        self._batch_locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)
        self._last_flush: Dict[str, float] = defaultdict(float)
        
        log(f"[UDP-WORKER-POOL] Initialized: workers={self.num_workers}, "
            f"queue_size={self.queue_size}, batch_size={self.batch_size}")
    
    def start(self) -> None:
        """Запустить пул воркеров."""
        if self._running:
            log("[UDP-WORKER-POOL] Already running")
            return
        
        self._running = True
        self._shutdown_event.clear()
        
        # Создаём и запускаем воркеры
        for i in range(self.num_workers):
            worker = threading.Thread(
                target=self._worker_loop,
                args=(i,),
                daemon=True,
                name=f"UDPWorker-{i}"
            )
            worker.start()
            self._workers.append(worker)
        
        # Запускаем поток для периодического flush batch буферов
        self._flush_thread = threading.Thread(
            target=self._flush_loop,
            daemon=True,
            name="UDPBatchFlusher"
        )
        self._flush_thread.start()
        
        log(f"[UDP-WORKER-POOL] Started {self.num_workers} workers")
    
    def stop(self, timeout: float = 5.0) -> None:
        """
        Остановить пул воркеров.
        
        Args:
            timeout: Таймаут ожидания завершения
        """
        if not self._running:
            return
        
        log("[UDP-WORKER-POOL] Stopping...")
        self._running = False
        self._shutdown_event.set()
        
        # Ждём завершения воркеров
        for worker in self._workers:
            worker.join(timeout=timeout / self.num_workers)
        
        # Очищаем
        self._workers.clear()
        
        # Финальный flush буферов
        self._flush_all_buffers()
        
        log(f"[UDP-WORKER-POOL] Stopped. Final stats: {self.metrics.get_stats()}")
    
    def submit(self, message: UDPMessage) -> bool:
        """
        Добавить сообщение в очередь на обработку.
        
        Args:
            message: Сообщение для обработки
            
        Returns:
            True если сообщение добавлено, False если очередь переполнена
        """
        self.metrics.record_received()
        
        try:
            self._queue.put_nowait(message)
            self.metrics.update_queue_watermark(self._queue.qsize())
            return True
        except queue.Full:
            self.metrics.record_dropped()
            log(f"[UDP-WORKER-POOL] Queue full, dropping message from server {message.server_id}",
                level="WARNING")
            return False
    
    def _worker_loop(self, worker_id: int) -> None:
        """
        Основной цикл воркера.
        
        Args:
            worker_id: ID воркера
        """
        log(f"[UDP-WORKER-{worker_id}] Started")
        
        while self._running or not self._queue.empty():
            try:
                # Получаем сообщение с таймаутом
                try:
                    message = self._queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                
                # Обрабатываем
                start_time = time.time()
                try:
                    self._process_message(message)
                    processing_time_ms = (time.time() - start_time) * 1000
                    self.metrics.record_processed(processing_time_ms)
                except Exception as e:
                    self.metrics.record_error()
                    log(f"[UDP-WORKER-{worker_id}] Error processing message: {e}",
                        level="ERROR")
                finally:
                    self._queue.task_done()
                    
            except Exception as e:
                log(f"[UDP-WORKER-{worker_id}] Worker error: {e}", level="ERROR")
        
        log(f"[UDP-WORKER-{worker_id}] Stopped")
    
    def _process_message(self, message: UDPMessage) -> None:
        """
        Обработать одно сообщение.
        
        Args:
            message: Сообщение для обработки
        """
        if message.processor:
            message.processor.process_message(
                message.data,
                message.source_ip,
                message.source_port
            )
    
    def _flush_loop(self) -> None:
        """Цикл периодического flush batch буферов."""
        while self._running:
            try:
                time.sleep(self.batch_wait_ms / 1000.0)
                self._flush_expired_buffers()
            except Exception as e:
                log(f"[UDP-BATCH-FLUSHER] Error: {e}", level="ERROR")
    
    def _flush_expired_buffers(self) -> None:
        """Flush буферов, которые ждут дольше batch_wait_ms."""
        current_time = time.time()
        threshold = self.batch_wait_ms / 1000.0
        
        for buffer_key in list(self._batch_buffers.keys()):
            with self._batch_locks[buffer_key]:
                if (current_time - self._last_flush.get(buffer_key, 0)) >= threshold:
                    self._flush_buffer(buffer_key)
    
    def _flush_all_buffers(self) -> None:
        """Flush всех буферов."""
        for buffer_key in list(self._batch_buffers.keys()):
            with self._batch_locks[buffer_key]:
                self._flush_buffer(buffer_key)
    
    def _flush_buffer(self, buffer_key: str) -> None:
        """
        Flush конкретного буфера.
        
        Args:
            buffer_key: Ключ буфера
        """
        buffer = self._batch_buffers.get(buffer_key, [])
        if not buffer:
            return
        
        # Здесь будет логика batch-записи в БД
        # Реализация зависит от типа данных
        
        self._batch_buffers[buffer_key] = []
        self._last_flush[buffer_key] = time.time()
    
    def add_to_batch(self, buffer_key: str, item: Any) -> bool:
        """
        Добавить элемент в batch буфер.
        
        Args:
            buffer_key: Ключ буфера
            item: Элемент для добавления
            
        Returns:
            True если буфер был flush'нут
        """
        with self._batch_locks[buffer_key]:
            self._batch_buffers[buffer_key].append(item)
            
            if len(self._batch_buffers[buffer_key]) >= self.batch_size:
                self._flush_buffer(buffer_key)
                return True
            
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Получить статистику пула.
        
        Returns:
            Dict со статистикой
        """
        stats = self.metrics.get_stats()
        stats["queue_size"] = self._queue.qsize()
        stats["workers"] = self.num_workers
        stats["running"] = self._running
        return stats


# Глобальный экземпляр пула
_worker_pool: Optional[UDPWorkerPool] = None


def get_worker_pool() -> UDPWorkerPool:
    """
    Получить глобальный экземпляр пула воркеров.
    
    Returns:
        UDPWorkerPool
    """
    global _worker_pool
    if _worker_pool is None:
        _worker_pool = UDPWorkerPool()
    return _worker_pool


def start_worker_pool() -> None:
    """Запустить глобальный пул воркеров."""
    pool = get_worker_pool()
    pool.start()


def stop_worker_pool() -> None:
    """Остановить глобальный пул воркеров."""
    global _worker_pool
    if _worker_pool:
        _worker_pool.stop()
        _worker_pool = None


