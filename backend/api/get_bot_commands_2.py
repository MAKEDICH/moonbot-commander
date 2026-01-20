"""
Эндпоинт: GET /api/bot-commands
Функция: get_bot_commands
"""

from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from core import BOT_COMMANDS_REFERENCE


@app.get("/api/bot-commands", response_model=List[schemas.BotCommand])
async def get_bot_commands():
    """Получение справочника всех команд MoonBot"""
    return BOT_COMMANDS_REFERENCE