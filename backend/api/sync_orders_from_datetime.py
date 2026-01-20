"""
Эндпоинт: POST /api/servers/{server_id}/sync-from-datetime
Функция: sync_orders_from_datetime
"""
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from core.server_access import get_user_server
from services.udp_client import UDPClient, test_connection
from services import encryption
from utils.logging import log, get_logger
from utils.datetime_utils import utcnow
import re


@app.post("/api/servers/{server_id}/sync-from-datetime")
async def sync_orders_from_datetime(
    server_id: int,
    from_datetime: datetime,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Синхронизация данных с сервера начиная с указанной даты

    Отправляет команду SQLSelect datetime на MoonBot,
    который вернет все SQL команды с этого времени.

    Args:
        server_id: ID сервера
        from_datetime: Начальная дата/время для синхронизации
    """
    # Проверяем что сервер принадлежит пользователю
    server = await get_user_server(server_id, current_user, db)

    # Формируем команду SQLSelect
    # Формат: SQLSelect 2025-11-05T10:00:00
    datetime_str = from_datetime.strftime('%Y-%m-%dT%H:%M:%S')
    command = f"SQLSelect {datetime_str}"

    # Отправляем с многопакетным приемом (может быть много данных!)
    client = UDPClient()
    password = encryption.decrypt_password(server.password) if server.password else None

    success, responses = await client.send_command_multi_response(
        server.host,
        server.port,
        command,
        timeout=60,  # Большой timeout
        password=password,
        packet_timeout=2.0  # 2 секунды между пакетами
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Не удалось выполнить синхронизацию: {responses}"
        )

    # Парсим все SQL команды из ответа
    sql_commands = []
    for line in responses.split('\n'):
        if '[SQLCommand' in line:
            sql_commands.append(line)

    # Сохраняем каждую команду
    saved_count = 0
    for sql_cmd in sql_commands:
        try:
            # Парсим как в listener
            match = re.search(r'\[SQLCommand (\d+)\]', sql_cmd)
            if not match:
                continue

            command_id = int(match.group(1))
            sql_body = sql_cmd[match.end():].strip()

            # Проверяем что такой команды еще нет
            import asyncio
            existing = await asyncio.to_thread(
                lambda: db.query(models.SQLCommandLog).filter(
                    models.SQLCommandLog.server_id == server_id,
                    models.SQLCommandLog.command_id == command_id
                ).first()
            )

            if not existing:
                # Сохраняем новую
                sql_log = models.SQLCommandLog(
                    server_id=server_id,
                    command_id=command_id,
                    sql_text=sql_body,
                    received_at=utcnow(),
                    processed=False
                )
                await asyncio.to_thread(db.add, sql_log)
                saved_count += 1

        except Exception as e:
            log(f"[SYNC] Error parsing command: {e}")
            continue

    import asyncio
    await asyncio.to_thread(db.commit)

    return {
        "message": "Синхронизация завершена",
        "server_id": server_id,
        "server_name": server.name,
        "from_datetime": datetime_str,
        "commands_received": len(sql_commands),
        "commands_saved": saved_count
    }


@app.post("/api/servers/{server_id}/sync-missing")
async def sync_missing_data(
    server_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Автоматическая синхронизация пропущенных данных.
    Определяет время последней записи в БД и запрашивает данные с этого времени.
    """
    server = await get_user_server(server_id, current_user, db)

    import asyncio
    last_log = await asyncio.to_thread(
        lambda: db.query(models.SQLCommandLog).filter(
            models.SQLCommandLog.server_id == server_id
        ).order_by(
            models.SQLCommandLog.received_at.desc()
        ).first()
    )

    if last_log:
        from_datetime = last_log.received_at
    else:
        from_datetime = utcnow() - timedelta(hours=24)

    return await sync_orders_from_datetime(
        server_id=server_id,
        from_datetime=from_datetime,
        current_user=current_user,
        db=db
    )
