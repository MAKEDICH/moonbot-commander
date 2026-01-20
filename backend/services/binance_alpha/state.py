"""
Глобальное состояние сервиса Binance Alpha.

Централизованное управление состоянием для thread-safe доступа.
"""

import threading
from datetime import datetime
from typing import List, Dict, Optional

# Lock для thread-safe доступа к глобальному состоянию
_lock = threading.Lock()

# Глобальные данные
_coins_data: List[Dict] = []
_last_update: Optional[datetime] = None
_is_updating: bool = False
_update_progress: Dict = {'percent': 0, 'stage': '', 'chain': ''}


def get_state() -> Dict:
    """Получить текущее состояние."""
    with _lock:
        return {
            'coins_data': _coins_data.copy(),
            'last_update': _last_update,
            'is_updating': _is_updating,
            'update_progress': _update_progress.copy()
        }


def set_coins_data(coins: List[Dict]) -> None:
    """Установить данные о монетах."""
    global _coins_data
    with _lock:
        _coins_data = coins


def set_last_update(timestamp: Optional[datetime]) -> None:
    """Установить время последнего обновления."""
    global _last_update
    with _lock:
        _last_update = timestamp


def set_is_updating(value: bool) -> None:
    """Установить флаг обновления."""
    global _is_updating
    with _lock:
        _is_updating = value


def set_update_progress(progress: Dict) -> None:
    """Установить прогресс обновления."""
    global _update_progress
    with _lock:
        _update_progress = progress


def is_updating() -> bool:
    """Проверить, выполняется ли обновление."""
    with _lock:
        return _is_updating

