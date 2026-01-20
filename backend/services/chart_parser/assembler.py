"""
Сборщик фрагментированных пакетов графиков

Thread-safe реализация для поддержки многопоточной обработки.
"""

import gzip
import time
import logging
import threading
from typing import Dict, Optional, Tuple

from .constants import HEADER_SIZE, GZIP_MAGIC
from .models import ChartHeader
from .parser import parse_header

logger = logging.getLogger(__name__)


class ChartFragmentAssembler:
    """
    Сборщик фрагментированных пакетов графиков
    
    Thread-safe: все операции защищены блокировкой.
    """

    def __init__(self):
        # {order_id: {block_num: bytes}}
        self.fragments: Dict[int, Dict[int, bytes]] = {}
        self.expected_counts: Dict[int, int] = {}
        self.timestamps: Dict[int, float] = {}
        # Lock для thread-safety
        self._lock = threading.Lock()

    def add_fragment(self, data: bytes) -> Optional[Tuple[ChartHeader, bytes]]:
        """
        Добавить фрагмент и попытаться собрать полный пакет

        Thread-safe операция.

        Returns:
            (header, complete_data) если все фрагменты получены, иначе None
        """
        header = parse_header(data)
        if not header:
            return None

        order_id = header.order_id
        block_num = header.block_num
        blocks_count = header.blocks_count

        # Сохраняем фрагмент (без заголовка)
        fragment_data = data[HEADER_SIZE:]
        
        # Распаковываем GZIP если нужно
        if fragment_data[:2] == GZIP_MAGIC:
            try:
                fragment_data = gzip.decompress(fragment_data)
            except Exception as e:
                logger.error(f"[CHART-ASSEMBLER] GZIP error for fragment: {e}")
                return None

        with self._lock:
            # Инициализируем хранилище для этого ордера
            if order_id not in self.fragments:
                self.fragments[order_id] = {}
                self.expected_counts[order_id] = blocks_count
                self.timestamps[order_id] = time.time()

            self.fragments[order_id][block_num] = fragment_data

            logger.debug(
                f"[CHART-ASSEMBLER] Fragment {block_num + 1}/{blocks_count} for order {order_id}, "
                f"collected: {len(self.fragments[order_id])}"
            )

            # Проверяем, все ли фрагменты получены
            if len(self.fragments[order_id]) < self.expected_counts[order_id]:
                return None

            # Собираем полные данные (внутри lock)
            complete_data = self._assemble_unlocked(order_id)
            if complete_data:
                return (header, complete_data)
            return None

    def _assemble_unlocked(self, order_id: int) -> Optional[bytes]:
        """
        Собрать фрагменты в полные данные.
        
        ВАЖНО: Вызывать только под self._lock!
        """
        blocks_count = self.expected_counts[order_id]
        fragments = []

        for i in range(blocks_count):
            if i not in self.fragments[order_id]:
                logger.error(f"[CHART-ASSEMBLER] Missing fragment {i} for order {order_id}")
                self._cleanup_order_unlocked(order_id)
                return None
            fragments.append(self.fragments[order_id][i])

        complete_data = b''.join(fragments)

        # Очищаем буфер
        self._cleanup_order_unlocked(order_id)

        logger.info(f"[CHART-ASSEMBLER] Assembled {len(complete_data)} bytes for order {order_id}")
        return complete_data

    def _cleanup_order_unlocked(self, order_id: int) -> None:
        """
        Очистить данные ордера.
        
        ВАЖНО: Вызывать только под self._lock!
        """
        self.fragments.pop(order_id, None)
        self.expected_counts.pop(order_id, None)
        self.timestamps.pop(order_id, None)

    def cleanup_stale(self, timeout_seconds: int = 300) -> int:
        """Очистить незавершённые сборки (старше timeout)"""
        with self._lock:
            current_time = time.time()
            stale_orders = [
                order_id
                for order_id, start_time in self.timestamps.items()
                if current_time - start_time > timeout_seconds
            ]

            for order_id in stale_orders:
                logger.warning(f"[CHART-ASSEMBLER] Cleanup stale: order={order_id}")
                self._cleanup_order_unlocked(order_id)

            return len(stale_orders)

    def clear_all(self):
        """Очистить все буферы"""
        with self._lock:
            self.fragments.clear()
            self.expected_counts.clear()
            self.timestamps.clear()

