"""
Эндпоинт: GET /api/servers/{server_id}/orders

Получение списка ордеров MoonBot с фильтрацией и пагинацией.
"""
import asyncio
from typing import List, Optional, Dict, Any

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from utils.query_filters import apply_emulator_filter
from utils.config_loader import get_config_value


@app.get("/api/servers/{server_id}/orders")
async def get_moonbot_orders(
    server_id: int,
    status: Optional[str] = None,
    symbol: Optional[str] = None,
    emulator: Optional[str] = None,
    limit: Optional[int] = None,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить ордера MoonBot с сервера
    
    Args:
        server_id: ID сервера
        status: Фильтр по статусу (Open, Closed, Cancelled)
        symbol: Фильтр по тикеру (BTC, ETH...)
        emulator: Фильтр по эмулятору
        limit: Количество записей (из конфига)
        offset: Смещение для пагинации
    """
    # Загружаем лимиты из конфига
    default_limit = get_config_value('app', 'api.pagination.default_limit', default=100)
    max_limit = get_config_value('app', 'api.pagination.max_limit', default=500)
    min_limit = get_config_value('app', 'api.pagination.min_limit', default=1)
    
    # Применяем лимиты
    if limit is None:
        limit = default_limit
    
    if limit < min_limit:
        raise HTTPException(status_code=400, detail=f"limit must be >= {min_limit}")
    if limit > max_limit:
        limit = max_limit
    if offset < 0:
        raise HTTPException(status_code=400, detail="offset must be >= 0")
    
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Строим запрос
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    if status:
        query = query.filter(models.MoonBotOrder.status == status)
    
    if symbol:
        query = query.filter(models.MoonBotOrder.symbol == symbol.upper())
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        emulator_filter = 'emulator' if emulator.lower() == 'true' else 'real'
        query = apply_emulator_filter(query, emulator_filter, models.MoonBotOrder.is_emulator)
    
    # Получаем ордера
    orders = await asyncio.to_thread(
        lambda: query.order_by(
            models.MoonBotOrder.updated_at.desc()
        ).offset(offset).limit(limit).all()
    )
    
    # Считаем общее количество
    total = await asyncio.to_thread(query.count)
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "default_currency": server.default_currency or "USDT",  # 💱 Валюта сервера
        "total": total,
        "offset": offset,
        "limit": limit,
        "orders": [
            {
                "id": order.id,
                "server_id": order.server_id,
                "moonbot_order_id": order.moonbot_order_id,
                "symbol": order.symbol,
                "buy_price": order.buy_price,
                "sell_price": order.sell_price,
                "quantity": order.quantity,
                "status": order.status,
                "profit_btc": order.profit_btc,
                "profit_percent": order.profit_percent,
                "sell_reason": order.sell_reason,
                "strategy": order.strategy,
                "opened_at": order.opened_at,
                "closed_at": order.closed_at,
                "created_at": order.created_at,
                "updated_at": order.updated_at,
                
                # === ВРЕМЕННЫЕ МЕТКИ (Unix timestamps) ===
                "buy_date": getattr(order, 'buy_date', None),
                "sell_set_date": getattr(order, 'sell_set_date', None),
                "close_date": getattr(order, 'close_date', None),
                
                # === МЕТАДАННЫЕ И ИСТОЧНИКИ ===
                "source": getattr(order, 'source', None),
                "channel": getattr(order, 'channel', None),
                "channel_name": getattr(order, 'channel_name', None),
                "comment": getattr(order, 'comment', None),  # КРИТИЧНО для стратегии!
                "strategy_id": getattr(order, 'strategy_id', None),
                "base_currency": getattr(order, 'base_currency', None),  # Integer (0=USDT, 1=BTC)
                
                # === ОСНОВНЫЕ ПОКАЗАТЕЛИ ===
                "is_emulator": getattr(order, 'is_emulator', False),
                "emulator": getattr(order, 'emulator', 0),
                "signal_type": getattr(order, 'signal_type', None),
                "task_id": getattr(order, 'task_id', None),
                "ex_order_id": getattr(order, 'ex_order_id', None),
                "bot_name": getattr(order, 'bot_name', None),
                
                # === ФАЙЛЫ И СОСТОЯНИЕ ===
                "fname": getattr(order, 'fname', None),
                "deleted": getattr(order, 'deleted', 0),
                "imp": getattr(order, 'imp', 0),
                
                # === РЫНОЧНЫЕ ДАННЫЕ (BTC дельты) ===
                "btc_1h_delta": getattr(order, 'btc_1h_delta', None),
                "btc_24h_delta": getattr(order, 'btc_24h_delta', None),
                "btc_5m_delta": getattr(order, 'btc_5m_delta', None),
                "dbtc_1m": getattr(order, 'dbtc_1m', None),
                "btc_in_delta": getattr(order, 'btc_in_delta', None),
                
                # === РЫНОЧНЫЕ ДАННЫЕ (Exchange дельты) ===
                "exchange_1h_delta": getattr(order, 'exchange_1h_delta', None),
                "exchange_24h_delta": getattr(order, 'exchange_24h_delta', None),
                
                # === PUMP & DUMP ИНДИКАТОРЫ ===
                "pump_1h": getattr(order, 'pump_1h', None),
                "dump_1h": getattr(order, 'dump_1h', None),
                
                # === ДЕТАЛЬНЫЕ ДЕЛЬТЫ ПО ТАЙМФРЕЙМАМ ===
                "d24h": getattr(order, 'd24h', None),
                "d3h": getattr(order, 'd3h', None),
                "d1h": getattr(order, 'd1h', None),
                "d15m": getattr(order, 'd15m', None),
                "d5m": getattr(order, 'd5m', None),
                "d1m": getattr(order, 'd1m', None),
                
                # === ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ ===
                "price_bug": getattr(order, 'price_bug', None),
                "price_blow": getattr(order, 'price_blow', None),
                "vd1m": getattr(order, 'vd1m', None),
                "lev": getattr(order, 'lev', None),
                "bvsv_ratio": getattr(order, 'bvsv_ratio', None),
                "is_short": getattr(order, 'is_short', None),
                
                # === ОБЪЁМЫ ===
                "hvol": getattr(order, 'hvol', None),
                "hvolf": getattr(order, 'hvolf', None),
                "dvol": getattr(order, 'dvol', None),
                "daily_vol": getattr(order, 'daily_vol', None),
                
                # === SAFETY ORDERS И ПОКУПКИ ===
                "safety_orders_used": getattr(order, 'safety_orders_used', None),
                "bought_q": getattr(order, 'bought_q', None),
                "bought_so": getattr(order, 'bought_so', None),
                
                # === ПРОИЗВОДИТЕЛЬНОСТЬ ===
                "latency": getattr(order, 'latency', None),
                "ping": getattr(order, 'ping', None),
            }
            for order in orders
        ]
    }