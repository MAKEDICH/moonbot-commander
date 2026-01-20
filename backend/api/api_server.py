"""
Эндпоинты для работы с серверами
"""
import asyncio
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services import encryption
from services import udp
from services import ip_validator
from utils.logging import log
from utils.datetime_utils import utcnow
from services.user_id_cache import set_user_id_for_server, remove_user_id_for_server


@app.get("/api/servers", response_model=List[schemas.Server])
async def get_servers(
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[schemas.Server]:
    """
    Получение списка серверов пользователя.
    
    Args:
        skip: Количество записей для пропуска (пагинация)
        limit: Максимальное количество записей
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[schemas.Server]: Список серверов пользователя
    """
    servers: List[models.Server] = await asyncio.to_thread(
        lambda: db.query(models.Server)
            .filter(models.Server.user_id == current_user.id)
            .offset(skip).limit(limit).all()
    )
    return servers


@app.get("/api/servers/{server_id}", response_model=schemas.Server)
async def get_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.Server:
    """
    Получение информации о конкретном сервере.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        schemas.Server: Информация о сервере
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    from core.server_access import get_user_server
    server: models.Server = await get_user_server(server_id, current_user, db)
    return server


@app.post("/api/servers", response_model=schemas.Server, status_code=status.HTTP_201_CREATED)
async def create_server(
    server_data: schemas.ServerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.Server:
    """
    Создание нового сервера.
    
    Args:
        server_data: Данные для создания сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        schemas.Server: Созданный сервер
        
    Raises:
        HTTPException: Если валидация не пройдена
    """
    # ВАЛИДАЦИЯ: Проверка host (защита от SSRF)
    # Передаем allow_localhost=True если пользователь установил флаг is_localhost
    is_valid_host, host_error = ip_validator.validate_host(
        server_data.host,
        allow_localhost=server_data.is_localhost
    )
    if not is_valid_host:
        raise HTTPException(status_code=400, detail=f"Недопустимый хост: {host_error}")
    
    # ВАЛИДАЦИЯ: Проверка порта
    is_valid_port, port_error = ip_validator.validate_port(server_data.port)
    if not is_valid_port:
        raise HTTPException(status_code=400, detail=f"Недопустимый порт: {port_error}")
    
    data: Dict = server_data.model_dump()
    
    # Шифруем пароль перед сохранением
    if data.get('password'):
        data['password'] = encryption.encrypt_password(data['password'])
    
    new_server: models.Server = models.Server(
        **data,
        user_id=current_user.id
    )
    
    await asyncio.to_thread(db.add, new_server)
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, new_server)
    
    # Добавляем в кэш user_id для быстрого доступа
    set_user_id_for_server(new_server.id, current_user.id)
    
    # Автоматически запускаем UDP Listener для нового сервера если он активен
    if new_server.is_active:
        try:
            password: Optional[str] = None
            if new_server.password:
                password = encryption.decrypt_password(new_server.password)
            
            success: bool = udp.start_listener(
                server_id=new_server.id,
                host=new_server.host,
                port=new_server.port,
                password=password,
                keepalive_enabled=new_server.keepalive_enabled
            )
            
            if success:
                log(f"[CREATE-SERVER] OK: Listener started for server {new_server.id}: {new_server.name}")
            else:
                log(f"[CREATE-SERVER] FAIL: Failed to start listener for server {new_server.id}", level="ERROR")
        except Exception as e:
            log(f"[CREATE-SERVER] Error starting listener: {e}")    
    return new_server


@app.put("/api/servers/{server_id}", response_model=schemas.Server)
async def update_server(
    server_id: int,
    server_data: schemas.ServerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.Server:
    """
    Обновление сервера.
    
    Args:
        server_id: ID сервера
        server_data: Данные для обновления
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        schemas.Server: Обновленный сервер
        
    Raises:
        HTTPException: Если сервер не найден или валидация не пройдена
    """
    from core.server_access import get_user_server
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # ВАЛИДАЦИЯ: Если меняется host, проверяем его
    if server_data.host is not None and server_data.host != server.host:
        # Берем is_localhost из запроса если указано, иначе из существующего сервера
        allow_localhost: bool = server_data.is_localhost if server_data.is_localhost is not None else server.is_localhost
        is_valid_host: bool
        host_error: str
        is_valid_host, host_error = ip_validator.validate_host(
            server_data.host,
            allow_localhost=allow_localhost
        )
        if not is_valid_host:
            raise HTTPException(status_code=400, detail=f"Недопустимый хост: {host_error}")
    
    update_data: Dict = server_data.model_dump(exclude_unset=True)
    
    # Запоминаем старое состояние is_active
    old_is_active: bool = server.is_active
    
    # Шифруем пароль если он обновляется И он НЕ зашифрован
    if 'password' in update_data and update_data['password']:
        # Проверяем, не зашифрован ли уже пароль (Fernet signature начинается с gAAAAA)
        if not update_data['password'].startswith('gAAAAA'):
            update_data['password'] = encryption.encrypt_password(update_data['password'])
        # Если пароль уже зашифрован, оставляем как есть
    for field, value in update_data.items():
        setattr(server, field, value)
    
    server.updated_at = utcnow()
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, server)
    
    # Управление UDP Listener при изменении is_active
    if 'is_active' in update_data:
        if server.is_active and not old_is_active:
            # Сервер был выключен, теперь включен - запускаем listener
            try:
                password: Optional[str] = None
                if server.password:
                    password = encryption.decrypt_password(server.password)
                
                success: bool = udp.start_listener(
                    server_id=server.id,
                    host=server.host,
                    port=server.port,
                    password=password,
                    keepalive_enabled=server.keepalive_enabled
                )
                
                if success:
                    log(f"[UPDATE-SERVER] OK: Listener started for server {server.id}: {server.name}")
                else:
                    log(f"[UPDATE-SERVER] FAIL: Failed to start listener for server {server.id}", level="ERROR")
            except Exception as e:
                log(f"[UPDATE-SERVER] Error starting listener: {e}")                
        elif not server.is_active and old_is_active:
            # Сервер был включен, теперь выключен - останавливаем listener
            try:
                udp.stop_listener(server.id)
                log(f"[UPDATE-SERVER] OK: Listener stopped for server {server.id}: {server.name}")
            except Exception as e:
                log(f"[UPDATE-SERVER] Error stopping listener: {e}")    
    return server


@app.delete("/api/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Удаление сервера.
    
    Args:
        server_id: ID сервера
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Raises:
        HTTPException: Если сервер не найден или не принадлежит пользователю
    """
    from core.server_access import get_user_server
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    # Останавливаем listener если работает
    try:
        udp.stop_listener(server_id)
    except Exception:
        pass
    
    # Удаляем из кэша user_id
    remove_user_id_for_server(server_id)
    
    # Очищаем все кэши для сервера (предотвращаем memory leak)
    try:
        from services.udp.listener_status import cleanup_server_caches
        cleanup_server_caches(server_id)
    except Exception:
        pass
    
    await asyncio.to_thread(db.delete, server)
    await asyncio.to_thread(db.commit)
    
    return None


@app.get("/api/groups")
async def get_groups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, List[str]]:
    """
    Получение списка всех групп пользователя.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        dict: Словарь с списком групп
    """
    groups = await asyncio.to_thread(
        lambda: db.query(models.Server.group_name)
            .filter(
                models.Server.user_id == current_user.id,
                models.Server.group_name.isnot(None)
            )
            .distinct()
            .all()
    )
    
    # Разбиваем группы по запятым и убираем дубликаты
    all_groups: set = set()
    for g in groups:
        if g[0]:
            group_parts: List[str] = [part.strip() for part in g[0].split(',')]
            all_groups.update(group_parts)
    
    group_names: List[str] = sorted(list(all_groups))
    
    return {"groups": group_names}

