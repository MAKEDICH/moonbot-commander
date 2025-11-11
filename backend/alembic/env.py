import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Добавляем путь к backend для импорта моделей
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Импортируем наши модели
from database import Base

# Определяем какие модели использовать (v1 или v2)
# Проверяем наличие schema_versions таблицы
import sqlite3
database_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "moonbot_commander.db")

use_v2_models = False
if os.path.exists(database_path):
    try:
        conn = sqlite3.connect(database_path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_versions'")
        if cursor.fetchone():
            use_v2_models = True
        conn.close()
    except:
        pass

# Импортируем соответствующие модели
if use_v2_models:
    print("Alembic: Using models_v2 (detected v2.0 schema)")
    from models_v2 import *  # Все модели v2.0
else:
    print("Alembic: Using models (v1.0 schema or initial)")
    from models import *  # Все модели v1.0

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Получаем DATABASE_URL из переменной окружения или используем дефолтный
from dotenv import load_dotenv
load_dotenv()

database_url = os.getenv("DATABASE_URL", "sqlite:///./moonbot_commander.db")
config.set_main_option("sqlalchemy.url", database_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            compare_type=True,  # Сравнивать типы данных
            compare_server_default=True  # Сравнивать дефолтные значения
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
