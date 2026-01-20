"""
Эндпоинты для работы с UDP listener

Управление постоянным прослушиванием UDP сообщений от серверов MoonBot.
"""
import asyncio
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from models import models
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from services import udp
from services import encryption


@app.post("/api/servers/{server_id}/listener/start")
async def start_udp_listener(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Запустить UDP listener для постоянного прослушивания сервера.
    
    Listener будет получать SQL команды от MoonBot в реальном времени
    и сохранять их в БД.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом запуска
        
    Raises:
        HTTPException: Если не удалось запустить listener
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Расшифровываем пароль
    password: Optional[str] = encryption.decrypt_password(server.password) if server.password else None
    
    # Запускаем listener
    success: bool = udp.start_listener(
        server_id=server.id,
        host=server.host,
        port=server.port,
        password=password
    )
    
    if success:
        return {
            "message": "UDP listener запущен",
            "server_id": server_id,
            "server_name": server.name
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Не удалось запустить UDP listener (возможно уже запущен)"
        )


@app.post("/api/servers/{server_id}/listener/stop")
async def stop_udp_listener(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Остановить UDP listener для сервера.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом остановки
        
    Raises:
        HTTPException: Если не удалось остановить listener
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Останавливаем listener
    success: bool = udp.stop_listener(server_id)
    
    if success:
        return {
            "message": "UDP listener остановлен",
            "server_id": server_id
        }
    else:
        raise HTTPException(
            status_code=500,
            detail="Не удалось остановить UDP listener (возможно не был запущен)"
        )


@app.post("/api/servers/{server_id}/listener/refresh")
async def refresh_udp_data(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Отправить команду lst для немедленного получения данных от MoonBot.
    
    Используется при открытии вкладок Orders/SQLLogs для моментальной загрузки данных.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом отправки
        
    Raises:
        HTTPException: Если listener не запущен или произошла ошибка
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Проверяем что listener запущен
    if server_id not in udp.active_listeners:
        raise HTTPException(
            status_code=400,
            detail="UDP listener не запущен для этого сервера"
        )
    
    # Отправляем команду lst через listener
    try:
        listener = udp.active_listeners[server_id]
        if listener and listener.running:
            # Отправляем команду lst для получения списка ордеров
            listener.send_command("lst")
            return {
                "message": "Команда lst отправлена, данные будут обновлены в течение 1-2 секунд",
                "server_id": server_id
            }
        else:
            raise HTTPException(
                status_code=400,
                detail="Listener существует но не работает"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Ошибка отправки команды: {str(e)}"
        )


@app.get("/api/servers/{server_id}/listener/status")
async def get_udp_listener_status(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Получить статус UDP listener.
    
    Возвращает информацию о работе listener как из памяти,
    так и из БД.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict со статусом listener
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Получаем статус из памяти
    runtime_status: Dict[str, Any] = udp.get_listener_status(server_id)
    
    # Получаем статус из БД
    db_status: Optional[models.UDPListenerStatus] = await asyncio.to_thread(
        lambda: db.query(models.UDPListenerStatus).filter(
            models.UDPListenerStatus.server_id == server_id
        ).first()
    )
    
    return {
        "server_id": server_id,
        "server_name": server.name,
        "is_running": runtime_status["is_running"],
        "messages_received": runtime_status["messages_received"],
        "last_error": runtime_status["last_error"],
        "db_status": {
            "started_at": db_status.started_at if db_status else None,
            "last_message_at": db_status.last_message_at if db_status else None,
            "total_messages": db_status.messages_received if db_status else 0
        } if db_status else None
    }


@app.post("/api/servers/{server_id}/listener/send-command")
async def send_command_through_listener(
    server_id: int,
    command: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Отправить команду через UDP listener.
    
    Важно для команд типа SQLSelect, которые возвращают большое количество данных,
    которые listener должен получить и обработать автоматически.
    
    Args:
        server_id: ID сервера
        command: Команда для отправки
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатом отправки
        
    Raises:
        HTTPException: Если listener не запущен или произошла ошибка
    """
    # Проверяем что сервер принадлежит пользователю
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Проверяем что listener запущен
    listener_status: Dict[str, Any] = udp.get_listener_status(server_id)
    if not listener_status["is_running"]:
        raise HTTPException(status_code=400, detail="UDP Listener не запущен для этого сервера")
    
    # Получаем listener и отправляем команду
    listener = udp.active_listeners.get(server_id)
    if not listener:
        raise HTTPException(status_code=500, detail="Listener не найден в памяти")
    
    try:
        listener.send_command(command)
        return {
            "success": True,
            "message": f"Команда '{command}' отправлена через listener",
            "note": "Данные будут обработаны автоматически. Проверьте SQL Logs и Orders через несколько секунд."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка отправки команды: {str(e)}")
