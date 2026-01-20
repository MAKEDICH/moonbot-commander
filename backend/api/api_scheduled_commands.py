"""
Эндпоинты для работы с отложенными командами

Планирование выполнения команд на определённое время.
"""
import asyncio
import json
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from utils.logging import log
from utils.datetime_utils import utcnow


@app.get("/api/scheduled-commands", response_model=List[schemas.ScheduledCommandWithServers])
async def get_scheduled_commands(
    status_filter: Optional[str] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[schemas.ScheduledCommandWithServers]:
    """
    Получение списка отложенных команд пользователя.
    
    Args:
        status_filter: Фильтр по статусу (pending, completed, cancelled)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[ScheduledCommandWithServers]: Список отложенных команд с ID серверов
    """
    commands: List[models.ScheduledCommand] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommand)
            .filter(models.ScheduledCommand.user_id == current_user.id)
            .filter(models.ScheduledCommand.status == status_filter if status_filter else True)
            .order_by(models.ScheduledCommand.scheduled_time.asc())
            .all()
    )
    
    # Для каждой команды получаем ID серверов и групп
    result: List[schemas.ScheduledCommandWithServers] = []
    for cmd in commands:
        server_links: List[models.ScheduledCommandServer] = await asyncio.to_thread(
            lambda c=cmd: db.query(models.ScheduledCommandServer)
                .filter(models.ScheduledCommandServer.scheduled_command_id == c.id)
                .all()
        )
        
        cmd_dict = schemas.ScheduledCommandWithServers.model_validate(cmd)
        # server_id != None означает сервер, group_name != None означает группу
        cmd_dict.server_ids = [link.server_id for link in server_links if link.server_id is not None]
        cmd_dict.group_ids = [link.group_name for link in server_links if link.group_name is not None]
        result.append(cmd_dict)
    
    return result


@app.get("/api/scheduled-commands/{command_id}", response_model=schemas.ScheduledCommandWithServers)
async def get_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.ScheduledCommandWithServers:
    """
    Получение конкретной отложенной команды.
    
    Args:
        command_id: ID отложенной команды
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        ScheduledCommandWithServers: Отложенная команда с ID серверов
        
    Raises:
        HTTPException: Если команда не найдена
    """
    command: Optional[models.ScheduledCommand] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommand).filter(
            models.ScheduledCommand.id == command_id,
            models.ScheduledCommand.user_id == current_user.id
        ).first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    # Получаем ID серверов
    server_links: List[models.ScheduledCommandServer] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command_id
        ).all()
    )
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links]
    
    return result


