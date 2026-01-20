"""
API для работы с графиками от MoonBot

Команды:
- SubscribeCharts - подписаться на рассылку графиков (без ответа, просто отправка)
- UnsubscribeCharts - отписаться от рассылки графиков (без ответа, просто отправка)

Важно: Эти команды НЕ возвращают ответ. MoonBot просто запоминает адрес
и начинает/прекращает слать бинарные данные графиков.
"""
from fastapi import Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Any
import json
import math

from models import models
from models.database import get_db
from main import app
from api.api_auth import get_current_user
from services import udp
from utils.datetime_utils import format_iso
from utils.logging import log


def sanitize_float_values(obj: Any) -> Any:
    """
    Рекурсивно очищает объект от невалидных float значений (inf, -inf, nan),
    заменяя их на None для корректной JSON сериализации.
    """
    if obj is None:
        return None
    
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    
    if isinstance(obj, dict):
        return {k: sanitize_float_values(v) for k, v in obj.items()}
    
    if isinstance(obj, list):
        return [sanitize_float_values(item) for item in obj]
    
    if isinstance(obj, tuple):
        return tuple(sanitize_float_values(item) for item in obj)
    
    return obj


@app.post("/api/servers/{server_id}/charts/subscribe")
async def subscribe_charts(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Подписаться на рассылку графиков от MoonBot
    
    Важно: Команда SubscribeCharts НЕ возвращает ответ!
    MoonBot просто запоминает адрес отправителя и начинает слать 
    бинарные данные графиков при каждой сделке.
    
    Для работы требуется активный UDP Listener на этом сервере.
    """
    # Проверяем доступ к серверу
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Проверяем, активен ли listener
    listener = udp.active_listeners.get(server_id)
    if not listener or not listener.running:
        log(f"[API] Cannot subscribe to charts: listener not running for server {server_id}")
        return {
            "success": False,
            "message": "UDP Listener не запущен. Запустите listener перед подпиской на графики.",
            "error": "listener_not_running"
        }
    
    # Отправляем команду через listener (без ожидания ответа)
    try:
        listener.send_command("SubscribeCharts")
        log(f"[API] Sent SubscribeCharts to server {server_id}")
        
        return {
            "success": True,
            "message": "Подписка на графики активирована. Графики будут приходить при новых сделках.",
            "note": "Команда не возвращает ответ - MoonBot просто начнёт присылать данные."
        }
    except Exception as e:
        log(f"[API] Error subscribing to charts on server {server_id}: {e}")
        return {
            "success": False,
            "message": "Ошибка отправки команды",
            "error": str(e)
        }


@app.post("/api/servers/{server_id}/charts/unsubscribe")
async def unsubscribe_charts(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отписаться от рассылки графиков от MoonBot
    
    Команда UnsubscribeCharts также НЕ возвращает ответ.
    """
    # Проверяем доступ к серверу
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Проверяем, активен ли listener
    listener = udp.active_listeners.get(server_id)
    if not listener or not listener.running:
        log(f"[API] Cannot unsubscribe from charts: listener not running for server {server_id}")
        return {
            "success": False,
            "message": "UDP Listener не запущен",
            "error": "listener_not_running"
        }
    
    # Отправляем команду через listener (без ожидания ответа)
    try:
        listener.send_command("UnsubscribeCharts")
        log(f"[API] Sent UnsubscribeCharts to server {server_id}")
        
        return {
            "success": True,
            "message": "Отписка от графиков выполнена."
        }
    except Exception as e:
        log(f"[API] Error unsubscribing from charts on server {server_id}: {e}")
        return {
            "success": False,
            "message": "Ошибка отправки команды",
            "error": str(e)
        }


@app.get("/api/charts/all")
async def get_all_charts(
    limit: int = Query(100, ge=1, le=1000, description="Max number of charts to return"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список всех графиков пользователя (для отладки)
    """
    # Получаем все серверы пользователя
    server_ids = [s.id for s in db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()]
    
    if not server_ids:
        return []
    
    charts = db.query(models.MoonBotChart).filter(
        models.MoonBotChart.server_id.in_(server_ids)
    ).order_by(
        models.MoonBotChart.received_at.desc()
    ).limit(limit).all()
    
    result = []
    for chart in charts:
        result.append({
            "id": chart.id,
            "server_id": chart.server_id,
            "order_db_id": chart.order_db_id,
            "market_name": chart.market_name,
            "market_currency": chart.market_currency,
            "received_at": format_iso(chart.received_at)
        })
    
    return {"total": len(result), "charts": result}


@app.get("/api/servers/{server_id}/charts")
async def get_charts(
    server_id: int,
    limit: int = Query(50, ge=1, le=500, description="Max number of charts to return"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список графиков для сервера
    """
    # Проверяем доступ к серверу
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    charts = db.query(models.MoonBotChart).filter(
        models.MoonBotChart.server_id == server_id
    ).order_by(
        models.MoonBotChart.received_at.desc()
    ).limit(limit).all()
    
    result = []
    for chart in charts:
        # Очищаем session_profit от невалидных значений
        session_profit = chart.session_profit
        if session_profit is not None and (math.isnan(session_profit) or math.isinf(session_profit)):
            session_profit = None
        
        result.append({
            "id": chart.id,
            "order_db_id": chart.order_db_id,
            "market_name": chart.market_name,
            "market_currency": chart.market_currency,
            "pump_channel": chart.pump_channel,
            "start_time": format_iso(chart.start_time),
            "end_time": format_iso(chart.end_time),
            "session_profit": session_profit,
            "received_at": format_iso(chart.received_at)
        })
    
    return result


@app.get("/api/servers/{server_id}/charts/{order_id}")
async def get_chart_data(
    server_id: int,
    order_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить полные данные графика для конкретного ордера
    """
    # Проверяем доступ к серверу
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    chart = db.query(models.MoonBotChart).filter(
        models.MoonBotChart.server_id == server_id,
        models.MoonBotChart.order_db_id == order_id
    ).first()
    
    if not chart:
        raise HTTPException(status_code=404, detail="Chart not found")
    
    # Парсим JSON данные
    chart_data = None
    if chart.chart_data:
        try:
            chart_data = json.loads(chart.chart_data)
            # Очищаем от невалидных float значений (inf, -inf, nan)
            chart_data = sanitize_float_values(chart_data)
        except json.JSONDecodeError:
            chart_data = None
    
    # Очищаем session_profit от невалидных значений
    session_profit = chart.session_profit
    if session_profit is not None and (math.isnan(session_profit) or math.isinf(session_profit)):
        session_profit = None
    
    # Получаем название стратегии из связанного ордера
    strategy_name = None
    order = db.query(models.MoonBotOrder).filter(
        models.MoonBotOrder.server_id == server_id,
        models.MoonBotOrder.moonbot_order_id == chart.order_db_id
    ).first()
    if order:
        strategy_name = order.strategy
    
    return {
        "id": chart.id,
        "order_db_id": chart.order_db_id,
        "market_name": chart.market_name,
        "market_currency": chart.market_currency,
        "pump_channel": chart.pump_channel,
        "strategy_name": strategy_name,
        "start_time": format_iso(chart.start_time),
        "end_time": format_iso(chart.end_time),
        "session_profit": session_profit,
        "received_at": format_iso(chart.received_at),
        "data": chart_data
    }


@app.delete("/api/servers/{server_id}/charts/clear")
async def clear_charts(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Очистить все графики для сервера
    """
    # Проверяем доступ к серверу
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    count = db.query(models.MoonBotChart).filter(
        models.MoonBotChart.server_id == server_id
    ).delete(synchronize_session=False)
    
    db.commit()
    
    log(f"[API] Cleared {count} charts for server {server_id}")
    
    return {"deleted": count}

