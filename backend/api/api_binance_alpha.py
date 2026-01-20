"""
API endpoints для Binance Alpha Tracker.

Предоставляет данные о монетах Binance Alpha.
"""

from typing import Optional
from fastapi import APIRouter, Query

from services.binance_alpha import get_coins, update_coins, get_status

router = APIRouter(prefix="/binance-alpha", tags=["Binance Alpha"])


@router.get("/coins")
async def api_get_coins(
    chain: Optional[str] = Query(None, description="Фильтр по сети (BSC, Solana, BASE)")
):
    """
    Получить список монет Binance Alpha.
    
    Args:
        chain: Опциональный фильтр по блокчейн-сети
    
    Returns:
        Список монет с метаданными
    """
    return get_coins(chain)


@router.post("/update")
async def api_update_coins():
    """
    Принудительное обновление данных.
    
    Запускает парсинг Binance Alpha для получения актуальных данных.
    Парсинг занимает 15-30 секунд.
    
    Returns:
        Результат запуска обновления
    """
    return update_coins()


@router.get("/status")
async def api_get_status():
    """
    Получить статус сервиса.
    
    Returns:
        Информация о состоянии сервиса и кэша
    """
    return get_status()
