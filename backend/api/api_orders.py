"""
Эндпоинты для работы с ордерами

Статистика, удаление и очистка ордеров MoonBot.
"""
import asyncio
from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from services.websocket_manager import notify_order_update_sync
from utils.query_filters import apply_emulator_filter
from utils.datetime_utils import format_iso


@app.get("/api/orders")
async def get_all_orders(
    limit: int = Query(50, ge=1, le=500, description="Количество ордеров"),
    offset: int = Query(0, ge=0, description="Смещение"),
    sort_by: str = Query("closed_at", description="Поле для сортировки"),
    sort_order: str = Query("desc", description="Порядок сортировки: asc или desc"),
    status: Optional[str] = Query(None, description="Фильтр по статусу: Open, Closed"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Получить список ордеров со всех серверов пользователя.
    
    Оптимизировано для 3000+ серверов:
    - Один запрос с JOIN вместо двух отдельных
    
    Args:
        limit: Количество ордеров для возврата
        offset: Смещение для пагинации
        sort_by: Поле для сортировки
        sort_order: Порядок сортировки
        status: Фильтр по статусу
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[Dict] с ордерами
    """
    # Оптимизация: один запрос с JOIN вместо двух отдельных
    query = db.query(models.MoonBotOrder).join(
        models.Server,
        models.MoonBotOrder.server_id == models.Server.id
    ).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтр по статусу
    if status:
        query = query.filter(models.MoonBotOrder.status == status)
    
    # Сортировка
    sort_column = getattr(models.MoonBotOrder, sort_by, models.MoonBotOrder.closed_at)
    if sort_order == "desc":
        query = query.order_by(sort_column.desc().nullslast())
    else:
        query = query.order_by(sort_column.asc().nullsfirst())
    
    # Пагинация
    orders = await asyncio.to_thread(
        lambda: query.offset(offset).limit(limit).all()
    )
    
    # Форматируем результат
    result = []
    for order in orders:
        result.append({
            "id": order.id,
            "server_id": order.server_id,
            "moonbot_order_id": order.moonbot_order_id,
            "symbol": order.symbol,
            "strategy": order.strategy,
            "status": order.status,
            "profit_btc": float(order.profit_btc) if order.profit_btc else None,
            "opened_at": format_iso(order.opened_at),
            "closed_at": format_iso(order.closed_at),
            "bot_name": order.bot_name
        })
    
    return result


@app.get("/api/servers/{server_id}/orders/stats")
async def get_orders_stats(
    server_id: int,
    emulator: Optional[str] = Query(None, description="Фильтр по типу ордеров: 'real', 'emulator', or null для всех"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить статистику по ордерам сервера.
    
    Возвращает агрегированную статистику с учётом фильтра эмулятор/реальные.
    
    Args:
        server_id: ID сервера
        emulator: Фильтр: 'real', 'emulator' или None для всех
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict со статистикой: total, open, closed, profit
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Базовый запрос
    base_query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id
    )
    
    # Применяем фильтр эмулятор/реальные через утилиту
    base_query = apply_emulator_filter(base_query, emulator, models.MoonBotOrder.is_emulator)
    
    # Агрегация статистики одним запросом
    stats_query = await asyncio.to_thread(
        lambda: base_query.with_entities(
            func.count(models.MoonBotOrder.id).label('total'),
            func.sum(case((models.MoonBotOrder.status == "Open", 1), else_=0)).label('open_count'),
            func.sum(case((models.MoonBotOrder.status == "Closed", 1), else_=0)).label('closed_count'),
            func.sum(models.MoonBotOrder.profit_btc).label('total_profit')
        ).first()
    )
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "default_currency": server.default_currency or "USDT",
        "total_orders": stats_query.total or 0,
        "open_orders": stats_query.open_count or 0,
        "closed_orders": stats_query.closed_count or 0,
        "total_profit_btc": float(stats_query.total_profit or 0.0)
    }


@app.delete("/api/servers/{server_id}/orders/{order_id}")
async def delete_order(
    server_id: int,
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Удалить конкретный ордер.
    
    Args:
        server_id: ID сервера
        order_id: ID ордера для удаления
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с информацией об удалённом ордере
        
    Raises:
        HTTPException: Если ордер не найден
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Находим и удаляем ордер
    order: Optional[models.MoonBotOrder] = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.id == order_id,
            models.MoonBotOrder.server_id == server_id
        ).first()
    )
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Сохраняем данные для ответа
    order_data: Dict[str, Any] = {
        "id": order.id,
        "moonbot_order_id": order.moonbot_order_id,
        "symbol": order.symbol,
        "status": order.status
    }
    
    # Удаляем ордер
    await asyncio.to_thread(db.delete, order)
    await asyncio.to_thread(db.commit)
    
    # Отправляем WebSocket уведомление об обновлении
    notify_order_update_sync(current_user.id, server_id)
    
    return {
        "success": True,
        "message": f"Order {order_data['moonbot_order_id']} ({order_data['symbol']}) deleted",
        "deleted_order": order_data
    }


@app.delete("/api/servers/{server_id}/orders/clear")
async def clear_orders(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Очистить все ордера для сервера.
    
    Удаляет все ордера (открытые и закрытые) для указанного сервера.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с количеством удалённых ордеров
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Удаляем все ордера
    deleted_count: int = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.server_id == server_id
        ).delete()
    )
    
    await asyncio.to_thread(db.commit)
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} ордеров",
        "server_id": server_id,
        "deleted_count": deleted_count
    }


@app.delete("/api/orders/clear-all")
async def clear_all_orders(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Очистить все ордера для ВСЕХ серверов пользователя.
    
    Удаляет все ордера со всех серверов текущего пользователя.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с количеством удалённых ордеров и серверов
    """
    # Получаем все серверы пользователя
    user_server_ids = await asyncio.to_thread(
        lambda: db.query(models.Server.id).filter(
            models.Server.user_id == current_user.id
        ).all()
    )
    server_ids: List[int] = [sid[0] for sid in user_server_ids]
    
    # Удаляем все ордера для этих серверов
    deleted_count: int = await asyncio.to_thread(
        lambda: db.query(models.MoonBotOrder).filter(
            models.MoonBotOrder.server_id.in_(server_ids)
        ).delete(synchronize_session=False)
    )
    
    await asyncio.to_thread(db.commit)
    
    return {
        "success": True,
        "message": f"Удалено {deleted_count} ордеров со всех серверов",
        "deleted_count": deleted_count,
        "servers_count": len(server_ids)
    }
