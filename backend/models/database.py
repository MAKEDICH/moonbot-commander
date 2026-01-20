"""
Database configuration and session management

Конфигурация подключения к базе данных и управление сессиями SQLAlchemy.
Поддерживает SQLite для разработки и PostgreSQL для продакшена с высокими нагрузками.
"""
import os
from typing import Generator, Dict, Any
from contextlib import contextmanager

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool, NullPool, StaticPool

from utils.config_loader import get_config_value
from utils.logging import log

# Загружаем DATABASE_URL из конфигурации
database_url_env: str = get_config_value('app', 'database.url_env', default='DATABASE_URL')
default_database_url: str = get_config_value(
    'app', 
    'database.default_url', 
    default='sqlite:///./moonbot_commander.db'
)
DATABASE_URL: str = os.getenv(database_url_env, default_database_url)


def _get_engine_config() -> Dict[str, Any]:
    """
    Получить конфигурацию engine в зависимости от типа БД.
    
    Returns:
        Dict с параметрами для create_engine
    """
    is_sqlite = DATABASE_URL.startswith('sqlite')
    is_postgres = DATABASE_URL.startswith('postgresql')
    
    config: Dict[str, Any] = {
        'echo': get_config_value('app', 'database.echo', default=False),
    }
    
    if is_sqlite:
        # SQLite конфигурация (для разработки и небольших нагрузок)
        check_same_thread = get_config_value('app', 'database.check_same_thread', default=False)
        config['connect_args'] = {"check_same_thread": check_same_thread}
        # StaticPool для SQLite в многопоточной среде
        config['poolclass'] = StaticPool
        log("[DATABASE] Using SQLite configuration (development mode)")
        
    elif is_postgres:
        # PostgreSQL конфигурация (для высоких нагрузок)
        pool_size = get_config_value('high_load', 'database.pool.pool_size', default=50)
        max_overflow = get_config_value('high_load', 'database.pool.max_overflow', default=100)
        pool_timeout = get_config_value('high_load', 'database.pool.pool_timeout', default=30)
        pool_recycle = get_config_value('high_load', 'database.pool.pool_recycle', default=1800)
        pool_pre_ping = get_config_value('high_load', 'database.pool.pool_pre_ping', default=True)
        
        config['poolclass'] = QueuePool
        config['pool_size'] = pool_size
        config['max_overflow'] = max_overflow
        config['pool_timeout'] = pool_timeout
        config['pool_recycle'] = pool_recycle
        config['pool_pre_ping'] = pool_pre_ping
        
        log(f"[DATABASE] Using PostgreSQL configuration (high-load mode)")
        log(f"[DATABASE] Pool: size={pool_size}, max_overflow={max_overflow}, timeout={pool_timeout}s")
        
    else:
        # Другие БД - базовая конфигурация с пулом
        config['poolclass'] = QueuePool
        config['pool_size'] = 20
        config['max_overflow'] = 40
        log(f"[DATABASE] Using generic database configuration")
    
    return config


# Создаём engine с оптимальной конфигурацией
engine_config = _get_engine_config()
engine = create_engine(DATABASE_URL, **engine_config)

# Оптимизации для SQLite
if DATABASE_URL.startswith('sqlite'):
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Установить оптимальные PRAGMA для SQLite."""
        cursor = dbapi_connection.cursor()
        # WAL mode для лучшей конкурентности
        cursor.execute("PRAGMA journal_mode=WAL")
        # Синхронизация NORMAL для баланса скорости и надёжности
        cursor.execute("PRAGMA synchronous=NORMAL")
        # Увеличенный кэш
        cursor.execute("PRAGMA cache_size=-64000")  # 64MB
        # Включить foreign keys
        cursor.execute("PRAGMA foreign_keys=ON")
        # Увеличить таймаут блокировки
        cursor.execute("PRAGMA busy_timeout=30000")  # 30 секунд
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency для получения сессии БД в FastAPI эндпоинтах.
    
    Yields:
        Session: Сессия базы данных
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """
    Context manager для получения сессии БД вне FastAPI.
    
    Использование:
        with get_db_context() as db:
            db.query(...)
    
    Yields:
        Session: Сессия базы данных
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_pool_status() -> Dict[str, Any]:
    """
    Получить статус пула соединений.
    
    Returns:
        Dict со статистикой пула
    """
    pool = engine.pool
    return {
        "pool_size": getattr(pool, 'size', lambda: 0)() if callable(getattr(pool, 'size', None)) else getattr(pool, '_pool', {}).qsize() if hasattr(pool, '_pool') else 0,
        "checked_in": pool.checkedin(),
        "checked_out": pool.checkedout(),
        "overflow": pool.overflow(),
        "invalid": pool.invalidatedcount() if hasattr(pool, 'invalidatedcount') else 0,
    }