@app.post("/api/scheduled-commands", response_model=schemas.ScheduledCommandWithServers, status_code=status.HTTP_201_CREATED)
async def create_scheduled_command(
    command_data: schemas.ScheduledCommandCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.ScheduledCommandWithServers:
    """
    Создание новой отложенной команды.
    
    Args:
        command_data: Данные команды (name, commands, scheduled_time, server_ids)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        ScheduledCommandWithServers: Созданная команда
        
    Raises:
        HTTPException: Если серверы не выбраны или не найдены
    """
    # Валидация: должны быть либо серверы, либо группы
    if not command_data.server_ids and not command_data.group_ids:
        raise HTTPException(status_code=400, detail="Необходимо выбрать серверы или группы")
    
    # Проверка серверов (если указаны)
    if command_data.server_ids:
        servers: List[models.Server] = await asyncio.to_thread(
            lambda: db.query(models.Server).filter(
                models.Server.id.in_(command_data.server_ids),
                models.Server.user_id == current_user.id
            ).all()
        )
        
        if len(servers) != len(command_data.server_ids):
            raise HTTPException(status_code=404, detail="Один или несколько серверов не найдены")
    
    # Проверка групп (если указаны) - group_ids это названия групп (строки)
    if command_data.group_ids:
        for group_name in command_data.group_ids:
            servers_in_group_count: int = await asyncio.to_thread(
                lambda gn=group_name: db.query(models.Server).filter(
                    models.Server.user_id == current_user.id,
                    models.Server.group_name.like(f'%{gn}%')
                ).count()
            )
            
            if servers_in_group_count == 0:
                raise HTTPException(status_code=404, detail=f"Группа '{group_name}' не найдена или в ней нет серверов")
    
    # Парсим UTC время из запроса
    scheduled_utc: datetime
    if isinstance(command_data.scheduled_time, str):
        # Если строка - парсим как UTC
        scheduled_utc = datetime.fromisoformat(command_data.scheduled_time.replace('Z', '+00:00'))
    else:
        # Если уже datetime - предполагаем что это UTC
        scheduled_utc = command_data.scheduled_time
    
    # Если у нас naive datetime (без timezone), считаем что это UTC
    if scheduled_utc.tzinfo is None:
        scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)
    
    # Конвертируем в локальное время сервера
    scheduled_local: datetime = scheduled_utc.astimezone().replace(tzinfo=None)
    
    # Конвертируем weekdays из списка в JSON строку для БД
    weekdays_json: Optional[str] = None
    if command_data.weekdays:
        weekdays_json = json.dumps(command_data.weekdays)
    
    # Создаем отложенную команду
    new_command: models.ScheduledCommand = models.ScheduledCommand(
        name=command_data.name,
        commands=command_data.commands,
        scheduled_time=scheduled_local,
        display_time=command_data.display_time,
        timezone=command_data.timezone,
        target_type=command_data.target_type,
        use_botname=command_data.use_botname,
        delay_between_bots=command_data.delay_between_bots,
        recurrence_type=command_data.recurrence_type,
        weekdays=weekdays_json,
        user_id=current_user.id
    )
    
    # Логируем для отладки (используем локальное время для сравнения!)
    log(f"[SCHEDULED] Creating command '{command_data.name}'")
    log(f"[SCHEDULED]   - UTC from request: {command_data.scheduled_time}")
    log(f"[SCHEDULED]   - Converted to local: {scheduled_local}")
    log(f"[SCHEDULED]   - Current server time: {datetime.now()}")
    log(f"[SCHEDULED]   - Time until execution: {(scheduled_local - datetime.now()).total_seconds()} seconds")
    
    await asyncio.to_thread(db.add, new_command)
    await asyncio.to_thread(db.flush)  # Чтобы получить ID
    
    # Создаем связи с серверами
    for server_id in command_data.server_ids:
        link: models.ScheduledCommandServer = models.ScheduledCommandServer(
            scheduled_command_id=new_command.id,
            server_id=server_id,
            group_name=None
        )
        await asyncio.to_thread(db.add, link)
    
    # Создаем связи с группами (сохраняем название группы в поле group_name)
    for group_name in command_data.group_ids:
        link = models.ScheduledCommandServer(
            scheduled_command_id=new_command.id,
            server_id=None,  # NULL для групп
            group_name=group_name
        )
        await asyncio.to_thread(db.add, link)
    
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, new_command)
    
    log(f"[SCHEDULER] New command created: ID={new_command.id}, Time={new_command.scheduled_time}")
    
    # Формируем ответ
    result = schemas.ScheduledCommandWithServers.model_validate(new_command)
    result.server_ids = command_data.server_ids
    result.group_ids = command_data.group_ids
    
    return result


