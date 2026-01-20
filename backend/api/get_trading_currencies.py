"""
Эндпоинт: GET /api/trading/currencies
Функция: get_trading_currencies
"""

from fastapi import Depends
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user


@app.get("/api/trading/currencies")
async def get_trading_currencies(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получение списка валют, по которым есть любые сделки"""
    # Получаем все серверы пользователя
    import asyncio
    servers = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(models.Server.user_id == current_user.id).all()
    )
    
    # Собираем валюты, по которым есть сделки
    currencies_with_trades = set()
    
    for server in servers:
        # Проверяем есть ли вообще сделки для этого сервера
        has_trades = await asyncio.to_thread(
            lambda: db.query(models.MoonBotOrder)
            .filter(models.MoonBotOrder.server_id == server.id)
            .first() is not None
        )
        
        # Если есть сделки и задана валюта, добавляем её
        if has_trades and server.default_currency:
            currencies_with_trades.add(server.default_currency)
    
    # Если нет валют с сделками, возвращаем USDT по умолчанию
    if not currencies_with_trades:
        currencies_with_trades = {'USDT'}
    
    return {
        "currencies": sorted(list(currencies_with_trades)),
        "count": len(currencies_with_trades)
    }