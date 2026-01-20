"""
Эндпоинты для управления командами MoonBot

Отправка команд, просмотр истории и массовые операции.
"""
import asyncio
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services.udp_client import UDPClient
from services import udp
from services import encryption
from services.udp_helper import send_command_unified
from core.server_access import get_user_server
from utils.logging import log


@app.post("/api/commands/send", response_model=schemas.CommandResponse)
async def send_command(
    command_data: schemas.CommandRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.CommandResponse:
    """
    Отправка команды на сервер.
    
    Отправляет UDP команду на указанный сервер MoonBot и сохраняет
    результат в историю.
    
    Args:
        command_data: Данные команды (server_id, command, timeout)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        CommandResponse: Результат выполнения команды
        
    Raises:
        HTTPException: Если сервер неактивен или не найден
    """
    # Проверка существования сервера
    server: models.Server = await get_user_server(command_data.server_id, current_user, db)
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Сервер неактивен")
    
    # Проверка: для команд GetStrategies* не ждем синхронный ответ
    is_strategy_command: bool = command_data.command.startswith('GetStrategies')
    
    success: bool
    response: str
    
    # Отправка команды через unified helper
    if is_strategy_command:
        # Для GetStrategies* просто отправляем команду без ожидания ответа
        listener = udp.active_listeners.get(server.id)
        if listener and listener.running:
            listener.send_command(command_data.command)
            success = True
            response = f"Команда {command_data.command} отправлена. Данные будут поступать через listener."
            log(f"[API] Strategy command sent without waiting for response")
        else:
            # Если listener не активен - используем direct UDP
            client = UDPClient()
            password: Optional[str] = encryption.decrypt_password(server.password) if server.password else None
            success, response = await client.send_command(
                server.host,
                server.port,
                command_data.command,
                command_data.timeout or 5,
                password
            )
    else:
        # Для остальных команд используем unified helper
        success, response = await send_command_unified(
            server,
            command_data.command,
            timeout=float(command_data.timeout or 5)
        )
    
    # Сохранение в историю
    history_entry: models.CommandHistory = models.CommandHistory(
        command=command_data.command,
        response=response if success else None,
        status="success" if success else "error",
        user_id=current_user.id,
        server_id=server.id
    )
    
    await asyncio.to_thread(db.add, history_entry)
    await asyncio.to_thread(db.commit)
    
    return schemas.CommandResponse(
        command=command_data.command,
        response=response,
        status="success" if success else "error",
        execution_time=history_entry.execution_time,
        server_name=server.name
    )


@app.post("/api/commands/send-bulk")
async def send_bulk_command(
    command_data: schemas.BulkCommandRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Массовая отправка команды на несколько серверов.
    
    Args:
        command_data: Данные команды со списком серверов
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатами отправки на каждый сервер
        
    Raises:
        HTTPException: Если активные серверы не найдены
    """
    # Проверка что все серверы принадлежат пользователю
    servers: List[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server)
            .filter(
                models.Server.id.in_(command_data.server_ids),
                models.Server.user_id == current_user.id,
                models.Server.is_active == True
            ).all()
    )
    
    if not servers:
        raise HTTPException(status_code=404, detail="Активные серверы не найдены")
    
    results: List[Dict[str, Any]] = []
    
    # Отправка команды на каждый сервер через unified helper
    for server in servers:
        success: bool
        response: str
        try:
            success, response = await send_command_unified(
                server,
                command_data.command,
                timeout=float(command_data.timeout or 5)
            )
        except Exception as e:
            log(f"[API] Error sending bulk command to server {server.id}: {e}", level="ERROR")
            success = False
            response = str(e)
        
        # Сохранение в историю
        history_entry: models.CommandHistory = models.CommandHistory(
            command=command_data.command,
            response=response if success else None,
            status="success" if success else "error",
            user_id=current_user.id,
            server_id=server.id
        )
        await asyncio.to_thread(db.add, history_entry)
        
        results.append({
            "server_id": server.id,
            "server_name": server.name,
            "status": "success" if success else "error",
            "response": response
        })
    
    await asyncio.to_thread(db.commit)
    
    return {
        "total": len(command_data.server_ids),
        "sent": len(results),
        "results": results
    }


@app.get("/api/commands/history", response_model=List[schemas.CommandHistory])
async def get_command_history(
    server_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[models.CommandHistory]:
    """
    Получение истории команд с пагинацией.
    
    Args:
        server_id: ID сервера для фильтрации (опционально)
        skip: Количество записей для пропуска (пагинация)
        limit: Максимальное количество записей (по умолчанию 50, макс 200)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[CommandHistory]: История команд
        
    Raises:
        HTTPException: Если сервер не найден
    """
    # Ограничение на limit для защиты от DoS
    if limit > 200:
        limit = 200
    
    if server_id:
        # Проверка что сервер принадлежит пользователю
        server: Optional[models.Server] = await asyncio.to_thread(
            lambda: db.query(models.Server)
                .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)
                .first()
        )
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
    
    # Оптимизация: используем joinedload для загрузки server в одном запросе (N+1 fix)
    history: List[models.CommandHistory] = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory)
            .options(joinedload(models.CommandHistory.server))
            .filter(models.CommandHistory.user_id == current_user.id)
            .filter(models.CommandHistory.server_id == server_id if server_id else True)
            .order_by(models.CommandHistory.execution_time.desc())
            .offset(skip)
            .limit(limit)
            .all()
    )
    
    return history


@app.get("/api/commands/history/count")
async def get_command_history_count(
    server_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, int]:
    """
    Получение общего количества команд в истории (для пагинации).
    
    Args:
        server_id: ID сервера для фильтрации (опционально)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с общим количеством
        
    Raises:
        HTTPException: Если сервер не найден
    """
    if server_id:
        server: Optional[models.Server] = await asyncio.to_thread(
            lambda: db.query(models.Server)
                .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)
                .first()
        )
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
    
    total: int = await asyncio.to_thread(
        lambda: db.query(models.CommandHistory)
            .filter(models.CommandHistory.user_id == current_user.id)
            .filter(models.CommandHistory.server_id == server_id if server_id else True)
            .count()
    )
    return {"total": total}


@app.delete("/api/commands/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_command_history(
    server_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Очистка истории команд.
    
    Args:
        server_id: ID сервера для фильтрации (опционально)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Raises:
        HTTPException: Если сервер не найден
    """
    if server_id:
        server: Optional[models.Server] = await asyncio.to_thread(
            lambda: db.query(models.Server)
                .filter(models.Server.id == server_id, models.Server.user_id == current_user.id)
                .first()
        )
        if not server:
            raise HTTPException(status_code=404, detail="Сервер не найден")
    
    await asyncio.to_thread(
        lambda: db.query(models.CommandHistory)
            .filter(models.CommandHistory.user_id == current_user.id)
            .filter(models.CommandHistory.server_id == server_id if server_id else True)
            .delete()
    )
    await asyncio.to_thread(db.commit)
    
    return None
