"""
Модели данных для парсера графиков
"""

from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ChartHeader:
    """Заголовок бинарного пакета графика"""
    flag: int          # Всегда 0
    kind: int          # 1 = график
    order_id: int      # ID ордера в БД MoonBot
    block_num: int     # Номер фрагмента (с 0)
    blocks_count: int  # Всего фрагментов


@dataclass
class PricePoint:
    """Точка цены на графике"""
    time: datetime
    price: float


@dataclass
class OrderData:
    """Данные ордера на графике"""
    order_id: str
    mean_price: float
    create_time: datetime
    open_time: datetime
    close_time: datetime


@dataclass
class MiniCandle:
    """Мини-свеча (бар)"""
    time: datetime
    count: int
    min_price: float
    max_price: float
    buy_volume: float
    sell_volume: float


@dataclass
class DeltaVolumes:
    """Блок дельт и объёмов"""
    last_1m_delta: float
    last_5m_delta: float
    last_1h_delta: float
    last_3h_delta: float
    last_24h_delta: float
    pump_delta_1h: float
    dump_delta_1h: float
    hvol: float
    hvol_fast: float
    test_price_down: float
    test_price_up: float
    is_moonshot: bool
    session_profit: float


@dataclass
class ChartData:
    """Полные данные графика"""
    version: int
    market_name: str
    market_currency: str
    pump_channel: str
    bn_market_name: str
    start_time: datetime
    end_time: datetime
    history_prices: List[PricePoint] = field(default_factory=list)
    orders: List[OrderData] = field(default_factory=list)
    trades: List[PricePoint] = field(default_factory=list)
    deltas: Optional[DeltaVolumes] = None
    closest_prices: List[PricePoint] = field(default_factory=list)
    candles: List[MiniCandle] = field(default_factory=list)

