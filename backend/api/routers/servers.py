"""
Роутер для управления серверами
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from auth import get_current_user
import schemas
import models
from encryption import encrypt_password, decrypt_password
from ip_validator import validate_host  # ДОБАВЛЕНО: IP валидация

router = APIRouter(prefix="/api/servers", tags=["Servers"])


# Схема для баланса сервера
class ServerBalanceResponse(BaseModel):
    server_id: int
    server_name: str
    host: str
    port: int
    is_active: bool
    bot_name: Optional[str] = None
    available: float
    total: float
    updated_at: Optional[str] = None
    
    class Config:
        from_attributes = True


@router.get("/balances", response_model=List[ServerBalanceResponse], tags=["Balances"])
def get_server_balances(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Получить балансы всех серверов пользователя
    
    Возвращает список серверов с их текущими балансами
    """
    servers = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    ).all()
    
    result = []
    for server in servers:
        # Получаем последний баланс для сервера
        balance = db.query(models.ServerBalance).filter(
            models.ServerBalance.server_id == server.id
        ).first()
        
        result.append(ServerBalanceResponse(
            server_id=server.id,
            server_name=server.name,
            host=server.host,
            port=server.port,
            is_active=server.is_active,
            bot_name=balance.bot_name if balance else None,
            available=float(balance.available) if balance and balance.available else 0.0,
            total=float(balance.total) if balance and balance.total else 0.0,
            updated_at=balance.updated_at.isoformat() if balance and balance.updated_at else None,
        ))
    
    return result


@router.get("", response_model=List[schemas.ServerResponse])
def get_servers(
    group_name: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список серверов пользователя"""
    query = db.query(models.Server).filter(
        models.Server.user_id == current_user.id
    )
    
    if group_name:
        query = query.filter(models.Server.group_name == group_name)
    
    if is_active is not None:
        query = query.filter(models.Server.is_active == is_active)
    
    servers = query.order_by(models.Server.created_at.desc()).all()
    return servers


@router.get("/{server_id}", response_model=schemas.ServerResponse)
def get_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить информацию о конкретном сервере"""
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return server


@router.post("", response_model=schemas.ServerResponse, status_code=status.HTTP_201_CREATED)
def create_server(
    server_data: schemas.ServerCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Создать новый сервер
    
    РАЗМЫШЛЕНИЕ: Критически важна валидация host перед созданием!
    Без валидации возможны атаки:
    - SSRF (Server-Side Request Forgery)
    - DNS rebinding
    - Loopback bypass
    """
    # ИСПРАВЛЕНО: Валидация host перед созданием
    is_valid, error_message = validate_host(server_data.host, allow_private=True)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid host: {error_message}"
        )
    
    # Шифруем пароль если указан
    encrypted_password = None
    if server_data.password:
        encrypted_password = encrypt_password(server_data.password)
    
    new_server = models.Server(
        name=server_data.name,
        host=server_data.host,
        port=server_data.port,
        password=encrypted_password,
        description=server_data.description,
        group_name=server_data.group_name,
        user_id=current_user.id
    )
    
    db.add(new_server)
    db.commit()
    db.refresh(new_server)
    
    # Создаем запись статуса для сервера
    server_status = models.ServerStatus(server_id=new_server.id)
    db.add(server_status)
    db.commit()
    
    return new_server


@router.put("/{server_id}", response_model=schemas.ServerResponse)
def update_server(
    server_id: int,
    server_data: schemas.ServerUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Обновить сервер
    
    РАЗМЫШЛЕНИЕ: При обновлении host также нужна валидация!
    """
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    update_data = server_data.model_dump(exclude_unset=True)
    
    # ИСПРАВЛЕНО: Валидация host при обновлении
    if 'host' in update_data and update_data['host']:
        is_valid, error_message = validate_host(update_data['host'], allow_private=True)
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid host: {error_message}"
            )
    
    # Шифруем новый пароль если указан И он НЕ зашифрован
    if 'password' in update_data and update_data['password']:
        # Проверяем, не является ли пароль уже зашифрованным (начинается с gAAAAA... - Fernet signature)
        if not update_data['password'].startswith('gAAAAA'):
            update_data['password'] = encrypt_password(update_data['password'])
        # Если пароль уже зашифрован (начинается с gAAAAA), оставляем как есть
    
    for field, value in update_data.items():
        setattr(server, field, value)
    
    server.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(server)
    
    return server


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Удалить сервер"""
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    db.delete(server)
    db.commit()
    
    return None


@router.get("/groups/list")
def get_server_groups(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Получить список всех групп серверов"""
    groups = db.query(models.Server.group_name).filter(
        models.Server.user_id == current_user.id,
        models.Server.group_name.isnot(None)
    ).distinct().all()
    
    return {"groups": [g[0] for g in groups if g[0]]}


@router.post("/{server_id}/ping")
async def ping_server(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Пинг сервера для проверки доступности"""
    from udp_client import UDPClient
    import time
    
    server = db.query(models.Server).filter(
        models.Server.id == server_id,
        models.Server.user_id == current_user.id
    ).first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    # Получаем или создаем статус
    status_record = server.server_status
    if not status_record:
        status_record = models.ServerStatus(server_id=server.id)
        db.add(status_record)
    
    # Пингуем сервер
    start_time = time.time()
    
    try:
        password = decrypt_password(server.password) if server.password else None
        udp_client = UDPClient()
        success, response = await udp_client.send_command(
            server.host,
            server.port,
            "lst",
            timeout=3,
            password=password
        )
        
        response_time = (time.time() - start_time) * 1000
        
        if success:
            status_record.is_online = True
            status_record.last_ping = datetime.utcnow()
            status_record.response_time = response_time
            status_record.last_error = None
            status_record.consecutive_failures = 0
            
            # Обновляем uptime
            current_uptime = status_record.uptime_percentage or 100.0
            status_record.uptime_percentage = min(100.0, current_uptime + 1.0)
        else:
            raise Exception(response or "No response")
    
    except Exception as e:
        status_record.is_online = False
        status_record.last_ping = datetime.utcnow()
        status_record.last_error = str(e)
        status_record.consecutive_failures += 1
        
        # Уменьшаем uptime
        current_uptime = status_record.uptime_percentage or 100.0
        status_record.uptime_percentage = max(0.0, current_uptime - 5.0)
    
    db.commit()
    db.refresh(status_record)
    
    return {
        "server_id": server.id,
        "is_online": status_record.is_online,
        "response_time": status_record.response_time,
        "last_error": status_record.last_error
    }

