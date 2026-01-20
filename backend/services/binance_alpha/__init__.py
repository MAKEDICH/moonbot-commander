"""
Сервис Binance Alpha Tracker.

Парсинг данных о монетах Binance Alpha через Selenium с перехватом API ответов.
Публичный API модуля.
"""

import threading
import logging
from datetime import datetime
from typing import Dict, Optional

from utils.datetime_utils import format_iso
from .constants import CACHE_FILE, CACHE_DIR
from .parser import BinanceAlphaParser
from .state import (
    get_state,
    set_coins_data,
    set_last_update,
    set_is_updating,
    set_update_progress,
    is_updating
)

logger = logging.getLogger(__name__)


def _load_from_cache() -> bool:
    """Загрузка данных из кэша."""
    import json
    
    if not CACHE_FILE.exists():
        return False
    
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            cached_coins = data.get('coins', [])
            cached_time = data.get('updated')
            
            if cached_coins:
                set_coins_data(cached_coins)
                # Устанавливаем время обновления (None если отсутствует в кэше)
                set_last_update(datetime.fromisoformat(cached_time) if cached_time else None)
                logger.info(f"[BINANCE-ALPHA] Loaded {len(cached_coins)} coins from cache")
                return True
    except Exception as e:
        logger.error(f"Ошибка загрузки кэша Binance Alpha: {e}")
    
    return False


def _update_progress_callback(percent: int, stage: str, chain: str = '') -> None:
    """Callback для обновления прогресса."""
    set_update_progress({'percent': percent, 'stage': stage, 'chain': chain})


def _do_update() -> None:
    """Синхронное обновление данных (вызывается в отдельном потоке)."""
    try:
        set_update_progress({'percent': 0, 'stage': 'Инициализация', 'chain': ''})
        
        parser = BinanceAlphaParser(progress_callback=_update_progress_callback)
        new_coins = parser.get_coins()
        
        set_update_progress({'percent': 100, 'stage': 'Завершено', 'chain': ''})
        
        if new_coins:
            set_coins_data(new_coins)
            set_last_update(datetime.now())
            parser.save_to_json()
            logger.info(f"[BINANCE-ALPHA] Updated: {len(new_coins)} coins")
        else:
            logger.warning("[BINANCE-ALPHA] No coins received")
            
    except Exception as e:
        logger.error(f"Ошибка обновления Binance Alpha: {e}")
        import traceback
        logger.error(traceback.format_exc())
        set_update_progress({'percent': 0, 'stage': 'Ошибка', 'chain': ''})
    finally:
        set_is_updating(False)


def get_coins(chain: Optional[str] = None) -> Dict:
    """Получить список монет."""
    state = get_state()
    coins_data = state['coins_data']
    last_update = state['last_update']
    updating = state['is_updating']
    progress = state['update_progress']
    
    coins = coins_data
    
    if chain and chain.upper() not in ['', 'ALL']:
        chain_upper = chain.upper()
        if chain_upper == 'SOL':
            chain_upper = 'SOLANA'
        coins = [c for c in coins_data if c.get('chain', '').upper() == chain_upper]
    
    return {
        'success': True,
        'count': len(coins),
        'total_count': len(coins_data),
        'chain': chain if chain else 'ALL',
        'updated': format_iso(last_update) if last_update else None,
        'is_updating': updating,
        'progress': progress if updating else None,
        'coins': coins
    }


def update_coins() -> Dict:
    """Принудительное обновление данных."""
    if is_updating():
        return {
            'success': False,
            'message': 'Обновление уже выполняется'
        }
    
    set_is_updating(True)
    
    thread = threading.Thread(target=_do_update, daemon=True)
    thread.start()
    
    # Ждём немного чтобы проверить статус
    thread.join(timeout=2.0)
    
    state = get_state()
    
    if state['is_updating']:
        return {
            'success': True,
            'message': 'Обновление запущено',
            'is_updating': True
        }
    else:
        if state['coins_data']:
            return {
                'success': True,
                'count': len(state['coins_data']),
                'updated': format_iso(state['last_update']) if state['last_update'] else None,
                'coins': state['coins_data']
            }
        else:
            return {
                'success': False,
                'message': 'Не удалось получить данные'
            }


def get_status() -> Dict:
    """Получить статус сервиса."""
    state = get_state()
    return {
        'status': 'running',
        'coins_count': len(state['coins_data']),
        'last_update': format_iso(state['last_update']) if state['last_update'] else None,
        'is_updating': state['is_updating'],
        'progress': state['update_progress'] if state['is_updating'] else None
    }


# Инициализация - загружаем кэш при импорте модуля
_load_from_cache()

