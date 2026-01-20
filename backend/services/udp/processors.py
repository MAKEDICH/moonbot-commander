"""
Процессоры сообщений для UDP Listener

Обработка различных типов пакетов от MoonBot (order, acc, strats, lst, charts, errors)

Модуль разбит на подмодули:
- processors_utils.py - утилитарные функции
- processors_balance.py - обработка балансов
- processors_orders.py - обработка ордеров
- processors_strategies.py - обработка стратегий
- processors_charts.py - обработка графиков
- processors_errors.py - обработка ошибок API

Оптимизировано для 3000+ серверов:
- Уменьшенное логирование
- Быстрая обработка без блокировок
"""
import time

from services import udp_protocol
from utils.logging import log
from utils.datetime_utils import utcnow

from .processors_utils import try_decompress_buffer
from .processors_balance import BalanceProcessor
from .processors_orders import OrderProcessor
from .processors_strategies import StrategyProcessor
from .processors_charts import ChartProcessor
from .processors_errors import ErrorProcessor
from .utils import normalize_localhost_ip


class MessageProcessor:
    """
    Процессор UDP сообщений от MoonBot
    
    Координирует обработку различных типов сообщений, делегируя
    специализированным процессорам.
    
    Оптимизирован для 3000+ серверов.
    """
    
    # Счётчик для уменьшения логирования
    _packet_counter = 0
    _log_every_n = 500  # Логировать каждый N-й пакет
    
    def __init__(self, server_id: int, host: str, port: int):
        """
        Инициализация процессора сообщений
        
        Args:
            server_id: ID сервера в базе данных
            host: IP адрес сервера MoonBot
            port: Порт сервера MoonBot
        """
        self.server_id = server_id
        self.host = host
        self.port = port
        self.fragment_buffer = bytearray()
        self.last_fragment_time = 0
        self.fragment_timeout_ms = 50
        
        # Инициализация специализированных процессоров
        self.balance_processor = BalanceProcessor(server_id)
        self.order_processor = OrderProcessor(server_id)
        self.strategy_processor = StrategyProcessor(server_id)
        self.chart_processor = ChartProcessor(server_id)
        self.error_processor = ErrorProcessor(server_id)
    
    def process_message(self, data: bytes, addr: str, port: int):
        """
        Обработка полученного сообщения
        
        Args:
            data: Бинарные данные сообщения
            addr: IP адрес отправителя
            port: Порт отправителя
        
        Returns:
            Результат обработки или None
        """
        # Проверка адреса с нормализацией для localhost вариантов
        # Важно для SERVER mode где пакеты могут приходить с ::1, ::ffff:127.0.0.1 и т.д.
        normalized_addr = normalize_localhost_ip(addr)
        normalized_host = normalize_localhost_ip(self.host)
        if normalized_addr != normalized_host:
            return
        
        # Уменьшенное логирование для высокой нагрузки
        MessageProcessor._packet_counter += 1
        if MessageProcessor._packet_counter % MessageProcessor._log_every_n == 0:
            log(f"[UDP-PROCESSOR] Total packets processed: {MessageProcessor._packet_counter}")
        
        # Проверяем, является ли это бинарным пакетом графика
        if self.chart_processor.is_chart_packet(data):
            return self.chart_processor.process_chart_packet(data)
        
        packet = udp_protocol.decode_udp_packet(data)
        
        if packet.decompress_error:
            return self._handle_fragment(data, addr, port)
        
        if self.fragment_buffer:
            self._process_fragment_buffer(addr, port)
        
        if not packet.payload:
            return self.process_legacy_message(packet.raw_text, addr, port)
        
        cmd = udp_protocol.get_packet_command(packet)
        
        return self._dispatch_command(cmd, packet)
    
    def _handle_fragment(self, data: bytes, addr: str, port: int):
        """
        Обработка фрагментированного пакета
        
        Args:
            data: Данные фрагмента
            addr: IP адрес отправителя
            port: Порт отправителя
        """
        current_time_ms = time.time() * 1000
        
        if self.fragment_buffer and (current_time_ms - self.last_fragment_time) > 2000:
            self._try_decompress()
            self.fragment_buffer = bytearray()
        
        self.fragment_buffer.extend(data)
        self.last_fragment_time = current_time_ms
    
    def _process_fragment_buffer(self, addr: str, port: int):
        """
        Обработка накопленного буфера фрагментов
        
        Args:
            addr: IP адрес отправителя
            port: Порт отправителя
        """
        self._try_decompress()
        self.fragment_buffer = bytearray()
    
    def _try_decompress(self) -> bool:
        """
        Попытка декомпрессировать буфер фрагментов
        
        Returns:
            True если декомпрессия успешна
        """
        return try_decompress_buffer(
            self.fragment_buffer,
            self.server_id,
            self.strategy_processor.process_strategies_response,
            self.order_processor.process_order_update,
            self.balance_processor.process_balance_update
        )
    
    def _dispatch_command(self, cmd: str, packet):
        """
        Маршрутизация команды к соответствующему обработчику
        
        Args:
            cmd: Команда из пакета
            packet: Декодированный пакет
        
        Returns:
            Результат обработки
        """
        if cmd == "order":
            return self.order_processor.process_order_update(packet.payload)
        elif cmd == "acc":
            return self.balance_processor.process_balance_update(packet.payload)
        elif cmd == "strats":
            return self.strategy_processor.process_strategies_response(packet.payload)
        elif cmd == "errors":
            return self.error_processor.process_api_errors(packet.payload)
        elif cmd == "replay":
            return udp_protocol.extract_preferred_text(packet)
        elif "sql" in packet.payload:
            return self.order_processor.process_sql_command(packet.payload.get("sql", ""))
        else:
            return udp_protocol.extract_preferred_text(packet)
    
    def process_legacy_message(self, message: str, addr: str, port: int):
        """
        Обработка сообщения в старом формате
        
        Args:
            message: Текст сообщения
            addr: IP адрес отправителя
            port: Порт отправителя
        
        Returns:
            Обработанное сообщение или None
        """
        # Проверка адреса с нормализацией для localhost вариантов
        normalized_addr = normalize_localhost_ip(addr)
        normalized_host = normalize_localhost_ip(self.host)
        if normalized_addr != normalized_host:
            return
        
        message_clean = message.strip()
        if not message_clean or (len(message_clean) > 0 and ord(message_clean[0]) < 32 and message_clean[0] not in '\n\r\t'):
            return
        
        if "[SQLCommand" in message:
            self.order_processor.process_sql_command(message)
        
        if "Open Sell Orders:" in message or "Open Buy Orders:" in message:
            self.strategy_processor.process_lst_response(message)
        
        return message
    
    # Методы-обёртки для обратной совместимости
    def process_order_update(self, packet: dict):
        """Обработка обновления ордера (обёртка для совместимости)"""
        return self.order_processor.process_order_update(packet)
    
    def process_balance_update(self, packet: dict):
        """Обработка обновления баланса (обёртка для совместимости)"""
        return self.balance_processor.process_balance_update(packet)
    
    def process_strategies_response(self, packet: dict):
        """Обработка ответа со стратегиями (обёртка для совместимости)"""
        return self.strategy_processor.process_strategies_response(packet)
    
    def process_api_errors(self, packet: dict):
        """Обработка ошибок API (обёртка для совместимости)"""
        return self.error_processor.process_api_errors(packet)
    
    def process_chart_packet(self, data: bytes):
        """Обработка пакета графика (обёртка для совместимости)"""
        return self.chart_processor.process_chart_packet(data)
    
    def process_lst_response(self, message: str):
        """Обработка ответа lst (обёртка для совместимости)"""
        return self.strategy_processor.process_lst_response(message)
    
    def process_sql_command(self, sql_text: str, moonbot_order_id: int = None, bot_name: str = None):
        """Обработка SQL команды (обёртка для совместимости)"""
        return self.order_processor.process_sql_command(sql_text, moonbot_order_id, bot_name)
