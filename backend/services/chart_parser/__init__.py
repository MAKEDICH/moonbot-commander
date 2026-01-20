"""
Chart Parser - Парсер бинарных графиков (TMoonCmdHeader + TMarket.SaveToStreamShort)

Формат данных:
- TMoonCmdHeader: 8 байт заголовок UDP пакета
- TMarket.SaveToStreamShort: бинарный формат графика (Delphi)

Основано на решении от второго разработчика.
"""

from .constants import (
    DELPHI_EPOCH,
    GZIP_MAGIC,
    HEADER_SIZE,
    CHART_FLAG,
    CHART_KIND,
    ORDER_ID_FIXED_SIZE,
)

from .models import (
    ChartHeader,
    PricePoint,
    OrderData,
    MiniCandle,
    DeltaVolumes,
    ChartData,
)

from .binary_reader import BinaryReader

from .parser import (
    parse_chart_binary,
    parse_header,
    parse_chart_packet,
    is_chart_packet,
)

from .assembler import ChartFragmentAssembler


__all__ = [
    # Constants
    'DELPHI_EPOCH',
    'GZIP_MAGIC',
    'HEADER_SIZE',
    'CHART_FLAG',
    'CHART_KIND',
    'ORDER_ID_FIXED_SIZE',
    # Models
    'ChartHeader',
    'PricePoint',
    'OrderData',
    'MiniCandle',
    'DeltaVolumes',
    'ChartData',
    # Reader
    'BinaryReader',
    # Parser functions
    'parse_chart_binary',
    'parse_header',
    'parse_chart_packet',
    'is_chart_packet',
    # Assembler
    'ChartFragmentAssembler',
]

