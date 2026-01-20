"""
Кэширующий API для Upbit данных
Загружает данные один раз и кэширует на сервере
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
import httpx
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from utils.logging import log

router = APIRouter(tags=["upbit"])

# Кэш данных
_cache: Dict[str, Any] = {
    "markets": None,
    "markets_time": None,
    "tickers": {},
    "tickers_time": None,
    "external": {
        "binanceSpot": None,
        "bybitSpot": None,
        "binanceFutures": None,
        "bybitFutures": None
    },
    "external_time": None
}

# Время жизни кэша (5 минут)
CACHE_TTL = timedelta(minutes=5)
# Таймаут запросов
REQUEST_TIMEOUT = 15.0


def is_cache_valid(cache_time: Optional[datetime]) -> bool:
    """Проверка валидности кэша"""
    if cache_time is None:
        return False
    return datetime.now() - cache_time < CACHE_TTL


async def fetch_json(url: str) -> Any:
    """Загрузка JSON с URL"""
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.get(url, headers={"Accept": "application/json"})
        response.raise_for_status()
        return response.json()


@router.get("/markets")
async def get_upbit_markets():
    """
    Получение всех рынков Upbit (с кэшированием)
    """
    global _cache
    
    if is_cache_valid(_cache["markets_time"]) and _cache["markets"]:
        return JSONResponse(content=_cache["markets"])
    
    try:
        data = await fetch_json("https://api.upbit.com/v1/market/all")
        _cache["markets"] = data
        _cache["markets_time"] = datetime.now()
        return JSONResponse(content=data)
    except Exception as e:
        log(f"[UPBIT] Error fetching markets: {e}", level="ERROR")
        if _cache["markets"]:
            return JSONResponse(content=_cache["markets"])
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/tickers")
async def get_upbit_tickers(markets: str):
    """
    Получение тикеров для списка рынков (с кэшированием)
    """
    global _cache
    
    market_list = markets.split(",")
    cache_key = ",".join(sorted(market_list))
    
    # Проверяем кэш
    if is_cache_valid(_cache["tickers_time"]) and cache_key in _cache["tickers"]:
        return JSONResponse(content=_cache["tickers"][cache_key])
    
    try:
        url = f"https://api.upbit.com/v1/ticker?markets={markets}"
        data = await fetch_json(url)
        _cache["tickers"][cache_key] = data
        _cache["tickers_time"] = datetime.now()
        return JSONResponse(content=data)
    except Exception as e:
        log(f"[UPBIT] Error fetching tickers: {e}", level="ERROR")
        if cache_key in _cache["tickers"]:
            return JSONResponse(content=_cache["tickers"][cache_key])
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/all-data")
async def get_all_upbit_data():
    """
    Получение ВСЕХ данных одним запросом (оптимизированно)
    Возвращает: markets, tickers, external exchanges
    """
    global _cache
    
    results = {
        "markets": [],
        "tickers": [],
        "external": {
            "binanceSpot": [],
            "bybitSpot": [],
            "binanceFutures": [],
            "bybitFutures": []
        },
        "errors": []
    }
    
    async def load_upbit_markets():
        try:
            if is_cache_valid(_cache["markets_time"]) and _cache["markets"]:
                return _cache["markets"]
            data = await fetch_json("https://api.upbit.com/v1/market/all")
            _cache["markets"] = data
            _cache["markets_time"] = datetime.now()
            return data
        except Exception as e:
            results["errors"].append(f"Upbit markets: {e}")
            return _cache["markets"] or []
    
    async def load_upbit_tickers(markets: List[str]):
        try:
            # Разбиваем на чанки по 100 рынков
            all_tickers = []
            chunk_size = 100
            max_retries = 2
            
            async def fetch_chunk_with_retry(chunk, chunk_idx):
                url = f"https://api.upbit.com/v1/ticker?markets={','.join(chunk)}"
                for attempt in range(max_retries + 1):
                    try:
                        return await fetch_json(url)
                    except Exception as e:
                        if attempt < max_retries:
                            await asyncio.sleep(0.5 * (attempt + 1))
                        else:
                            raise e
            
            # Параллельная загрузка всех чанков
            chunks = [markets[i:i+chunk_size] for i in range(0, len(markets), chunk_size)]
            tasks = [fetch_chunk_with_retry(chunk, i) for i, chunk in enumerate(chunks)]
            chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            failed_chunks = 0
            for i, result in enumerate(chunk_results):
                if isinstance(result, Exception):
                    failed_chunks += 1
                    # Не добавляем каждую ошибку отдельно
                elif isinstance(result, list):
                    all_tickers.extend(result)
            
            # Добавляем одну общую ошибку если есть неудачные чанки
            if failed_chunks > 0:
                results["errors"].append(f"Не удалось загрузить {failed_chunks} из {len(chunks)} чанков тикеров Upbit")
            
            return all_tickers
        except Exception as e:
            results["errors"].append(f"Upbit tickers: {e}")
            return []
    
    async def load_binance_spot():
        try:
            if is_cache_valid(_cache["external_time"]) and _cache["external"]["binanceSpot"]:
                return _cache["external"]["binanceSpot"]
            data = await fetch_json("https://api.binance.com/api/v3/exchangeInfo")
            coins = list(set(
                coin for s in data.get("symbols", []) 
                for coin in [s.get("baseAsset"), s.get("quoteAsset")] if coin
            ))
            _cache["external"]["binanceSpot"] = coins
            return coins
        except Exception as e:
            results["errors"].append(f"Binance Spot: {e}")
            return _cache["external"]["binanceSpot"] or []
    
    async def load_bybit_spot():
        try:
            if is_cache_valid(_cache["external_time"]) and _cache["external"]["bybitSpot"]:
                return _cache["external"]["bybitSpot"]
            data = await fetch_json("https://api.bybit.com/v5/market/instruments-info?category=spot&limit=1000")
            if data.get("retCode") != 0:
                raise Exception(data.get("retMsg", "Bybit error"))
            coins = list(set(
                coin for i in data.get("result", {}).get("list", [])
                for coin in [i.get("baseCoin"), i.get("quoteCoin")] if coin
            ))
            _cache["external"]["bybitSpot"] = coins
            return coins
        except Exception as e:
            results["errors"].append(f"Bybit Spot: {e}")
            return _cache["external"]["bybitSpot"] or []
    
    async def load_binance_futures():
        try:
            if is_cache_valid(_cache["external_time"]) and _cache["external"]["binanceFutures"]:
                return _cache["external"]["binanceFutures"]
            data = await fetch_json("https://fapi.binance.com/fapi/v1/exchangeInfo")
            coins = [
                s.get("baseAsset") for s in data.get("symbols", [])
                if s.get("contractType") == "PERPETUAL" and s.get("baseAsset")
            ]
            _cache["external"]["binanceFutures"] = coins
            return coins
        except Exception as e:
            results["errors"].append(f"Binance Futures: {e}")
            return _cache["external"]["binanceFutures"] or []
    
    async def load_bybit_futures():
        try:
            if is_cache_valid(_cache["external_time"]) and _cache["external"]["bybitFutures"]:
                return _cache["external"]["bybitFutures"]
            data = await fetch_json("https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000")
            if data.get("retCode") != 0:
                raise Exception(data.get("retMsg", "Bybit error"))
            coins = [i.get("baseCoin") for i in data.get("result", {}).get("list", []) if i.get("baseCoin")]
            _cache["external"]["bybitFutures"] = coins
            return coins
        except Exception as e:
            results["errors"].append(f"Bybit Futures: {e}")
            return _cache["external"]["bybitFutures"] or []
    
    # Загружаем markets сначала
    markets_data = await load_upbit_markets()
    results["markets"] = markets_data
    
    # Получаем список рынков для тикеров
    market_codes = [m.get("market") for m in markets_data if m.get("market")]
    
    # Параллельная загрузка всего остального
    tickers_task = load_upbit_tickers(market_codes)
    binance_spot_task = load_binance_spot()
    bybit_spot_task = load_bybit_spot()
    binance_futures_task = load_binance_futures()
    bybit_futures_task = load_bybit_futures()
    
    (
        tickers_data,
        binance_spot_data,
        bybit_spot_data,
        binance_futures_data,
        bybit_futures_data
    ) = await asyncio.gather(
        tickers_task,
        binance_spot_task,
        bybit_spot_task,
        binance_futures_task,
        bybit_futures_task
    )
    
    results["tickers"] = tickers_data
    results["external"]["binanceSpot"] = binance_spot_data
    results["external"]["bybitSpot"] = bybit_spot_data
    results["external"]["binanceFutures"] = binance_futures_data
    results["external"]["bybitFutures"] = bybit_futures_data
    
    _cache["external_time"] = datetime.now()
    
    return JSONResponse(content=results)


@router.delete("/cache")
async def clear_cache():
    """Очистка кэша"""
    global _cache
    _cache = {
        "markets": None,
        "markets_time": None,
        "tickers": {},
        "tickers_time": None,
        "external": {
            "binanceSpot": None,
            "bybitSpot": None,
            "binanceFutures": None,
            "bybitFutures": None
        },
        "external_time": None
    }
    return {"status": "ok", "message": "Cache cleared"}

