"""
Эндпоинты для работы с heatmap активности

Визуализация активности торгового бота по часам и дням недели.
"""
import asyncio
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from utils.query_filters import apply_emulator_filter


# Названия дней недели на русском
DAY_NAMES: List[str] = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]


def _create_empty_heatmap() -> Dict[int, Dict[int, Dict[str, Any]]]:
    """
    Создать пустую матрицу для heatmap.
    
    Returns:
        Dict: Матрица день недели (0-6) x час (0-23)
    """
    heatmap_data: Dict[int, Dict[int, Dict[str, Any]]] = {}
    for day in range(7):  # 0=Monday, 6=Sunday
        heatmap_data[day] = {}
        for hour in range(24):
            heatmap_data[day][hour] = {
                "profit": 0.0,
                "count": 0
            }
    return heatmap_data


def _fill_heatmap_data(
    heatmap_data: Dict[int, Dict[int, Dict[str, Any]]],
    orders: List[models.MoonBotOrder]
) -> None:
    """
    Заполнить heatmap данными из ордеров.
    
    Args:
        heatmap_data: Матрица для заполнения
        orders: Список закрытых ордеров
    """
    for order in orders:
        if order.closed_at:
            weekday: int = order.closed_at.weekday()  # 0=Monday, 6=Sunday
            hour: int = order.closed_at.hour
            
            profit: float = float(order.profit_btc or 0.0)
            heatmap_data[weekday][hour]["profit"] += profit
            heatmap_data[weekday][hour]["count"] += 1


def _convert_to_array(heatmap_data: Dict[int, Dict[int, Dict[str, Any]]]) -> List[Dict[str, Any]]:
    """
    Преобразовать матрицу в массив для фронтенда.
    
    Args:
        heatmap_data: Матрица heatmap
        
    Returns:
        List[Dict]: Массив данных для фронтенда
    """
    heatmap_array: List[Dict[str, Any]] = []
    
    for day in range(7):
        for hour in range(24):
            data = heatmap_data[day][hour]
            heatmap_array.append({
                "day": day,
                "day_name": DAY_NAMES[day],
                "hour": hour,
                "profit": data["profit"],
                "count": data["count"],
                "avg_profit": data["profit"] / data["count"] if data["count"] > 0 else 0.0
            })
    
    return heatmap_array


@app.get("/api/servers/{server_id}/heatmap")
async def get_activity_heatmap(
    server_id: int,
    emulator: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить данные для heatmap активности бота (час дня x день недели).
    
    Показывает распределение прибыли и количества сделок
    по часам и дням недели.
    
    Args:
        server_id: ID сервера
        emulator: Фильтр: "true" для эмулятора, "false" для реальных, None для всех
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с данными heatmap для указанного сервера
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Получаем все закрытые ордера
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id,
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        emulator_filter: str = 'emulator' if emulator.lower() == 'true' else 'real'
        query = apply_emulator_filter(query, emulator_filter, models.MoonBotOrder.is_emulator)
    
    orders: List[models.MoonBotOrder] = await asyncio.to_thread(query.all)
    
    # Создаём и заполняем матрицу
    heatmap_data = _create_empty_heatmap()
    _fill_heatmap_data(heatmap_data, orders)
    
    # Преобразуем в формат для фронтенда
    heatmap_array = _convert_to_array(heatmap_data)
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "data": heatmap_array
    }


@app.get("/api/heatmap-all")
async def get_activity_heatmap_all(
    emulator: Optional[str] = None,
    server_ids: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить данные для heatmap активности со всех серверов пользователя.
    
    Агрегирует данные со всех серверов пользователя или
    с указанных серверов.
    
    Args:
        emulator: Фильтр: "true" для эмулятора, "false" для реальных, None для всех
        server_ids: Список ID серверов через запятую (опционально)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с агрегированными данными heatmap
    """
    # Получаем сервера пользователя
    servers_query = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    )
    
    # Фильтруем по конкретным ID серверов если указаны
    if server_ids:
        try:
            server_id_list: List[int] = [int(sid) for sid in server_ids.split(',') if sid.strip()]
            servers_query = servers_query.filter(models.Server.id.in_(server_id_list))
        except ValueError:
            return {"data": []}
    
    user_servers: List[models.Server] = await asyncio.to_thread(servers_query.all)
    
    if not user_servers:
        return {"data": []}
    
    server_id_list = [s.id for s in user_servers]
    
    # Получаем все закрытые ордера со всех серверов
    query = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id.in_(server_id_list),
        models.MoonBotOrder.status == "Closed",
        models.MoonBotOrder.closed_at.isnot(None)
    )
    
    # Фильтр по эмулятору
    if emulator and emulator.lower() in ['true', 'false']:
        emulator_filter: str = 'emulator' if emulator.lower() == 'true' else 'real'
        query = apply_emulator_filter(query, emulator_filter, models.MoonBotOrder.is_emulator)
    
    orders: List[models.MoonBotOrder] = await asyncio.to_thread(query.all)
    
    # Создаём и заполняем матрицу
    heatmap_data = _create_empty_heatmap()
    _fill_heatmap_data(heatmap_data, orders)
    
    # Преобразуем в формат для фронтенда
    heatmap_array = _convert_to_array(heatmap_data)
    
    return {"data": heatmap_array}
