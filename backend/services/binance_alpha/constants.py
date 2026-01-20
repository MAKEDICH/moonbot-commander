"""
Константы для сервиса Binance Alpha.
"""

from pathlib import Path

# Путь для кэша данных
CACHE_DIR = Path(__file__).parent.parent.parent / "data"
CACHE_FILE = CACHE_DIR / "binance_alpha_cache.json"

# Базовый URL Binance Alpha
BASE_URL = "https://web3.binance.com/ru/markets/alpha"

# Сети для парсинга
CHAINS = {
    'bsc': 'BSC',
    'sol': 'Solana', 
    'base': 'BASE'
}

# Исключаемые стейблкоины
EXCLUDED_STABLECOINS = {'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP'}

