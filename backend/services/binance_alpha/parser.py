"""
Парсер монет Binance Alpha через Selenium с перехватом API.
"""

import json
import time
import logging
from datetime import datetime
from typing import List, Dict, Optional, Set, Callable

from utils.datetime_utils import format_iso
from .constants import BASE_URL, CHAINS, CACHE_DIR, CACHE_FILE, EXCLUDED_STABLECOINS

logger = logging.getLogger(__name__)


class BinanceAlphaParser:
    """Парсер монет Binance Alpha через Selenium с перехватом API."""
    
    def __init__(self, progress_callback: Optional[Callable[[int, str, str], None]] = None):
        """
        Инициализация парсера.
        
        Args:
            progress_callback: Функция для отправки прогресса (percent, stage, chain)
        """
        self.base_url = BASE_URL
        self.coins: List[Dict] = []
        self.progress_callback = progress_callback
    
    def _report_progress(self, percent: int, stage: str, chain: str = '') -> None:
        """Отправить прогресс через callback."""
        if self.progress_callback:
            self.progress_callback(percent, stage, chain)

    def parse_with_selenium(self) -> List[Dict]:
        """
        Надёжный парсинг через Selenium с перехватом API ответов.
        
        Returns:
            Список токенов со всех сетей
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
        
        chrome_options = self._get_chrome_options()
        
        all_coins: List[Dict] = []
        seen_symbols: Set[str] = set()
        driver = None
        
        try:
            driver = webdriver.Chrome(options=chrome_options)
            driver.execute_cdp_cmd('Network.enable', {})
            
            chain_list = list(CHAINS.items())
            
            for chain_idx, (chain_key, chain_name) in enumerate(chain_list):
                chain_base_percent = 10 + (chain_idx * 25)
                self._report_progress(chain_base_percent, f'Загрузка {chain_name}', chain_name)
                
                chain_tokens = self._parse_chain(driver, chain_key, chain_name, seen_symbols)
                all_coins.extend(chain_tokens)
                
                logger.info(
                    f"[BINANCE-ALPHA] {chain_name}: найдено "
                    f"{len([c for c in all_coins if c['chain'] == chain_name])} токенов"
                )
            
        except Exception as e:
            logger.error(f"[BINANCE-ALPHA] Selenium error: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
        
        self._report_progress(95, 'Завершение', '')
        self.coins = all_coins
        logger.info(f"[BINANCE-ALPHA] Всего найдено: {len(all_coins)} токенов")
        
        return all_coins
    
    def _get_chrome_options(self):
        """Получить настройки Chrome для headless режима."""
        from selenium.webdriver.chrome.options import Options
        
        chrome_options = Options()
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--log-level=3')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_experimental_option(
            'excludeSwitches', ['enable-logging', 'enable-automation']
        )
        chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # Включаем перехват сетевых запросов
        chrome_options.set_capability('goog:loggingPrefs', {'performance': 'ALL'})
        
        return chrome_options
    
    def _parse_chain(
        self, 
        driver, 
        chain_key: str, 
        chain_name: str, 
        seen_symbols: Set[str]
    ) -> List[Dict]:
        """
        Парсинг токенов для одной сети.
        
        Args:
            driver: WebDriver
            chain_key: Ключ сети (bsc, sol, base)
            chain_name: Название сети
            seen_symbols: Множество уже обработанных символов
            
        Returns:
            Список уникальных токенов для данной сети
        """
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        
        chain_tokens: List[Dict] = []
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
                return chain_tokens
            
            # Короткая пауза для рендеринга данных
            time.sleep(1.5)
            
            # Используем надёжный метод со скроллингом
            chain_tokens = self._parse_all_tokens_with_scroll(driver, chain_name)
            
            # Добавляем токены scroll в seen_symbols для дедупликации
            if chain_tokens:
                for token in chain_tokens:
                    key = f"{token['symbol']}_{chain_name}"
                    seen_symbols.add(key)
                return chain_tokens
            
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
                # Фильтруем уникальные токены только для DOM парсинга
                unique_tokens: List[Dict] = []
                for token in chain_tokens:
                    key = f"{token['symbol']}_{chain_name}"
                    if key not in seen_symbols:
                        seen_symbols.add(key)
                        unique_tokens.append(token)
                return unique_tokens
            
            return chain_tokens
            
        except Exception as e:
            logger.error(f"[BINANCE-ALPHA] Error parsing {chain_name}: {e}")
            return []

    def _extract_tokens_from_network(self, driver, chain_name: str) -> List[Dict]:
        """Извлечь токены из перехваченных сетевых ответов."""
        tokens: List[Dict] = []
        now_iso = format_iso(datetime.now())
        
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
                                        extracted = self._extract_from_api_response(
                                            data, chain_name, now_iso
                                        )
                                        tokens.extend(extracted)
                                except Exception:
                                    pass
                                    
                except Exception:
                    continue
                    
        except Exception as e:
            logger.debug(f"[BINANCE-ALPHA] Network extraction error: {e}")
        
        return tokens

    def _extract_from_api_response(
        self, 
        data: dict, 
        chain_name: str, 
        timestamp: str
    ) -> List[Dict]:
        """Извлечь токены из JSON ответа API."""
        tokens: List[Dict] = []
        
        if not isinstance(data, dict):
            return tokens
        
        # Ищем массив токенов в различных местах
        token_arrays: List[List] = []
        
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
        now_iso = format_iso(datetime.now())
        all_tokens: Dict[str, Dict] = {}
        
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
        tokens: List[Dict] = []
        now_iso = format_iso(datetime.now())
        
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
                if symbol and 1 <= len(symbol) <= 20:
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
        if symbol in EXCLUDED_STABLECOINS:
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
    
    def save_to_json(self, filename: str = None) -> None:
        """Сохранить в JSON."""
        if filename is None:
            filename = str(CACHE_FILE)
        
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        
        data = {
            'updated': format_iso(datetime.now()),
            'count': len(self.coins),
            'coins': self.coins
        }
        
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

