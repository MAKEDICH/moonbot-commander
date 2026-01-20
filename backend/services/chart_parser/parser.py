"""
Функции парсинга графиков
"""

import struct
import gzip
import logging
from typing import Optional, Tuple

from .constants import HEADER_SIZE, GZIP_MAGIC, CHART_FLAG, CHART_KIND, ORDER_ID_FIXED_SIZE
from .models import ChartHeader, ChartData, PricePoint, OrderData, MiniCandle, DeltaVolumes
from .binary_reader import BinaryReader

logger = logging.getLogger(__name__)


def parse_chart_binary(data: bytes) -> Optional[ChartData]:
    """
    Парсит бинарный файл графика (формат TMarket.SaveToStreamShort)

    Returns:
        ChartData объект или None при ошибке
    """
    try:
        reader = BinaryReader(data)

        # 1. Заголовок
        version = reader.read_word()
        market_name = reader.read_utf8_string()
        market_currency = reader.read_utf8_string()
        pump_channel = reader.read_utf8_string()
        bn_market_name = reader.read_utf8_string()
        start_time = reader.read_datetime()
        end_time = reader.read_datetime()

        chart = ChartData(
            version=version,
            market_name=market_name,
            market_currency=market_currency,
            pump_channel=pump_channel,
            bn_market_name=bn_market_name,
            start_time=start_time,
            end_time=end_time
        )

        # 2. Исторические цены - формат PriceTime: (Price, Time)
        n_history = reader.read_int()
        for _ in range(n_history):
            price = reader.read_double()   # Сначала Price
            time = reader.read_datetime()  # Потом TDateTime
            chart.history_prices.append(PricePoint(time=time, price=price))

        # 3. Ордера (string[40] = фиксированный размер 41 байт)
        n_orders = reader.read_int()
        for _ in range(n_orders):
            order_id = reader.read_shortstring_fixed(ORDER_ID_FIXED_SIZE)
            mean_price = reader.read_double()
            create_time = reader.read_datetime()
            open_time = reader.read_datetime()
            close_time = reader.read_datetime()
            chart.orders.append(OrderData(
                order_id=order_id,
                mean_price=mean_price,
                create_time=create_time,
                open_time=open_time,
                close_time=close_time
            ))

        # 4. Трейды - порядок (Time, Price) согласно TMarket.SaveToStreamShort
        n_trades = reader.read_int()
        for _ in range(n_trades):
            time = reader.read_datetime()  # Сначала TDateTime
            price = reader.read_double()   # Потом Price (отрицательная = продажа)
            chart.trades.append(PricePoint(time=time, price=price))

        # 5. Статистика (дельты/объёмы)
        chart.deltas = DeltaVolumes(
            last_1m_delta=reader.read_double(),
            last_5m_delta=reader.read_double(),
            last_1h_delta=reader.read_double(),
            last_3h_delta=reader.read_double(),
            last_24h_delta=reader.read_double(),
            pump_delta_1h=reader.read_double(),
            dump_delta_1h=reader.read_double(),
            hvol=reader.read_double(),
            hvol_fast=reader.read_double(),
            test_price_down=reader.read_double(),
            test_price_up=reader.read_double(),
            is_moonshot=reader.read_byte() == 1,
            session_profit=reader.read_double()
        )

        # 6. Линия средней цены - формат PriceTime: (Price, Time)
        n_closest = reader.read_int()
        for _ in range(n_closest):
            price = reader.read_double()   # Сначала Price
            time = reader.read_datetime()  # Потом TDateTime
            chart.closest_prices.append(PricePoint(time=time, price=price))

        # 7. Мини-свечи (бары)
        n_candles = reader.read_int()
        for _ in range(n_candles):
            time = reader.read_datetime()
            count = reader.read_int()
            min_price = reader.read_double()
            max_price = reader.read_double()
            buy_vol = reader.read_double()
            sell_vol = reader.read_double()
            chart.candles.append(MiniCandle(
                time=time,
                count=count,
                min_price=min_price,
                max_price=max_price,
                buy_volume=buy_vol,
                sell_volume=sell_vol
            ))

        logger.info(
            f"[CHART-PARSER] Parsed: {chart.market_name} | "
            f"prices={len(chart.history_prices)}, trades={len(chart.trades)}, "
            f"orders={len(chart.orders)}, bars={len(chart.candles)}"
        )

        return chart

    except EOFError as e:
        logger.error(f"[CHART-PARSER] Unexpected EOF: {e}")
        return None
    except Exception as e:
        logger.exception(f"[CHART-PARSER] Parse error: {e}")
        return None


def parse_header(data: bytes) -> Optional[ChartHeader]:
    """Парсит заголовок пакета (8 байт)"""
    if len(data) < HEADER_SIZE:
        return None

    if data[:2] == GZIP_MAGIC:
        return None

    try:
        flag, kind, order_id, block_num, blocks_count = struct.unpack(
            '<BBiBB', data[:HEADER_SIZE]
        )

        if flag != CHART_FLAG or kind != CHART_KIND:
            return None

        return ChartHeader(
            flag=flag,
            kind=kind,
            order_id=order_id,
            block_num=block_num,
            blocks_count=blocks_count
        )
    except struct.error:
        return None


def parse_chart_packet(data: bytes) -> Optional[Tuple[ChartHeader, Optional[ChartData]]]:
    """
    Парсит UDP пакет с графиком

    Args:
        data: Бинарные данные UDP пакета

    Returns:
        (header, chart_data) или None если не график
        chart_data = None для фрагментированных пакетов (нужна сборка)
    """
    header = parse_header(data)
    if not header:
        return None

    chart_data = data[HEADER_SIZE:]

    # Распаковываем GZIP если нужно
    if chart_data[:2] == GZIP_MAGIC:
        try:
            chart_data = gzip.decompress(chart_data)
            logger.debug(f"[CHART-PARSER] Decompressed GZIP: {len(chart_data)} bytes")
        except Exception as e:
            logger.error(f"[CHART-PARSER] GZIP decompress failed: {e}")
            return (header, None)

    # Фрагментированный пакет - нужна сборка
    if header.blocks_count > 1:
        logger.debug(f"[CHART-PARSER] Fragment {header.block_num + 1}/{header.blocks_count}")
        return (header, None)

    # Полный пакет - парсим сразу
    chart = parse_chart_binary(chart_data)
    return (header, chart)


def is_chart_packet(data: bytes) -> bool:
    """Быстрая проверка: является ли пакет графиком?"""
    return parse_header(data) is not None

