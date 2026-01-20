"""
Константы для парсера графиков
"""

from datetime import datetime

# Базовая эпоха для конвертации Delphi TDateTime
DELPHI_EPOCH = datetime(1899, 12, 30)

# Magic bytes для GZIP
GZIP_MAGIC = b'\x1f\x8b'

# Размер заголовка UDP пакета
HEADER_SIZE = 8

# Флаг для пакета графика
CHART_FLAG = 0

# Тип пакета (1 = график)
CHART_KIND = 1

# Фиксированный размер для string[40] в Delphi (1 байт длины + 40 байт данных)
ORDER_ID_FIXED_SIZE = 41

