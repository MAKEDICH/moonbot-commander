"""
Эндпоинты для работы с пресетами команд

Пресеты - это сохранённые наборы команд для последовательного выполнения.
"""
import asyncio
import json
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services.udp_helper import send_command_unified
from core.server_access import get_user_server
from utils.logging import log


@app.get("/api/presets", response_model=List[schemas.CommandPreset])
async def get_presets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[models.CommandPreset]:
    """
    Получение списка пресетов команд пользователя.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[CommandPreset]: Список пресетов пользователя
    """
    presets: List[models.CommandPreset] = await asyncio.to_thread(
        lambda: db.query(models.CommandPreset)
            .filter(models.CommandPreset.user_id == current_user.id)
            .order_by(models.CommandPreset.button_number)
            .all()
    )
    return presets


@app.post("/api/presets", response_model=schemas.CommandPreset, status_code=status.HTTP_201_CREATED)
async def create_preset(
    preset_data: schemas.CommandPresetCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.CommandPreset:
    """
    Создание нового пресета команд.
    
    Args:
        preset_data: Данные пресета (name, commands, button_number)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        CommandPreset: Созданный пресет
        
    Raises:
        HTTPException: Если номер кнопки вне диапазона 1-50
    """
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    new_preset: models.CommandPreset = models.CommandPreset(
        **preset_data.model_dump(),
        user_id=current_user.id
    )
    
    await asyncio.to_thread(db.add, new_preset)
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, new_preset)
    
    return new_preset


@app.put("/api/presets/{preset_id}", response_model=schemas.CommandPreset)
async def update_preset(
    preset_id: int,
    preset_data: schemas.CommandPresetUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.CommandPreset:
    """
    Обновление пресета команд.
    
    Args:
        preset_id: ID пресета
        preset_data: Новые данные пресета
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        CommandPreset: Обновлённый пресет
        
    Raises:
        HTTPException: Если пресет не найден или номер кнопки вне диапазона
    """
    preset: Optional[models.CommandPreset] = await asyncio.to_thread(
        lambda: db.query(models.CommandPreset)
            .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)
            .first()
    )
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    # Валидация номера кнопки
    if preset_data.button_number is not None:
        if preset_data.button_number < 1 or preset_data.button_number > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Номер кнопки должен быть от 1 до 50"
            )
    
    update_data: dict = preset_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(preset, field, value)
    
    # onupdate в модели автоматически обновит updated_at
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, preset)
    
    return preset


@app.delete("/api/presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_preset(
    preset_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Удаление пресета команд.
    
    Args:
        preset_id: ID пресета
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Raises:
        HTTPException: Если пресет не найден
    """
    preset: Optional[models.CommandPreset] = await asyncio.to_thread(
        lambda: db.query(models.CommandPreset)
            .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)
            .first()
    )
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    await asyncio.to_thread(db.delete, preset)
    await asyncio.to_thread(db.commit)
    
    return None


@app.post("/api/presets/{preset_id}/execute")
async def execute_preset(
    preset_id: int,
    server_id: int,
    timeout: Optional[int] = 5,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Выполнение пресета команд на сервере.
    
    Последовательно выполняет все команды из пресета на указанном сервере.
    
    Args:
        preset_id: ID пресета
        server_id: ID сервера для выполнения
        timeout: Таймаут для каждой команды (по умолчанию 5 сек)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        Dict с результатами выполнения каждой команды
        
    Raises:
        HTTPException: Если пресет или сервер не найден, сервер неактивен
    """
    preset: Optional[models.CommandPreset] = await asyncio.to_thread(
        lambda: db.query(models.CommandPreset)
            .filter(models.CommandPreset.id == preset_id, models.CommandPreset.user_id == current_user.id)
            .first()
    )
    
    if not preset:
        raise HTTPException(status_code=404, detail="Пресет не найден")
    
    # Используем helper для проверки сервера
    server: models.Server = await get_user_server(server_id, current_user, db)
    
    if not server.is_active:
        raise HTTPException(status_code=400, detail="Сервер неактивен")
    
    # Разбиваем команды по переносу строки
    commands_list: List[str]
    try:
        # Пробуем парсить как JSON
        parsed_commands = json.loads(preset.commands)
        if not isinstance(parsed_commands, list):
            raise ValueError("Commands JSON must be a list")
        commands_list = parsed_commands
    except (json.JSONDecodeError, ValueError):
        # Если не JSON, то разбиваем по переносу строки
        commands_list = [cmd.strip() for cmd in preset.commands.split('\n') if cmd.strip()]
    
    results: List[Dict[str, Any]] = []
    
    # Отправка команд через unified helper
    for command in commands_list:
        success: bool
        response: str
        try:
            success, response = await send_command_unified(
                server,
                command,
                timeout=float(timeout or 5)
            )
        except Exception as e:
            log(f"[API] Error sending preset command: {e}", level="ERROR")
            success = False
            response = str(e)
        
        # Сохранение в историю
        history_entry: models.CommandHistory = models.CommandHistory(
            command=command,
            response=response if success else None,
            status="success" if success else "error",
            user_id=current_user.id,
            server_id=server.id
        )
        await asyncio.to_thread(db.add, history_entry)
        
        results.append({
            "command": command,
            "status": "success" if success else "error",
            "response": response
        })
    
    await asyncio.to_thread(db.commit)
    
    return {
        "preset_name": preset.name,
        "server_name": server.name,
        "total_commands": len(commands_list),
        "results": results
    }
