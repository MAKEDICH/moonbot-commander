"""
Бинарный читатель для формата Delphi
"""

import struct
from datetime import datetime, timedelta
from typing import Optional

from .constants import DELPHI_EPOCH


class BinaryReader:
    """Эффективный читатель бинарных данных в формате Delphi"""

    __slots__ = ('_data', '_view', '_pos', '_len')

    def __init__(self, data: bytes) -> None:
        self._data = data
        self._view = memoryview(data)
        self._pos = 0
        self._len = len(data)

    @property
    def pos(self) -> int:
        return self._pos

    @pos.setter
    def pos(self, value: int) -> None:
        self._pos = value

    @property
    def remaining(self) -> int:
        return self._len - self._pos

    def _check_bounds(self, size: int) -> None:
        if self._pos + size > self._len:
            raise EOFError(f"Read beyond bounds: pos={self._pos}, need={size}, len={self._len}")

    def read_byte(self) -> int:
        self._check_bounds(1)
        value = self._data[self._pos]
        self._pos += 1
        return value

    def read_word(self) -> int:
        """Читает word (2 байта, unsigned)"""
        self._check_bounds(2)
        value = struct.unpack_from('<H', self._view, self._pos)[0]
        self._pos += 2
        return value

    def read_int(self) -> int:
        """Читает integer (4 байта, signed)"""
        self._check_bounds(4)
        value = struct.unpack_from('<i', self._view, self._pos)[0]
        self._pos += 4
        return value

    def read_double(self) -> float:
        """Читает double (8 байт)"""
        self._check_bounds(8)
        value = struct.unpack_from('<d', self._view, self._pos)[0]
        self._pos += 8
        return value

    def read_utf8_string(self) -> str:
        """Читает UTF-8 строку (2 байта длина + данные)"""
        length = self.read_word()
        if length == 0:
            return ""
        self._check_bounds(length)
        value = self._data[self._pos:self._pos + length].decode('utf-8', errors='replace')
        self._pos += length
        return value

    def read_shortstring_fixed(self, fixed_size: int = 41) -> str:
        """
        Читает ShortString фиксированного размера (string[40] = 41 байт)
        
        В Delphi string[40] занимает ровно 41 байт:
        - 1 байт: длина строки
        - 40 байт: данные (заполнены нулями если строка короче)
        """
        self._check_bounds(fixed_size)
        length = self._data[self._pos]
        # Читаем только актуальные данные
        value = self._data[self._pos + 1:self._pos + 1 + min(length, fixed_size - 1)].decode(
            'windows-1251', errors='replace'
        )
        self._pos += fixed_size  # Всегда пропускаем полный размер
        return value

    def read_datetime(self) -> datetime:
        """Читает TDateTime (double) и конвертирует в Python datetime"""
        delphi_time = self.read_double()
        try:
            if delphi_time == 0:
                return DELPHI_EPOCH
            return DELPHI_EPOCH + timedelta(days=delphi_time)
        except (OverflowError, OSError):
            return DELPHI_EPOCH

    def skip(self, size: int) -> None:
        """Пропускает указанное количество байт"""
        self._check_bounds(size)
        self._pos += size

