"""
API для получения ошибок API от MoonBot
"""
from fastapi import Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from models import models, schemas
from models.database import get_db
from main import app
from api.api_auth import get_current_user
from utils.logging import log
from utils.datetime_utils import utcnow, format_iso


@app.get("/api/errors", response_model=List[dict])
async def get_api_errors(
    server_id: Optional[int] = Query(None, description="Filter by server ID"),
    limit: int = Query(100, ge=1, le=1000, description="Max number of errors to return"),
    hours: int = Query(24, ge=1, le=168, description="Get errors from last N hours"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить список ошибок API от MoonBot
    
    - **server_id**: Фильтр по серверу (опционально)
    - **limit**: Максимальное количество ошибок (1-1000)
    - **hours**: Получить ошибки за последние N часов (1-168)
    """
    # Получаем серверы пользователя
    user_server_ids = [s.id for s in db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()]
    
    if not user_server_ids:
        return []
    
    # Базовый запрос
    query = db.query(models.MoonBotAPIError).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids)
    )
    
    # Фильтр по серверу
    if server_id is not None:
        if server_id not in user_server_ids:
            return []
        query = query.filter(models.MoonBotAPIError.server_id == server_id)
    
    # Фильтр по времени
    time_threshold = datetime.now() - timedelta(hours=hours)
    query = query.filter(models.MoonBotAPIError.received_at >= time_threshold)
    
    # Сортировка и лимит
    errors = query.order_by(models.MoonBotAPIError.received_at.desc()).limit(limit).all()
    
    # Получаем имена серверов
    server_names = {s.id: s.name for s in db.query(models.Server).filter(
        models.Server.id.in_(user_server_ids)
    ).all()}
    
    result = []
    for error in errors:
        result.append({
            "id": error.id,
            "server_id": error.server_id,
            "server_name": server_names.get(error.server_id, "Unknown"),
            "bot_name": error.bot_name,
            "error_text": error.error_text,
            "error_time": format_iso(error.error_time),
            "symbol": error.symbol,
            "error_code": error.error_code,
            "received_at": format_iso(error.received_at)
        })
    
    return result


@app.delete("/api/errors/clear")
async def clear_api_errors(
    server_id: Optional[int] = Query(None, description="Clear errors for specific server"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Очистить ошибки API
    
    - **server_id**: Очистить только для конкретного сервера (опционально)
    """
    # Получаем серверы пользователя
    user_server_ids = [s.id for s in db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()]
    
    if not user_server_ids:
        return {"deleted": 0}
    
    query = db.query(models.MoonBotAPIError).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids)
    )
    
    if server_id is not None:
        if server_id not in user_server_ids:
            return {"deleted": 0}
        query = query.filter(models.MoonBotAPIError.server_id == server_id)
    
    count = query.delete(synchronize_session=False)
    db.commit()
    
    log(f"[API] Cleared {count} API errors for user {current_user.id}")
    
    return {"deleted": count}


@app.get("/api/errors/stats")
async def get_api_errors_stats(
    hours: int = Query(24, ge=1, le=168, description="Stats for last N hours"),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить статистику ошибок API
    
    Возвращает:
    - total_errors: общее количество ошибок за период
    - unviewed_count: количество непросмотренных ошибок (новых с момента последнего просмотра)
    """
    from sqlalchemy import func
    
    # Получаем серверы пользователя
    user_server_ids = [s.id for s in db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()]
    
    if not user_server_ids:
        return {
            "total_errors": 0,
            "unviewed_count": 0,
            "by_server": [],
            "by_code": [],
            "by_symbol": []
        }
    
    time_threshold = datetime.now() - timedelta(hours=hours)
    
    # Общее количество
    total = db.query(func.count(models.MoonBotAPIError.id)).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids),
        models.MoonBotAPIError.received_at >= time_threshold
    ).scalar() or 0
    
    # Получаем время последнего просмотра ошибок
    user_settings = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id
    ).first()
    
    last_viewed = user_settings.last_errors_viewed_at if user_settings else None
    
    # Количество непросмотренных ошибок
    if last_viewed:
        unviewed_count = db.query(func.count(models.MoonBotAPIError.id)).filter(
            models.MoonBotAPIError.server_id.in_(user_server_ids),
            models.MoonBotAPIError.received_at >= time_threshold,
            models.MoonBotAPIError.received_at > last_viewed
        ).scalar() or 0
    else:
        # Если никогда не просматривал - все ошибки непросмотренные
        unviewed_count = total
    
    # По серверам
    by_server = db.query(
        models.MoonBotAPIError.server_id,
        func.count(models.MoonBotAPIError.id).label('count')
    ).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids),
        models.MoonBotAPIError.received_at >= time_threshold
    ).group_by(models.MoonBotAPIError.server_id).all()
    
    # Получаем имена серверов
    server_names = {s.id: s.name for s in db.query(models.Server).filter(
        models.Server.id.in_(user_server_ids)
    ).all()}
    
    by_server_result = [
        {"server_id": s_id, "server_name": server_names.get(s_id, "Unknown"), "count": cnt}
        for s_id, cnt in by_server
    ]
    
    # По кодам ошибок
    by_code = db.query(
        models.MoonBotAPIError.error_code,
        func.count(models.MoonBotAPIError.id).label('count')
    ).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids),
        models.MoonBotAPIError.received_at >= time_threshold,
        models.MoonBotAPIError.error_code.isnot(None)
    ).group_by(models.MoonBotAPIError.error_code).all()
    
    by_code_result = [{"code": code, "count": cnt} for code, cnt in by_code]
    
    # По символам
    by_symbol = db.query(
        models.MoonBotAPIError.symbol,
        func.count(models.MoonBotAPIError.id).label('count')
    ).filter(
        models.MoonBotAPIError.server_id.in_(user_server_ids),
        models.MoonBotAPIError.received_at >= time_threshold,
        models.MoonBotAPIError.symbol.isnot(None)
    ).group_by(models.MoonBotAPIError.symbol).order_by(
        func.count(models.MoonBotAPIError.id).desc()
    ).limit(10).all()
    
    by_symbol_result = [{"symbol": sym, "count": cnt} for sym, cnt in by_symbol]
    
    return {
        "total_errors": total,
        "unviewed_count": unviewed_count,
        "hours": hours,
        "by_server": by_server_result,
        "by_code": by_code_result,
        "by_symbol": by_symbol_result
    }


@app.post("/api/errors/mark-viewed")
async def mark_errors_viewed(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Отметить все ошибки как просмотренные
    
    Обновляет время последнего просмотра ошибок для пользователя.
    После этого значок ошибок станет зелёным (если нет новых ошибок).
    """
    # Получаем или создаём настройки пользователя
    user_settings = db.query(models.UserSettings).filter(
        models.UserSettings.user_id == current_user.id
    ).first()
    
    if not user_settings:
        user_settings = models.UserSettings(
            user_id=current_user.id,
            last_errors_viewed_at=utcnow()
        )
        db.add(user_settings)
    else:
        user_settings.last_errors_viewed_at = utcnow()
    
    db.commit()
    
    log(f"[API] User {current_user.id} marked errors as viewed")
    
    return {"success": True, "viewed_at": format_iso(user_settings.last_errors_viewed_at)}

