"""
Утилитарные функции для процессоров UDP сообщений

Содержит вспомогательные методы для декомпрессии, очистки значений и обработки фрагментов.
"""
import gzip
import json
from typing import Tuple, Optional

from utils.logging import log


def try_decompress_buffer(
    fragment_buffer: bytearray,
    server_id: int,
    process_strategies_callback,
    process_order_callback,
    process_balance_callback
) -> bool:
    """
    Попытка декомпрессировать собранные фрагменты
    
    Args:
        fragment_buffer: Буфер с собранными фрагментами
        server_id: ID сервера для логирования
        process_strategies_callback: Callback для обработки стратегий
        process_order_callback: Callback для обработки ордеров
        process_balance_callback: Callback для обработки балансов
    
    Returns:
        True если декомпрессия успешна, False иначе
    """
    if not fragment_buffer:
        return False
    
    try:
        decompressed = gzip.decompress(bytes(fragment_buffer))
        decompressed_text = decompressed.decode('utf-8', errors='replace')
        
        log(f"[UDP-LISTENER-{server_id}] [OK] Method 1: Successfully decompressed {len(fragment_buffer)} bytes -> {len(decompressed)} bytes")
        log(f"[UDP-LISTENER-{server_id}] 📄 First 200 chars: {decompressed_text[:200]}")
        
        try:
            payload = json.loads(decompressed_text)
            log(f"[UDP-LISTENER-{server_id}] 📋 JSON parsed, cmd={payload.get('cmd', 'unknown')}")
            
            cmd = payload.get('cmd', '').lower()
            
            if cmd == "strats":
                process_strategies_callback(payload)
            elif cmd == "order":
                process_order_callback(payload)
            elif cmd == "acc":
                process_balance_callback(payload)
            else:
                log(f"[UDP-LISTENER-{server_id}] [WARN] Unknown command in reassembled packet: {cmd}")
            
            return True
                
        except json.JSONDecodeError as e:
            log(f"[UDP-LISTENER-{server_id}] [WARN] Decompressed data is not JSON: {e}")
            log(f"[UDP-LISTENER-{server_id}] First 200 chars: {decompressed_text[:200]}")
            return False
            
    except Exception as e:
        log(f"[UDP-LISTENER-{server_id}] [WARN] Method 1 failed: {e}")
    
    return False


def clean_currency_value(value, server_id: int) -> float:
    """
    Очистка значения валюты от символов
    
    Args:
        value: Значение для очистки (строка или число)
        server_id: ID сервера для логирования
    
    Returns:
        Очищенное числовое значение
    """
    if isinstance(value, str):
        try:
            clean = value.strip().rstrip('$').rstrip('TRY').rstrip('USDT').rstrip('USDC').rstrip('BTC').rstrip('ETH').strip()
            return float(clean)
        except (ValueError, TypeError) as e:
            log(f"[UDP-LISTENER-{server_id}] [WARN] Failed to parse value '{value}': {e}")
            return 0.0
    else:
        return float(value) if value is not None else 0.0


