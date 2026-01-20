"""
Утилиты для UDP Listener

Вспомогательные функции для работы с UDP listener
"""
import re
from datetime import datetime
from typing import Optional
from utils.logging import log


def safe_float(value: str) -> Optional[float]:
    """Безопасное преобразование в float"""
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def safe_int(value: str) -> Optional[int]:
    """Безопасное преобразование в int"""
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def safe_bool(value) -> bool:
    """Безопасное преобразование в bool"""
    try:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes')
        return bool(int(value))
    except (ValueError, TypeError, AttributeError):
        return False


def parse_timestamp(value) -> Optional[datetime]:
    """Преобразование timestamp в datetime"""
    try:
        if not value:
            return None
        timestamp = int(value)
        if timestamp == 0:
            return None
        return datetime.fromtimestamp(timestamp)
    except (ValueError, TypeError, OSError):
        return None


def extract_symbol_from_fname(fname: str, server_id: int) -> Optional[str]:
    """
    Извлечение Symbol из FName
    
    FName формат: {Exchange}{Type}_{BaseCurrency}-{SYMBOL}_{DateTime}.bin
    
    Примеры:
    - BinanceF_USDT-SAPIEN_18-11-2025 19-23-11_2.bin → SAPIEN
    - BinanceS_TRY-AXS_18-11-2025 12-42-19_2.bin → AXS
    - BybitS_USDT-XTER_18-11-2025 11-05-11_2.bin → XTER
    
    Args:
        fname: Значение поля FName из UPDATE команды
        server_id: ID сервера для логирования
    
    Returns:
        Symbol или None если не удалось извлечь
    """
    if not fname:
        return None
    
    try:
        match = re.search(r'_([A-Z]{2,6})-([A-Z0-9]{2,20})_', str(fname), re.IGNORECASE)
        if match:
            base_currency = match.group(1).upper()
            symbol = match.group(2).upper()
            
            if symbol.isdigit():
                return None
            
            if re.match(r'^\d{2}-\d{2}', symbol):
                return None
            
            log(f"[UDP-LISTENER-{server_id}] ✅ Extracted Symbol from FName: {symbol} (base: {base_currency})")
            return symbol
        
    except Exception as e:
        log(f"[UDP-LISTENER-{server_id}] ⚠️ Error extracting symbol from FName '{fname}': {e}")
    
    return None


def normalize_localhost_ip(ip: str) -> str:
    """
    Нормализация localhost адресов для корректного маппинга
    
    Проблема: когда бот на том же сервере, пакеты могут приходить с разных адресов:
    - 127.0.0.1 (IPv4 localhost)
    - ::1 (IPv6 localhost) 
    - Реальный IP сервера (когда соединение идет через внешний интерфейс)
    
    Решение: приводим все localhost варианты к 127.0.0.1
    """
    if ip in ('localhost', '::1', '0.0.0.0'):
        return '127.0.0.1'
    if ip.startswith('::ffff:'):
        return ip.replace('::ffff:', '')
    return ip


def extract_currency(message: str, server_id: int) -> str:
    """
    Извлечение валюты из lst ответа
    
    Поддерживает любые валюты от 2 до 10 символов (только буквы).
    Примеры: USD, USDT, USDC, TRY, EUR, RUB, BTC, ETH, BNB, SOL, POLYGON и т.д.
    
    Returns:
        Код валюты (TRY, USDC, USDT, BTC, ETH, etc.)
    """
    log(f"[UDP-LISTENER-{server_id}] 🔍 Analyzing currency from: {message[:100]}...")
    
    excluded_words = {
        'TOTAL', 'OPEN', 'SELL', 'BUY', 'ORDERS', 'AVAILABLE',
        'PRICE', 'AMOUNT', 'VOLUME', 'HIGH', 'LOW', 'CLOSE',
        'PROFIT', 'LOSS', 'BALANCE', 'MARGIN', 'EQUITY',
        'FREE', 'USED', 'LOCKED', 'PENDING', 'STATUS', 'SPOT'
    }
    
    stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'GUSD']
    
    found_currencies = []
    
    patterns = [
        (r'([A-Z]{2,10})[:：]?\s*[\d,\.]+\s*\$', 100),
        (r'(?:Available|Доступно)\s+([A-Z]{2,10})[:：]', 90),
        (r'[\d,\.]+\s+([A-Z]{2,10})(?:\s|$)', 80),
        (r'([A-Z]{2,10})\s*[:：]\s*[\d,\.]+', 70),
        (r'(?:Balance|Total|Баланс):\s*[\d,\.]+\s+([A-Z]{2,10})', 60),
        (r'\b([A-Z]{2,10})\b', 30),
    ]
    
    for pattern, priority in patterns:
        for match in re.finditer(pattern, message, re.IGNORECASE | re.MULTILINE):
            currency = match.group(1).upper()
            
            if currency in excluded_words:
                continue
            
            if 2 <= len(currency) <= 10 and currency.isalpha():
                position = match.start()
                found_currencies.append((currency, priority, position))
                log(f"[UDP-LISTENER-{server_id}] 💡 Found potential currency: {currency} (priority={priority}, pos={position})")
    
    has_dollar_sign = bool(re.search(r'\$', message))
    
    if found_currencies:
        found_currencies.sort(key=lambda x: (-x[1], x[2]))
        best_currency = found_currencies[0][0]
        
        if has_dollar_sign and best_currency not in stablecoins:
            stablecoin_found = next((c[0] for c in found_currencies if c[0] in stablecoins), None)
            if stablecoin_found:
                log(f"[UDP-LISTENER-{server_id}] 💱 Detected stablecoin with $: {stablecoin_found}")
                return stablecoin_found
        
        log(f"[UDP-LISTENER-{server_id}] 💱 Detected currency: {best_currency}")
        return best_currency
    
    if has_dollar_sign:
        log(f"[UDP-LISTENER-{server_id}] 💱 Only $ sign found, defaulting to USDT")
        return 'USDT'
    
    log(f"[UDP-LISTENER-{server_id}] 💱 No currency detected, using default: USDT")
    return 'USDT'




