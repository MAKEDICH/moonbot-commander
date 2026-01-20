"""
Эндпоинты для работы с быстрыми командами

Быстрые команды - это сохранённые команды пользователя
для быстрого выполнения на серверах MoonBot.
"""
import asyncio
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user


@app.get("/api/quick-commands", response_model=List[schemas.QuickCommand])
async def get_quick_commands(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> List[models.QuickCommand]:
    """
    Получение списка быстрых команд пользователя.
    
    Возвращает все быстрые команды текущего пользователя,
    отсортированные по полю order.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        List[QuickCommand]: Список быстрых команд пользователя
    """
    commands: List[models.QuickCommand] = await asyncio.to_thread(
        lambda: db.query(models.QuickCommand)
        .filter(models.QuickCommand.user_id == current_user.id)
        .order_by(models.QuickCommand.order)
        .all()
    )
    return commands


@app.post("/api/quick-commands", response_model=schemas.QuickCommand, status_code=status.HTTP_201_CREATED)
async def create_quick_command(
    command_data: schemas.QuickCommandCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.QuickCommand:
    """
    Создание новой быстрой команды.
    
    Args:
        command_data: Данные для создания команды (label, command, order)
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        QuickCommand: Созданная быстрая команда
        
    Raises:
        HTTPException: Если команда с таким label уже существует
    """
    # Проверяем, нет ли уже команды с таким label у пользователя
    existing: Optional[models.QuickCommand] = await asyncio.to_thread(
        lambda: db.query(models.QuickCommand)
        .filter(
            models.QuickCommand.user_id == current_user.id,
            models.QuickCommand.label == command_data.label
        )
        .first()
    )
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Команда с названием '{command_data.label}' уже существует"
        )
    
    new_command: models.QuickCommand = models.QuickCommand(
        **command_data.model_dump(),
        user_id=current_user.id
    )
    
    await asyncio.to_thread(db.add, new_command)
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, new_command)
    
    return new_command


@app.put("/api/quick-commands/{command_id}", response_model=schemas.QuickCommand)
async def update_quick_command(
    command_id: int,
    command_data: schemas.QuickCommandUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> models.QuickCommand:
    """
    Обновление быстрой команды.
    
    Args:
        command_id: ID команды для обновления
        command_data: Новые данные команды
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        QuickCommand: Обновлённая быстрая команда
        
    Raises:
        HTTPException: Если команда не найдена или не принадлежит пользователю
    """
    command: Optional[models.QuickCommand] = await asyncio.to_thread(
        lambda: db.query(models.QuickCommand)
        .filter(models.QuickCommand.id == command_id, models.QuickCommand.user_id == current_user.id)
        .first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Быстрая команда не найдена")
    
    update_data: dict = command_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(command, field, value)
    
    await asyncio.to_thread(db.commit)
    await asyncio.to_thread(db.refresh, command)
    
    return command


@app.delete("/api/quick-commands/{command_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_quick_command(
    command_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Удаление быстрой команды.
    
    Args:
        command_id: ID команды для удаления
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Raises:
        HTTPException: Если команда не найдена или не принадлежит пользователю
    """
    command: Optional[models.QuickCommand] = await asyncio.to_thread(
        lambda: db.query(models.QuickCommand)
        .filter(models.QuickCommand.id == command_id, models.QuickCommand.user_id == current_user.id)
        .first()
    )
    
    if not command:
        raise HTTPException(status_code=404, detail="Быстрая команда не найдена")
    
    await asyncio.to_thread(db.delete, command)
    await asyncio.to_thread(db.commit)
    
    return None


@app.post("/api/quick-commands/remove-duplicates")
async def remove_duplicate_quick_commands(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Удаление дубликатов быстрых команд.
    
    Оставляет только первую команду с каждым уникальным label,
    удаляет остальные дубликаты.
    
    Args:
        current_user: Текущий аутентифицированный пользователь
        db: Сессия базы данных
        
    Returns:
        dict: Количество удалённых дубликатов
    """
    # Получаем все команды пользователя
    commands: List[models.QuickCommand] = await asyncio.to_thread(
        lambda: db.query(models.QuickCommand)
        .filter(models.QuickCommand.user_id == current_user.id)
        .order_by(models.QuickCommand.id)  # Сортируем по id чтобы оставить первую
        .all()
    )
    
    seen_labels: set = set()
    duplicates_to_delete: List[int] = []
    
    for cmd in commands:
        if cmd.label in seen_labels:
            duplicates_to_delete.append(cmd.id)
        else:
            seen_labels.add(cmd.label)
    
    # Удаляем дубликаты
    if duplicates_to_delete:
        await asyncio.to_thread(
            lambda: db.query(models.QuickCommand)
            .filter(models.QuickCommand.id.in_(duplicates_to_delete))
            .delete(synchronize_session=False)
        )
        await asyncio.to_thread(db.commit)
    
    return {"removed": len(duplicates_to_delete)}
