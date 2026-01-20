"""
API Proxy для внешних запросов (Upbit, Binance, Bybit)
Обходит CORS ограничения браузера
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
import httpx
from typing import Optional
from utils.logging import log

router = APIRouter(tags=["proxy"])

# Разрешённые домены для проксирования (безопасность)
ALLOWED_DOMAINS = [
    "api.upbit.com",
    "api.binance.com",
    "fapi.binance.com",
    "api.bybit.com"
]

# Таймаут для запросов (увеличен для надёжности)
REQUEST_TIMEOUT = 30.0


def is_allowed_url(url: str) -> bool:
    """Проверка, что URL разрешён для проксирования"""
    for domain in ALLOWED_DOMAINS:
        if domain in url:
            return True
    return False


@router.get("/fetch")
async def proxy_fetch(url: str = Query(..., description="URL для проксирования")):
    """
    Прокси для внешних API запросов.
    Обходит CORS ограничения браузера.
    
    Args:
        url: URL внешнего API
        
    Returns:
        JSON ответ от внешнего API
    """
    # Проверка безопасности
    if not is_allowed_url(url):
        raise HTTPException(
            status_code=403,
            detail=f"URL не разрешён для проксирования. Разрешённые домены: {', '.join(ALLOWED_DOMAINS)}"
        )
    
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            response = await client.get(
                url,
                headers={
                    "Accept": "application/json",
                    "User-Agent": "MoonBot-Commander/1.0"
                }
            )
            
            # Проверка статуса
            if response.status_code != 200:
                log(f"[PROXY] Error fetching {url}: {response.status_code}", level="WARNING")
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"External API error: {response.status_code}"
                )
            
            # Парсинг JSON
            try:
                data = response.json()
            except Exception as e:
                log(f"[PROXY] JSON parse error for {url}: {e}", level="WARNING")
                raise HTTPException(
                    status_code=500,
                    detail="Invalid JSON response from external API"
                )
            
            return JSONResponse(
                content=data,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*"
                }
            )
            
    except httpx.TimeoutException:
        log(f"[PROXY] Timeout fetching {url}", level="WARNING")
        raise HTTPException(status_code=504, detail="Request timeout")
    except httpx.RequestError as e:
        log(f"[PROXY] Request error for {url}: {e}", level="WARNING")
        raise HTTPException(status_code=502, detail=f"Request error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        log(f"[PROXY] Unexpected error for {url}: {e}", level="ERROR")
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

