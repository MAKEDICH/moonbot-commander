"""
Роутер для выполнения команд на серверах
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import time

from database import get_db
from auth import get_current_user
import schemas
import models
from encryption import decrypt_password
from api.services.cache import cached, invalidate_server_cache, server_cache_key
from udp_client import UDPClient

router = APIRouter(prefix="/api/commands", tags=["Commands"])


@router.post("/execute", response_model=schemas.CommandExecutionResponse)
async def execute_command(
    command_data: schemas.CommandExecute,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Выполнить команду на сервере
    
    РАЗМЫШЛЕНИЕ: Критически важна валидация параметров!
    """
    # ИСПРАВЛЕНО: Валидация timeout
    if command_data.timeout and (command_data.timeout < 1 or command_data.timeout > 60):
        raise HTTPException(
            status_code=400,
            detail="Timeout must be between 1 and 60 seconds"
        )
    
    # ИСПРАВЛЕНО: Валидация длины команды
    if len(command_data.command) > 10000:  # 10KB max
        raise HTTPException(
            status_code=400,
            detail="Command is too long (max 10000 characters)"
        )
    
    # Получаем сервер
    server = db.query(models.Server).filter(
        models.Server.id == command_data.server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Server is inactive")
    
    # Инвалидируем кэш сервера
    invalidate_server_cache(server.id)
    
    # Выполняем команду
    start_time = time.time()
    password = decrypt_password(server.password) if server.password else None
    
    udp_client = UDPClient()
    success, response = await udp_client.send_command(
        server.host,
        server.port,
        command_data.command,
        command_data.timeout or 5,
        password
    )
    
    response_time = (time.time() - start_time) * 1000
    
    # Записываем в историю
    history_entry = models.CommandHistory(
        command=command_data.command[:10000],  # ИСПРАВЛЕНО: Обрезаем для БД
        response=response[:50000] if response and success else None,  # ИСПРАВЛЕНО: Limit response
        status="success" if success else "error",
        response_time_ms=response_time,
        user_id=current_user.id,
        server_id=server.id
    )
    db.add(history_entry)
    db.commit()
    db.refresh(history_entry)
    
    return {
        "success": success,
        "response": response,
        "execution_time": response_time,
        "history_id": history_entry.id
    }


@router.get("/history", response_model=List[schemas.CommandHistoryResponse])
@cached(ttl=60, key_prefix="cmd_history:")
def get_command_history(
    server_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить историю команд"""
    # Ограничиваем limit для защиты от DoS
    if limit > 1000:
        raise HTTPException(status_code=400, detail="Limit cannot exceed 1000")
    if limit < 1:
        raise HTTPException(status_code=400, detail="Limit must be positive")
    if offset < 0:
        raise HTTPException(status_code=400, detail="Offset cannot be negative")
    
    query = db.query(models.CommandHistory).filter(
        models.CommandHistory.user_id == current_user.id
    )
    
    if server_id:
        query = query.filter(models.CommandHistory.server_id == server_id)
    
    if status_filter:
        query = query.filter(models.CommandHistory.status == status_filter)
    
    history = query.order_by(
        models.CommandHistory.execution_time.desc()
    ).limit(limit).offset(offset).all()
    
    return history


@router.get("/quick-commands", response_model=List[schemas.QuickCommand])
@cached(ttl=300, key_prefix="quick_commands:")
def get_quick_commands(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить быстрые команды пользователя"""
    commands = db.query(models.QuickCommand).filter(
        models.QuickCommand.user_id == current_user.id
    ).order_by(models.QuickCommand.order).all()
    
    return commands


@router.post("/quick-commands", response_model=schemas.QuickCommand, status_code=status.HTTP_201_CREATED)
def create_quick_command(
    command_data: schemas.QuickCommandCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Создать быструю команду"""
    new_command = models.QuickCommand(
        **command_data.model_dump(),
        user_id=current_user.id
    )
    
    db.add(new_command)
    db.commit()
    db.refresh(new_command)
    
    # Инвалидируем кэш
    from api.services.cache import invalidate_user_cache
    invalidate_user_cache(current_user.id)
    
    return new_command


@router.put("/quick-commands/{command_id}", response_model=schemas.QuickCommand)
def update_quick_command(
    command_id: int,
    command_data: schemas.QuickCommandUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Обновить быструю команду"""
    command = db.query(models.QuickCommand).filter(
        models.QuickCommand.id == command_id,
        models.QuickCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Quick command not found")
    
    update_data = command_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(command, field, value)
    
    # Обновляем статистику использования
    if hasattr(command_data, 'execute') and command_data.execute:
        command.usage_count = (command.usage_count or 0) + 1
        command.last_used = datetime.utcnow()
    
    db.commit()
    db.refresh(command)
    
    # Инвалидируем кэш
    from api.services.cache import invalidate_user_cache
    invalidate_user_cache(current_user.id)
    
    return command


@router.delete("/quick-commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_quick_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить быструю команду"""
    command = db.query(models.QuickCommand).filter(
        models.QuickCommand.id == command_id,
        models.QuickCommand.user_id == current_user.id
    ).first()
    
    if not command:
        raise HTTPException(status_code=404, detail="Quick command not found")
    
    db.delete(command)
    db.commit()
    
    # Инвалидируем кэш
    from api.services.cache import invalidate_user_cache
    invalidate_user_cache(current_user.id)
    
    return None


@router.get("/presets", response_model=List[schemas.CommandPreset])
@cached(ttl=300, key_prefix="presets:")
def get_presets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить пресеты команд пользователя"""
    presets = db.query(models.CommandPreset).filter(
        models.CommandPreset.user_id == current_user.id
    ).order_by(models.CommandPreset.button_number).all()
    
    return presets


@router.post("/presets/{preset_id}/execute")
async def execute_preset(
    preset_id: int,
    server_id: int,
    timeout: Optional[int] = 5,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Выполнить пресет команд
    
    РАЗМЫШЛЕНИЕ: Пресеты могут содержать много команд!
    Нужны ограничения для защиты от DoS и memory exhaustion.
    """
    # ИСПРАВЛЕНО: Валидация timeout
    if timeout and (timeout < 1 or timeout > 60):
        raise HTTPException(
            status_code=400,
            detail="Timeout must be between 1 and 60 seconds"
        )
    
    # Получаем пресет
    preset = db.query(models.CommandPreset).filter(
        models.CommandPreset.id == preset_id,
        models.CommandPreset.user_id == current_user.id
    ).first()
    
    if not preset:
        raise HTTPException(status_code=404, detail="Preset not found")
    
    # Получаем сервер
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Server is inactive")
    
    # Разбираем команды на строки
    commands_list = [cmd.strip() for cmd in preset.commands.split('\n') if cmd.strip()]
    
    # ИСПРАВЛЕНО: Ограничение количества команд в пресете!
    if len(commands_list) > 100:
        raise HTTPException(
            status_code=400,
            detail=f"Too many commands in preset ({len(commands_list)}). Maximum is 100."
        )
    
    # ИСПРАВЛЕНО: Ограничение длины каждой команды
    for cmd in commands_list:
        if len(cmd) > 10000:
            raise HTTPException(
                status_code=400,
                detail=f"Command too long: {cmd[:50]}... (max 10000 characters)"
            )
    
    results = []
    password = decrypt_password(server.password) if server.password else None
    udp_client = UDPClient()
    
    # Выполняем команды последовательно
    for command in commands_list:
        start_time = time.time()
        success, response = await udp_client.send_command(
            server.host,
            server.port,
            command,
            timeout,
            password
        )
        response_time = (time.time() - start_time) * 1000
        
        # ИСПРАВЛЕНО: Коммитим ПОСЛЕ КАЖДОЙ команды для сохранения истории
        history_entry = models.CommandHistory(
            command=command[:10000],  # Обрезаем для БД
            response=response[:50000] if response and success else None,  # Limit response
            status="success" if success else "error",
            response_time_ms=response_time,
            user_id=current_user.id,
            server_id=server.id
        )
        db.add(history_entry)
        db.commit()  # ИСПРАВЛЕНО: Коммитим после каждой команды!
        
        results.append({
            "command": command,
            "status": "success" if success else "error",
            "response": response,
            "execution_time": response_time
        })
    
    # Обновляем статистику использования пресета
    preset.usage_count = (preset.usage_count or 0) + 1
    preset.last_used = datetime.utcnow()
    
    db.commit()
    
    # Инвалидируем кэш
    invalidate_server_cache(server.id)
    
    return {
        "preset_name": preset.name,
        "server_name": server.name,
        "total_commands": len(commands_list),
        "results": results
    }

