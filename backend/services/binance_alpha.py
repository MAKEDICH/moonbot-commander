"""
Сервис Binance Alpha Tracker.

Парсинг данных о монетах Binance Alpha через Selenium с перехватом API ответов.
"""

import os
import json
import time
import re
import threading
import logging
import base64
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Set

logger = logging.getLogger(__name__)

# Путь для кэша данных
CACHE_DIR = Path(__file__).parent.parent / "data"
CACHE_FILE = CACHE_DIR / "binance_alpha_cache.json"

# Глобальные данные
_coins_data: List[Dict] = []
_last_update: Optional[datetime] = None
_is_updating: bool = False
_update_progress: Dict = {'percent': 0, 'stage': '', 'chain': ''}


# Сети для парсинга
CHAINS = {
    'bsc': 'BSC',
    'sol': 'Solana', 
    'base': 'BASE'
}


class BinanceAlphaParser:
    """Парсер монет Binance Alpha через Selenium с перехватом API."""
    
    def __init__(self, progress_callback=None):
        self.base_url = "https://web3.binance.com/ru/markets/alpha"
        self.coins = []
        self.progress_callback = progress_callback
    
    def _report_progress(self, percent: int, stage: str, chain: str = ''):
        """Отправить прогресс через callback."""
        if self.progress_callback:
            self.progress_callback(percent, stage, chain)

    def parse_with_selenium(self) -> List[Dict]:
        """
        Надёжный парсинг через Selenium с перехватом API ответов.
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
        except ImportError:
            logger.error("Selenium не установлен: pip install selenium")
            return []
        
        chrome_options = Options()
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--log-level=3')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_experimental_option('excludeSwitches', ['enable-logging', 'enable-automation'])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Включаем перехват сетевых запросов
        chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        all_coins = []
        seen_symbols: Set[str] = set()
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.execute_cdp_cmd('Network.enable', {})
            
            chain_list = list(CHAINS.items())
            total_chains = len(chain_list)
            
            for chain_idx, (chain_key, chain_name) in enumerate(chain_list):
                chain_base_percent = 10 + (chain_idx * 25)
                self._report_progress(chain_base_percent, f'Загрузка {chain_name}', chain_name)
                
                url = f"{self.base_url}?chain={chain_key}"
                logger.info(f"[BINANCE-ALPHA] Opening: {url}")
                
                try:
                    driver.get(url)
                    
                    # Ждём загрузки таблицы (макс 10 сек)
                    try:
                        WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.CSS_SELECTOR, ".markets-table"))
                        )
                    except Exception:
                        logger.warning(f"[BINANCE-ALPHA] Table not found for {chain_name}")
                        continue
                    
                    # Короткая пауза для рендеринга данных
                    time.sleep(1.5)
                    
                    # Используем надёжный метод со скроллингом внутри .markets-table
                    chain_tokens = self._parse_all_tokens_with_scroll(driver, chain_name)
                    
                    # Если скролл-метод не сработал - пробуем API перехват
                    if not chain_tokens:
                        api_tokens = self._extract_tokens_from_network(driver, chain_name)
                        for token in api_tokens:
                            key = f"{token['symbol']}_{chain_name}"
                            if key not in seen_symbols:
                                chain_tokens.append(token)
                                seen_symbols.add(key)
                    
                    # Если и API не сработал - простой DOM парсинг
                    if not chain_tokens:
                        chain_tokens = self._parse_dom_tokens(driver, chain_name)
                    
                    # Добавляем уникальные токены
                    for token in chain_tokens:
                        key = f"{token['symbol']}_{chain_name}"
                        if key not in seen_symbols:
                            seen_symbols.add(key)
                            all_coins.append(token)
                    
                    logger.info(f"[BINANCE-ALPHA] {chain_name}: найдено {len([c for c in all_coins if c['chain'] == chain_name])} токенов")
                    
                except Exception as e:
                    logger.error(f"[BINANCE-ALPHA] Error parsing {chain_name}: {e}")
                    continue
            
            driver.quit()
            
        except Exception as e:
            logger.error(f"[BINANCE-ALPHA] Selenium error: {e}")
            import traceback
            logger.error(traceback.format_exc())
        
        self._report_progress(95, 'Завершение', '')
        self.coins = all_coins
        logger.info(f"[BINANCE-ALPHA] Всего найдено: {len(all_coins)} токенов")
        
        return all_coins

    def _extract_tokens_from_network(self, driver, chain_name: str) -> List[Dict]:
        """Извлечь токены из перехваченных сетевых ответов."""
        tokens = []
        now_iso = datetime.now().isoformat()
        
        try:
            logs = driver.get_log('performance')
            
            for log in logs:
                try:
                    message = json.loads(log['message'])
                    method = message.get('message', {}).get('method', '')
                    
                    if method == 'Network.responseReceived':
                        response = message['message']['params'].get('response', {})
                        url = response.get('url', '')
                        
                        if 'rank/list' in url or 'alpha' in url.lower():
                            request_id = message['message']['params'].get('requestId')
                            if request_id:
                                try:
                                    body = driver.execute_cdp_cmd(
                                        'Network.getResponseBody', 
                                        {'requestId': request_id}
                                    )
                                    body_text = body.get('body', '')
                                    
                                    if body_text:
                                        data = json.loads(body_text)
                                        extracted = self._extract_from_api_response(data, chain_name, now_iso)
                                        tokens.extend(extracted)
                                except Exception:
                                    pass
                                    
                except Exception:
                    continue
                    
        except Exception as e:
            logger.debug(f"[BINANCE-ALPHA] Network extraction error: {e}")
        
        return tokens

    def _extract_from_api_response(self, data: dict, chain_name: str, timestamp: str) -> List[Dict]:
        """Извлечь токены из JSON ответа API."""
        tokens = []
        
        if not isinstance(data, dict):
            return tokens
        
        # Ищем массив токенов в различных местах
        token_arrays = []
        
        if 'data' in data:
            d = data['data']
            if isinstance(d, dict):
                for key in ['tokens', 'rows', 'list', 'items']:
                    if key in d and isinstance(d[key], list):
                        token_arrays.append(d[key])
            elif isinstance(d, list):
                token_arrays.append(d)
        
        for arr in token_arrays:
            for item in arr:
                if not isinstance(item, dict):
                    continue
                
                symbol = item.get('symbol') or item.get('tokenSymbol') or item.get('ticker')
                if symbol and self._is_valid_symbol(symbol):
                    tokens.append({
                        'symbol': symbol.upper(),
                        'name': item.get('tokenName', symbol),
                        'chain': chain_name,
                        'contractAddress': item.get('contractAddress', ''),
                        'price': item.get('price'),
                        'marketCap': item.get('marketCap'),
                        'liquidity': item.get('liquidity'),
                        'volume24h': item.get('volume24h'),
                        'holders': item.get('holders'),
                        'timestamp': timestamp
                    })
        
        return tokens

    def _parse_all_tokens_with_scroll(self, driver, chain_name: str) -> List[Dict]:
        """
        Надёжный парсинг ВСЕХ токенов через скроллинг.
        10 проходов для полного покрытия виртуализированной таблицы.
        """
        now_iso = datetime.now().isoformat()
        all_tokens = {}
        
        try:
            # Комбинированный скрипт: скролл + сбор за один вызов
            combined_script = """
            const container = document.querySelector('.markets-table');
            if (!container) return { error: 'no container' };
            
            if (arguments[0] !== null) {
                container.scrollTop = arguments[0];
            }
            
            const tokens = [];
            document.querySelectorAll('a[data-ca]').forEach(link => {
                const ca = link.getAttribute('data-ca');
                const span = link.querySelector('span.t-subtitle1');
                const symbol = span?.textContent?.trim();
                if (symbol && ca) tokens.push({ symbol, ca });
            });
            
            return { 
                tokens,
                scrollHeight: container.scrollHeight,
                scrollTop: container.scrollTop,
                clientHeight: container.clientHeight
            };
            """
            
            listing_order = [0]  # Счётчик порядка обнаружения
            
            def scroll_and_collect(pos):
                try:
                    result = driver.execute_script(combined_script, pos)
                    if result and 'tokens' in result:
                        for t in result['tokens']:
                            ca = t.get('ca')
                            symbol = t.get('symbol', '').strip()
                            if ca and symbol and ca not in all_tokens:
                                all_tokens[ca] = {
                                    'symbol': symbol, 
                                    'contractAddress': ca,
                                    'order': listing_order[0]
                                }
                                listing_order[0] += 1
                        return result.get('scrollHeight', 5000)
                except Exception:
                    pass
                return 5000
            
            # Инициализация
            scroll_and_collect(0)
            time.sleep(0.2)
            scroll_height = scroll_and_collect(0)
            step = 150
            
            # === 10 ПРОХОДОВ ===
            for pass_num in range(10):
                if pass_num % 2 == 0:
                    # Чётные проходы: вниз
                    pos = 0
                    while pos < scroll_height + 500:
                        pos += step
                        new_height = scroll_and_collect(pos)
                        if new_height > scroll_height:
                            scroll_height = new_height
                        time.sleep(0.03)
                else:
                    # Нечётные проходы: вверх
                    pos = scroll_height
                    while pos > 0:
                        pos -= step
                        scroll_and_collect(max(0, pos))
                        time.sleep(0.03)
            
            # Финальный сбор сверху
            scroll_and_collect(0)
            time.sleep(0.1)
            
            # Результат - сортируем по порядку обнаружения
            sorted_tokens = sorted(all_tokens.values(), key=lambda x: x.get('order', 9999))
            tokens = [
                {
                    'symbol': d['symbol'],
                    'name': d['symbol'],
                    'chain': chain_name,
                    'contractAddress': d['contractAddress'],
                    'listingOrder': d.get('order', 0),
                    'timestamp': now_iso
                }
                for d in sorted_tokens
                if d.get('symbol') and 1 <= len(d['symbol']) <= 20
            ]
            
            logger.info(f"[BINANCE-ALPHA] {chain_name}: Found {len(tokens)} tokens")
            return tokens
            
        except Exception as e:
            logger.error(f"[BINANCE-ALPHA] Scroll error {chain_name}: {e}")
            return []
    
    def _parse_dom_tokens(self, driver, chain_name: str) -> List[Dict]:
        """Резервный метод парсинга DOM."""
        tokens = []
        now_iso = datetime.now().isoformat()
        
        try:
            script = """
            const tokens = [];
            const links = document.querySelectorAll('a[data-ca]');
            
            links.forEach(link => {
                const contractAddress = link.getAttribute('data-ca');
                const symbolSpan = link.querySelector('span.t-subtitle1');
                const symbol = symbolSpan?.textContent?.trim();
                
                if (symbol && contractAddress) {
                    tokens.push({ symbol, contractAddress });
                }
            });
            
            return tokens;
            """
            
            result = driver.execute_script(script)
            
            for item in result:
                symbol = item.get('symbol', '')
                if symbol and len(symbol) >= 1 and len(symbol) <= 20:
                    tokens.append({
                        'symbol': symbol,
                        'name': symbol,
                        'chain': chain_name,
                        'contractAddress': item.get('contractAddress', ''),
                        'timestamp': now_iso
                    })
                    
        except Exception as e:
            logger.debug(f"[BINANCE-ALPHA] DOM parsing error: {e}")
        
        return tokens

    def _is_valid_symbol(self, symbol: str) -> bool:
        """Проверка валидности символа."""
        if not symbol or not isinstance(symbol, str):
            return False
        
        symbol = symbol.strip().upper()
        
        if len(symbol) < 1 or len(symbol) > 15:
            return False
        
        # Исключаем стейблкоины
        excluded = {'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'}
        if symbol in excluded:
            return False
        
        # Должен содержать хотя бы одну букву
        if not any(c.isalpha() for c in symbol):
            return False
        
        return True

    def get_coins(self) -> List[Dict]:
        """Получить список монет."""
        if not self.coins:
            self.parse_with_selenium()
        return self.coins
    
    def save_to_json(self, filename: str = None):
        """Сохранить в JSON."""
        if filename is None:
            filename = str(CACHE_FILE)
        
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        data = {
            'updated': datetime.now().isoformat(),
            'count': len(self.coins),
            'coins': self.coins
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def _load_from_cache() -> bool:
    """Загрузка данных из кэша."""
    global _coins_data, _last_update
    
    if not CACHE_FILE.exists():
        return False
    
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            cached_coins = data.get('coins', [])
            cached_time = data.get('updated')
            
            if cached_coins:
                _coins_data = cached_coins
                _last_update = datetime.fromisoformat(cached_time) if cached_time else None
                logger.info(f"[BINANCE-ALPHA] Loaded {len(cached_coins)} coins from cache")
                return True
    except Exception as e:
        logger.error(f"Ошибка загрузки кэша Binance Alpha: {e}")
    
    return False


def _do_update():
    """Синхронное обновление данных (вызывается в отдельном потоке)."""
    global _coins_data, _last_update, _is_updating, _update_progress
    
    try:
        _update_progress = {'percent': 0, 'stage': 'Инициализация', 'chain': ''}
        
        parser = BinanceAlphaParser(progress_callback=_update_progress_callback)
        new_coins = parser.get_coins()
        
        _update_progress = {'percent': 100, 'stage': 'Завершено', 'chain': ''}
        
        if new_coins:
            _coins_data = new_coins
            _last_update = datetime.now()
            parser.save_to_json()
            logger.info(f"[BINANCE-ALPHA] Updated: {len(new_coins)} coins")
        else:
            logger.warning("[BINANCE-ALPHA] No coins received")
            
    except Exception as e:
        logger.error(f"Ошибка обновления Binance Alpha: {e}")
        import traceback
        logger.error(traceback.format_exc())
        _update_progress = {'percent': 0, 'stage': 'Ошибка', 'chain': ''}
    finally:
        _is_updating = False


def _update_progress_callback(percent: int, stage: str, chain: str = ''):
    """Callback для обновления прогресса."""
    global _update_progress
    _update_progress = {'percent': percent, 'stage': stage, 'chain': chain}


def get_coins(chain: Optional[str] = None) -> Dict:
    """Получить список монет."""
    global _coins_data, _last_update, _is_updating
    
    coins = _coins_data
    
    if chain and chain.upper() not in ['', 'ALL']:
        chain_upper = chain.upper()
        if chain_upper == 'SOL':
            chain_upper = 'SOLANA'
        coins = [c for c in _coins_data if c.get('chain', '').upper() == chain_upper]
    
    return {
        'success': True,
        'count': len(coins),
        'total_count': len(_coins_data),
        'chain': chain if chain else 'ALL',
        'updated': _last_update.isoformat() if _last_update else None,
        'is_updating': _is_updating,
        'progress': _update_progress if _is_updating else None,
        'coins': coins
    }


def update_coins() -> Dict:
    """Принудительное обновление данных."""
    global _is_updating
    
    if _is_updating:
        return {
            'success': False,
            'message': 'Обновление уже выполняется'
        }
    
    _is_updating = True
    
    thread = threading.Thread(target=_do_update, daemon=True)
    thread.start()
    
    # Ждём немного чтобы проверить статус
    thread.join(timeout=2.0)
    
    if _is_updating:
        return {
            'success': True,
            'message': 'Обновление запущено',
            'is_updating': True
        }
    else:
        if _coins_data:
            return {
                'success': True,
                'count': len(_coins_data),
                'updated': _last_update.isoformat() if _last_update else None,
                'coins': _coins_data
            }
        else:
            return {
                'success': False,
                'message': 'Не удалось получить данные'
            }


def get_status() -> Dict:
    """Получить статус сервиса."""
    return {
        'status': 'running',
        'coins_count': len(_coins_data),
        'last_update': _last_update.isoformat() if _last_update else None,
        'is_updating': _is_updating,
        'progress': _update_progress if _is_updating else None
    }


# Инициализация - загружаем кэш при импорте модуля
_load_from_cache()
