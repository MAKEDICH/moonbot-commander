"""
Утилиты для работы с серверами

Пинг, тестирование соединения, получение балансов и статусов.
"""
import asyncio
import time
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services.udp_client import test_connection
from services import udp
from services import encryption
from services.udp_helper import send_command_unified
from datetime import datetime
from core.server_access import get_user_server
from utils.logging import log
from utils.datetime_utils import format_iso as _format_utc_datetime


@app.get("/api/servers/balances")
async def get_server_balances(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Получить балансы всех серверов пользователя.
    
    Оптимизировано для 3000+ серверов:
    - Один запрос с joinedload вместо N+1
    - Предзагрузка балансов и статусов
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[Dict]: Список балансов всех серверов
    """
    # Оптимизация: загружаем всё одним запросом с joinedload
    servers: List[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server).options(
            joinedload(models.Server.server_status)
        ).filter(
            models.Server.user_id == current_user.id
        ).all()
    )
    
    # Получаем все балансы одним запросом
    server_ids = [s.id for s in servers]
    balances_query = await asyncio.to_thread(
        lambda: db.query(models.ServerBalance).filter(
            models.ServerBalance.server_id.in_(server_ids)
        ).all() if server_ids else []
    )
    
    # Создаём словарь балансов для быстрого поиска
    balances_map: Dict[int, models.ServerBalance] = {b.server_id: b for b in balances_query}

    result: List[Dict[str, Any]] = []
    for server in servers:
        balance = balances_map.get(server.id)
        server_status = server.server_status

        # Безопасное получение новых полей (могут отсутствовать до миграции)
        is_running: Optional[bool] = None
        version: Optional[int] = None
        if balance:
            if hasattr(balance, 'is_running'):
                is_running = balance.is_running
            if hasattr(balance, 'version'):
                version = balance.version

        result.append({
            "server_id": server.id,
            "server_name": server.name,
            "host": server.host,
            "port": server.port,
            "is_active": server.is_active,
            "bot_name": balance.bot_name if balance else None,
            "available": float(balance.available) if balance and balance.available else 0.0,
            "total": float(balance.total) if balance and balance.total else 0.0,
            "is_running": is_running,
            "version": version,
            "default_currency": server.default_currency or "USDT",
            "updated_at": _format_utc_datetime(balance.updated_at) if balance else None,
            "is_online": server_status.is_online if server_status else False,
            "last_ping": _format_utc_datetime(server_status.last_ping) if server_status else None,
        })

    return result


@app.post("/api/servers/{server_id}/ping")
async def ping_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Пинг конкретного сервера.
    
    Отправляет команду lst и измеряет время отклика.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом пинга
        
    Raises:
        HTTPException: Если сервер не найден
    """
    # Используем helper для проверки сервера
    server: models.Server = await get_user_server(server_id, current_user, db)

    # Получаем или создаем статус
    server_status: Optional[models.ServerStatus] = server.server_status
    if not server_status:
        server_status = models.ServerStatus(server_id=server.id)
        await asyncio.to_thread(db.add, server_status)

    # Пингуем сервер через unified helper
    start_time: float = time.time()

    try:
        success: bool
        response: str
        success, response = await send_command_unified(
            server,
            "lst",
            timeout=3.0
        )
        
        is_success: bool = success and not response.startswith('ERR')
        response_time: float = (time.time() - start_time) * 1000  # В миллисекундах

        if is_success:
            server_status.is_online = True
            # Используем ЛОКАЛЬНОЕ время сервера!
            server_status.last_ping = datetime.now()
            server_status.response_time = response_time
            server_status.last_error = None
            server_status.consecutive_failures = 0

            # Правильный расчет uptime
            current_uptime: float = server_status.uptime_percentage if server_status.uptime_percentage is not None else 100.0
            server_status.uptime_percentage = min(
                100.0, current_uptime * 0.99 + 100.0 * 0.01)
        else:
            raise Exception(response or "No response")

    except Exception as e:
        server_status.is_online = False
        # Используем ЛОКАЛЬНОЕ время сервера!
        server_status.last_ping = datetime.now()
        server_status.last_error = str(e)[:500]
        server_status.consecutive_failures = (server_status.consecutive_failures or 0) + 1

        # Правильный расчет downtime
        current_uptime = server_status.uptime_percentage if server_status.uptime_percentage is not None else 100.0
        server_status.uptime_percentage = max(0.0, current_uptime * 0.99)

    # Безопасный commit с обработкой race condition
    try:
        await asyncio.to_thread(db.commit)
    except Exception as commit_error:
        # При параллельных запросах транзакция может быть уже закрыта
        try:
            await asyncio.to_thread(db.rollback)
        except Exception:
            pass
    
    # Пробуем обновить объект (может не сработать если commit не прошёл)
    try:
        await asyncio.to_thread(db.refresh, server_status)
    except Exception:
        pass

    return {
        "server_id": server.id,
        "is_online": server_status.is_online,
        "response_time": server_status.response_time,
        "last_error": server_status.last_error
    }


@app.post("/api/servers/{server_id}/test")
async def test_server_connection(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Тестирование соединения с сервером.
    
    Использует listener если активен, иначе прямое подключение.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом теста
        
    Raises:
        HTTPException: Если сервер не найден
    """
    server: Optional[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server)
            .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)
            .first()
    )

    if not server:
        raise HTTPException(status_code=404, detail="Сервер не найден")

    # ВАЖНО: Используем listener если он активен
    listener = udp.active_listeners.get(server.id)

    if listener and listener.running:
        log(f"[API] Testing server {server.id} through listener")
        try:
            success: bool
            response: str
            success, response = listener.send_command_with_response("lst", timeout=3.0)
            is_online: bool = success and not response.startswith('ERR')
            log(f"[API] Test result via listener: {is_online}")
            return {"server_id": server_id, "is_online": is_online}
        except Exception as e:
            log(f"[API] Error testing via listener: {e}")
            return {"server_id": server_id, "is_online": False}
    else:
        # Если listener не активен - используем прямое подключение
        log(f"[API] Testing server {server.id} directly (no listener)")
        password: Optional[str] = encryption.decrypt_password(server.password) if server.password else None
        is_online = await test_connection(server.host, server.port, password, bind_port=server.port)
        return {"server_id": server_id, "is_online": is_online}


@app.get("/api/servers-with-status")
async def get_servers_with_status(
    limit: int = 1000,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Получение всех серверов со статусами.
    
    Оптимизировано для 3000+ серверов:
    - Один запрос с joinedload вместо N+1
    - Предзагрузка балансов одним запросом
    - Пагинация для защиты от перегрузки
    
    Args:
        limit: Максимальное количество записей (max 1000)
        offset: Смещение для пагинации
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[Dict]: Список серверов со статусами
        
    Raises:
        HTTPException: Если limit/offset невалидны
    """
    # Валидация пагинации (защита от DoS)
    if limit > 1000:
        raise HTTPException(status_code=400, detail="Limit cannot exceed 1000")
    if limit < 1:
        raise HTTPException(status_code=400, detail="Limit must be positive")
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset cannot be negative")

    # Оптимизация: joinedload для предотвращения N+1 query
    servers: List[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server).options(
            joinedload(models.Server.server_status)
        ).filter(
            models.Server.user_id == current_user.id
        ).limit(limit).offset(offset).all()
    )
    
    # Получаем все балансы одним запросом (оптимизация N+1)
    server_ids = [s.id for s in servers]
    balances_query = await asyncio.to_thread(
        lambda: db.query(models.ServerBalance).filter(
            models.ServerBalance.server_id.in_(server_ids)
        ).all() if server_ids else []
    )
    
    # Создаём словарь балансов для быстрого поиска
    balances_map: Dict[int, models.ServerBalance] = {b.server_id: b for b in balances_query}

    result: List[Dict[str, Any]] = []
    for server in servers:
        server_status: Optional[models.ServerStatus] = server.server_status
        balance = balances_map.get(server.id)

        # Безопасное получение новых полей
        is_running: Optional[bool] = None
        version: Optional[int] = None
        if balance:
            if hasattr(balance, 'is_running'):
                is_running = balance.is_running
            if hasattr(balance, 'version'):
                version = balance.version

        server_dict: Dict[str, Any] = {
            "id": server.id,
            "name": server.name,
            "host": server.host,
            "port": server.port,
            "description": server.description,
            "group_name": server.group_name,
            "is_active": server.is_active,
            "created_at": _format_utc_datetime(server.created_at),
            "updated_at": _format_utc_datetime(server.updated_at),
            "user_id": server.user_id,
            "bot_version": version,
            "bot_running": is_running,
            "status": {
                "id": server_status.id,
                "server_id": server_status.server_id,
                "is_online": server_status.is_online,
                "last_ping": _format_utc_datetime(server_status.last_ping),
                "response_time": server_status.response_time,
                "last_error": server_status.last_error,
                "uptime_percentage": server_status.uptime_percentage,
                "consecutive_failures": server_status.consecutive_failures
            } if server_status else None
        }
        result.append(server_dict)

    return result


@app.get("/api/dashboard/server-uptime", response_model=List[schemas.ServerUptime])
async def get_server_uptime(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[Dict[str, Any]]:
    """
    Получение uptime всех серверов.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[ServerUptime]: Список uptime статистик
    """
    servers: List[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server).filter(
            models.Server.user_id == current_user.id
        ).all()
    )

    result: List[Dict[str, Any]] = []
    for server in servers:
        server_status: Optional[models.ServerStatus] = server.server_status
        result.append({
            "server_id": server.id,
            "server_name": server.name,
            "uptime_percentage": server_status.uptime_percentage if server_status else 100.0,
            "is_online": server_status.is_online if server_status else False,
            "last_ping": _format_utc_datetime(server_status.last_ping) if server_status else None
        })

    return result
