"""
Эндпоинт: GET /api/check-updates
Функция: check_for_updates
"""

from fastapi import Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from services.auth import get_current_user
from services.update_checker import update_checker


@app.get("/api/check-updates")
async def check_for_updates(
    force: bool = Query(False, description="Force check ignoring cache"),
    current_user: models.User = Depends(get_current_user)
):
    """
    Проверить наличие обновлений

    Returns:
        Информация об обновлении или {"update_available": false}
    """
    update_info = await update_checker.check_for_updates(force=force)

    if update_info:
        notification = update_checker.get_update_notification()
        return {
            "update_available": True,
            "current_version": update_checker.current_version,
            "latest_version": update_info["version"],
            "notification": notification
        }

    return {
        "update_available": False,
        "current_version": update_checker.current_version
    }
