"""
UDP Listener Service для постоянного прослушивания MoonBot

Этот модуль запускает отдельные потоки для каждого сервера,
которые непрерывно слушают UDP сообщения от MoonBot.

Оптимизирован для высоких нагрузок (3000+ серверов):
- Worker Pool для параллельной обработки сообщений
- Batch Processor для оптимизации записи в БД
"""
from .listener import UDPListener
from .global_socket import GlobalUDPSocket
from .manager import (
    start_listener,
    stop_listener,
    get_listener_status,
    stop_all_listeners,
    active_listeners,
    global_udp_socket
)
from .worker_pool import (
    UDPWorkerPool,
    get_worker_pool,
    start_worker_pool,
    stop_worker_pool
)
from .batch_processor import (
    BatchProcessor,
    get_batch_processor,
    start_batch_processor,
    stop_batch_processor
)

__all__ = [
    'UDPListener',
    'GlobalUDPSocket',
    'start_listener',
    'stop_listener',
    'get_listener_status',
    'stop_all_listeners',
    'active_listeners',
    'global_udp_socket',
    # High-load components
    'UDPWorkerPool',
    'get_worker_pool',
    'start_worker_pool',
    'stop_worker_pool',
    'BatchProcessor',
    'get_batch_processor',
    'start_batch_processor',
    'stop_batch_processor',
]


