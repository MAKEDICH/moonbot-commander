"""
Миграция для добавления таблицы moonbot_charts

Запуск:
    python updates/migrate_add_charts.py
"""
from models.database import engine
from models.models import Base, MoonBotChart
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate():
    """Создать таблицу moonbot_charts если она не существует"""
    try:
        # Создаём только таблицу MoonBotChart
        MoonBotChart.__table__.create(engine, checkfirst=True)
        logger.info("✅ Таблица moonbot_charts создана или уже существует")
        return True
    except Exception as e:
        logger.error(f"❌ Ошибка создания таблицы: {e}")
        return False


if __name__ == "__main__":
    migrate()