@app.put("/api/scheduled-commands/{command_id}", response_model=schemas.ScheduledCommandWithServers)
async def update_scheduled_command(
    command_id: int,
    command_data: schemas.ScheduledCommandUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.ScheduledCommandWithServers:
    """
    Обновление отложенной команды (только если статус = pending).
    
    Args:
        command_id: ID команды
        command_data: Новые данные команды
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        ScheduledCommandWithServers: Обновлённая команда
        
    Raises:
        HTTPException: Если команда не найдена или статус не pending
    """
    command: Optional[models.ScheduledCommand] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommand).filter(
            models.ScheduledCommand.id == command_id,
            models.ScheduledCommand.user_id == current_user.id
        ).first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    if command.status != "pending":
        raise HTTPException(status_code=400, detail="Можно редактировать только ожидающие команды")
    
    # Обновляем поля
    if command_data.name is not None:
        command.name = command_data.name
    if command_data.commands is not None:
        command.commands = command_data.commands
    if command_data.scheduled_time is not None:
        # Конвертируем UTC время в локальное (так же как при создании)
        scheduled_utc = command_data.scheduled_time
        if scheduled_utc.tzinfo is None:
            scheduled_utc = scheduled_utc.replace(tzinfo=timezone.utc)
        command.scheduled_time = scheduled_utc.astimezone().replace(tzinfo=None)
    if command_data.display_time is not None:
        command.display_time = command_data.display_time
    if command_data.timezone is not None:
        command.timezone = command_data.timezone
    if command_data.target_type is not None:
        command.target_type = command_data.target_type
    if command_data.use_botname is not None:
        command.use_botname = command_data.use_botname
    if command_data.delay_between_bots is not None:
        command.delay_between_bots = command_data.delay_between_bots
    if command_data.recurrence_type is not None:
        command.recurrence_type = command_data.recurrence_type
    if command_data.weekdays is not None:
        command.weekdays = json.dumps(command_data.weekdays) if command_data.weekdays else None
    
    # Обновляем связи только если указаны server_ids или group_ids
    if command_data.server_ids is not None or command_data.group_ids is not None:
        # Удаляем ВСЕ старые связи
        await asyncio.to_thread(
            lambda: db.query(models.ScheduledCommandServer).filter(
                models.ScheduledCommandServer.scheduled_command_id == command_id
            ).delete()
        )
        
        # Проверяем и создаем новые связи с серверами
        if command_data.server_ids:
            servers: List[models.Server] = await asyncio.to_thread(
                lambda: db.query(models.Server).filter(
                    models.Server.id.in_(command_data.server_ids),
                    models.Server.user_id == current_user.id
                ).all()
            )
            
            if len(servers) != len(command_data.server_ids):
                raise HTTPException(status_code=404, detail="Один или несколько серверов не найдены")
            
            for server_id in command_data.server_ids:
                link: models.ScheduledCommandServer = models.ScheduledCommandServer(
                    scheduled_command_id=command_id,
                    server_id=server_id,
                    group_name=None
                )
                await asyncio.to_thread(db.add, link)
        
        # Проверяем и создаем новые связи с группами
        if command_data.group_ids:
            for group_name in command_data.group_ids:
                # Проверяем что группа существует
                servers_in_group_count: int = await asyncio.to_thread(
                    lambda gn=group_name: db.query(models.Server).filter(
                        models.Server.user_id == current_user.id,
                        models.Server.group_name.like(f'%{gn}%')
                    ).count()
                )
                
                if servers_in_group_count == 0:
                    raise HTTPException(status_code=404, detail=f"Группа '{group_name}' не найдена или в ней нет серверов")
                
                link = models.ScheduledCommandServer(
                    scheduled_command_id=command_id,
                    server_id=None,
                    group_name=group_name
                )
                await asyncio.to_thread(db.add, link)
    
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, command)
    
    log(f"[SCHEDULED] Command '{command.name}' (ID={command_id}) updated successfully")
    
    # Получаем ID серверов и группы
    server_links: List[models.ScheduledCommandServer] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command_id
        ).all()
    )
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links if link.server_id is not None]
    result.group_ids = [link.group_name for link in server_links if link.group_name is not None]
    
    return result


@app.delete("/api/scheduled-commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Удаление отложенной команды.
    
    Args:
        command_id: ID команды
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Raises:
        HTTPException: Если команда не найдена
    """
    command: Optional[models.ScheduledCommand] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommand).filter(
            models.ScheduledCommand.id == command_id,
            models.ScheduledCommand.user_id == current_user.id
        ).first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    # Удаляем связи с серверами
    await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command_id
        ).delete()
    )
    
    # Удаляем команду
    await asyncio.to_thread(db.delete, command)
    await asyncio.to_thread(db.commit)
    
    return None


@app.post("/api/scheduled-commands/{command_id}/cancel", response_model=schemas.ScheduledCommandWithServers)
async def cancel_scheduled_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> schemas.ScheduledCommandWithServers:
    """
    Отмена отложенной команды (изменение статуса на cancelled).
    
    Args:
        command_id: ID команды
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        ScheduledCommandWithServers: Отменённая команда
        
    Raises:
        HTTPException: Если команда не найдена или не может быть отменена
    """
    command: Optional[models.ScheduledCommand] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommand).filter(
            models.ScheduledCommand.id == command_id,
            models.ScheduledCommand.user_id == current_user.id
        ).first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Отложенная команда не найдена")
    
    if command.status not in ["pending", "executing"]:
        raise HTTPException(status_code=400, detail="Можно отменить только ожидающие или выполняющиеся команды")
    
    command.status = "cancelled"
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, command)
    
    # Получаем ID серверов
    server_links: List[models.ScheduledCommandServer] = await asyncio.to_thread(
        lambda: db.query(models.ScheduledCommandServer).filter(
            models.ScheduledCommandServer.scheduled_command_id == command_id
        ).all()
    )
    
    result = schemas.ScheduledCommandWithServers.model_validate(command)
    result.server_ids = [link.server_id for link in server_links]
    
    return result
