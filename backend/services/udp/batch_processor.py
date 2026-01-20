"""
Batch Processor для массовых операций с БД

Оптимизирует запись в БД путём группировки операций в пакеты.
Критически важно для обработки данных от 3000+ серверов.
"""
import threading
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Type
from datetime import datetime

from sqlalchemy.orm import Session

from models.database import SessionLocal
from models import models
from utils.config_loader import get_config_value
from utils.logging import log
from utils.datetime_utils import utcnow
from .batch_processor_upsert import BatchUpsertMixin


@dataclass
class BatchItem:
    """Элемент для batch-обработки."""
    table: str
    operation: str  # 'insert', 'update', 'upsert'
    data: Dict[str, Any]
    created_at: float = field(default_factory=time.time)


@dataclass
class BatchStats:
    """Статистика batch-обработки."""
    total_items: int = 0
    total_batches: int = 0
    total_inserts: int = 0
    total_updates: int = 0
    total_errors: int = 0
    avg_batch_size: float = 0.0
    avg_flush_time_ms: float = 0.0


class BatchProcessor(BatchUpsertMixin):
    """
    Процессор для пакетной записи в БД.
    
    Группирует операции по таблицам и выполняет bulk insert/update.
    """
    
    # Маппинг таблиц на модели
    TABLE_MODELS: Dict[str, Type] = {
        'server_balance': models.ServerBalance,
        'moonbot_orders': models.MoonBotOrder,
        'sql_command_log': models.SQLCommandLog,
        'moonbot_api_errors': models.MoonBotAPIError,
        'strategy_cache': models.StrategyCache,
        'moonbot_charts': models.MoonBotChart,
    }
    
    def __init__(
        self,
        batch_size: Optional[int] = None,
        flush_interval_ms: Optional[int] = None
    ):
        """
        Инициализация batch processor.
        
        Args:
            batch_size: Размер пакета для flush
            flush_interval_ms: Интервал автоматического flush
        """
        self.batch_size = batch_size or get_config_value(
            'high_load', 'async_processing.bulk.insert_batch_size', default=500
        )
        self.flush_interval_ms = flush_interval_ms or get_config_value(
            'high_load', 'async_processing.bulk.flush_interval_ms', default=100
        )
        
        # Буферы для каждой таблицы
        self._buffers: Dict[str, List[BatchItem]] = defaultdict(list)
        self._locks: Dict[str, threading.Lock] = defaultdict(threading.Lock)
        self._last_flush: Dict[str, float] = defaultdict(float)
        
        # Статистика
        self._stats = BatchStats()
        self._stats_lock = threading.Lock()
        
        # Состояние
        self._running = False
        self._flush_thread: Optional[threading.Thread] = None
        
        log(f"[BATCH-PROCESSOR] Initialized: batch_size={self.batch_size}, "
            f"flush_interval={self.flush_interval_ms}ms")
    
    def start(self) -> None:
        """Запустить background flush thread."""
        if self._running:
            return
        
        self._running = True
        self._flush_thread = threading.Thread(
            target=self._flush_loop,
            daemon=True,
            name="BatchProcessorFlusher"
        )
        self._flush_thread.start()
        log("[BATCH-PROCESSOR] Started")
    
    def stop(self) -> None:
        """Остановить и выполнить финальный flush."""
        if not self._running:
            return
        
        log("[BATCH-PROCESSOR] Stopping...")
        self._running = False
        
        if self._flush_thread:
            self._flush_thread.join(timeout=5.0)
        
        # Финальный flush всех буферов
        self.flush_all()
        
        log(f"[BATCH-PROCESSOR] Stopped. Stats: {self.get_stats()}")
    
    def add(self, table: str, operation: str, data: Dict[str, Any]) -> None:
        """
        Добавить элемент в буфер.
        
        Args:
            table: Имя таблицы
            operation: Тип операции ('insert', 'update', 'upsert')
            data: Данные для записи
        """
        item = BatchItem(table=table, operation=operation, data=data)
        
        with self._locks[table]:
            self._buffers[table].append(item)
            
            with self._stats_lock:
                self._stats.total_items += 1
            
            # Проверяем, нужен ли flush
            if len(self._buffers[table]) >= self.batch_size:
                self._flush_table(table)
    
    def add_balance(self, server_id: int, available: float, total: float,
                    bot_name: Optional[str] = None, is_running: Optional[bool] = None,
                    version: Optional[int] = None) -> None:
        """
        Добавить обновление баланса в буфер.
        
        Args:
            server_id: ID сервера
            available: Доступный баланс
            total: Общий баланс
            bot_name: Имя бота
            is_running: Запущен ли бот
            version: Версия MoonBot
        """
        data = {
            'server_id': server_id,
            'available': available,
            'total': total,
            'bot_name': bot_name,
            'is_running': is_running,
            'version': version,
            'updated_at': utcnow(),
        }
        self.add('server_balance', 'upsert', data)
    
    def add_order(self, server_id: int, order_data: Dict[str, Any]) -> None:
        """
        Добавить ордер в буфер.
        
        Args:
            server_id: ID сервера
            order_data: Данные ордера
        """
        order_data['server_id'] = server_id
        order_data['updated_at'] = utcnow()
        self.add('moonbot_orders', 'upsert', order_data)
    
    def add_sql_log(self, server_id: int, command_id: int, sql_text: str) -> None:
        """
        Добавить SQL лог в буфер.
        
        Args:
            server_id: ID сервера
            command_id: ID команды
            sql_text: Текст SQL
        """
        data = {
            'server_id': server_id,
            'command_id': command_id,
            'sql_text': sql_text,
            'received_at': utcnow(),
            'processed': False,
        }
        self.add('sql_command_log', 'insert', data)
    
    def add_api_error(self, server_id: int, bot_name: str, error_text: str,
                      error_code: Optional[int] = None, symbol: Optional[str] = None,
                      error_time: Optional[datetime] = None) -> None:
        """
        Добавить ошибку API в буфер.
        
        Args:
            server_id: ID сервера
            bot_name: Имя бота
            error_text: Текст ошибки
            error_code: Код ошибки
            symbol: Символ
            error_time: Время ошибки (из текста ошибки)
        """
        data = {
            'server_id': server_id,
            'bot_name': bot_name,
            'error_text': error_text,
            'error_code': error_code,
            'symbol': symbol,
            'error_time': error_time,
            'received_at': utcnow(),
        }
        self.add('moonbot_api_errors', 'insert', data)
    
    def add_strategy_cache(self, server_id: int, pack_number: int,
                           data: str, bot_name: str) -> None:
        """
        Добавить стратегию в буфер.
        
        Args:
            server_id: ID сервера
            pack_number: Номер пакета стратегий
            data: Данные стратегии
            bot_name: Имя бота
        """
        item_data = {
            'server_id': server_id,
            'pack_number': pack_number,
            'data': data,
            'bot_name': bot_name,
            'received_at': utcnow(),
        }
        self.add('strategy_cache', 'upsert', item_data)
    
    def _flush_loop(self) -> None:
        """Background loop для периодического flush."""
        while self._running:
            try:
                time.sleep(self.flush_interval_ms / 1000.0)
                self._flush_expired()
            except Exception as e:
                log(f"[BATCH-PROCESSOR] Flush loop error: {e}", level="ERROR")
    
    def _flush_expired(self) -> None:
        """Flush буферов, которые ждут дольше flush_interval_ms."""
        current_time = time.time()
        threshold = self.flush_interval_ms / 1000.0
        
        for table in list(self._buffers.keys()):
            with self._locks[table]:
                last_flush = self._last_flush.get(table, 0)
                if (current_time - last_flush) >= threshold and self._buffers[table]:
                    self._flush_table(table)
    
    def flush_all(self) -> None:
        """Flush всех буферов."""
        for table in list(self._buffers.keys()):
            with self._locks[table]:
                if self._buffers[table]:
                    self._flush_table(table)
    
    def _flush_table(self, table: str) -> None:
        """
        Flush буфера конкретной таблицы.
        
        Args:
            table: Имя таблицы
        """
        items = self._buffers[table]
        if not items:
            return
        
        start_time = time.time()
        self._buffers[table] = []
        self._last_flush[table] = start_time
        
        try:
            self._execute_batch(table, items)
            
            flush_time_ms = (time.time() - start_time) * 1000
            
            with self._stats_lock:
                self._stats.total_batches += 1
                self._stats.avg_batch_size = (
                    (self._stats.avg_batch_size * (self._stats.total_batches - 1) + len(items))
                    / self._stats.total_batches
                )
                self._stats.avg_flush_time_ms = (
                    (self._stats.avg_flush_time_ms * (self._stats.total_batches - 1) + flush_time_ms)
                    / self._stats.total_batches
                )
            
            log(f"[BATCH-PROCESSOR] Flushed {len(items)} items to {table} in {flush_time_ms:.1f}ms")
            
        except Exception as e:
            with self._stats_lock:
                self._stats.total_errors += 1
            log(f"[BATCH-PROCESSOR] Error flushing {table}: {e}", level="ERROR")
    
    def _execute_batch(self, table: str, items: List[BatchItem]) -> None:
        """
        Выполнить batch-операцию в БД.
        
        Args:
            table: Имя таблицы
            items: Список элементов
        """
        if not items:
            return
        
        model_class = self.TABLE_MODELS.get(table)
        if not model_class:
            log(f"[BATCH-PROCESSOR] Unknown table: {table}", level="ERROR")
            return
        
        db = SessionLocal()
        try:
            # Группируем по типу операции
            inserts = [i for i in items if i.operation == 'insert']
            upserts = [i for i in items if i.operation in ('update', 'upsert')]
            
            # Bulk insert
            if inserts:
                self._bulk_insert(db, model_class, [i.data for i in inserts])
                with self._stats_lock:
                    self._stats.total_inserts += len(inserts)
            
            # Upsert (insert or update)
            if upserts:
                self._bulk_upsert(db, model_class, table, [i.data for i in upserts])
                with self._stats_lock:
                    self._stats.total_updates += len(upserts)
            
            db.commit()
            
        except Exception as e:
            db.rollback()
            raise
        finally:
            db.close()
    
    def _bulk_insert(self, db: Session, model_class: Type, data_list: List[Dict]) -> None:
        """
        Выполнить bulk insert.
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            data_list: Список данных
        """
        if not data_list:
            return
        
        # Используем bulk_insert_mappings для максимальной производительности
        db.bulk_insert_mappings(model_class, data_list)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Получить статистику.
        
        Returns:
            Dict со статистикой
        """
        with self._stats_lock:
            return {
                'total_items': self._stats.total_items,
                'total_batches': self._stats.total_batches,
                'total_inserts': self._stats.total_inserts,
                'total_updates': self._stats.total_updates,
                'total_errors': self._stats.total_errors,
                'avg_batch_size': round(self._stats.avg_batch_size, 1),
                'avg_flush_time_ms': round(self._stats.avg_flush_time_ms, 2),
                'pending': sum(len(b) for b in self._buffers.values()),
            }


# Глобальный экземпляр
_batch_processor: Optional[BatchProcessor] = None


def get_batch_processor() -> BatchProcessor:
    """
    Получить глобальный batch processor.
    
    Returns:
        BatchProcessor
    """
    global _batch_processor
    if _batch_processor is None:
        _batch_processor = BatchProcessor()
    return _batch_processor


def start_batch_processor() -> None:
    """Запустить глобальный batch processor."""
    processor = get_batch_processor()
    processor.start()


def stop_batch_processor() -> None:
    """Остановить глобальный batch processor."""
    global _batch_processor
    if _batch_processor:
        _batch_processor.stop()
        _batch_processor = None
