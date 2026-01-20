"""
Эндпоинт: GET /api/bot-commands/categories
Функция: get_bot_command_categories
"""

from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, timedelta
from models import models
from models import schemas
from models.database import get_db
from main import app
from core import BOT_COMMANDS_REFERENCE


@app.get("/api/bot-commands/categories")
async def get_bot_command_categories():
    """Получение списка категорий команд"""
    categories = list(set([cmd["category"] for cmd in BOT_COMMANDS_REFERENCE]))
    return {"categories": sorted(categories)}