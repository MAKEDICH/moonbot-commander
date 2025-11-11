"""
Конфигурация для поддержки множественных баз данных
Позволяет работать с разными БД в зависимости от окружения
"""
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool, NullPool, QueuePool
from contextlib import contextmanager
import os

from config import settings


class DatabaseConfig:
    """Конфигурация базы данных"""
    
    # Основная БД (по умолчанию SQLite)
    PRIMARY_DB = settings.DATABASE_URL
    
    # Дополнительные БД (для будущего использования)
    # Например, отдельная БД для аналитики или логов
    ANALYTICS_DB = os.getenv("ANALYTICS_DATABASE_URL", PRIMARY_DB)
    LOGS_DB = os.getenv("LOGS_DATABASE_URL", PRIMARY_DB)
    
    # Настройки пула соединений
    POOL_CONFIG = {
        "sqlite": {
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,  # Для SQLite
        },
        "postgresql": {
            "pool_size": 20,
            "max_overflow": 10,
            "pool_pre_ping": True,
            "poolclass": QueuePool,
        },
        "mysql": {
            "pool_size": 20,
            "max_overflow": 10,
            "pool_pre_ping": True,
            "poolclass": QueuePool,
        }
    }
    
    @staticmethod
    def get_db_type(url: str) -> str:
        """Определить тип БД из URL"""
        if url.startswith("sqlite"):
            return "sqlite"
        elif url.startswith("postgresql"):
            return "postgresql"
        elif url.startswith("mysql"):
            return "mysql"
        else:
            return "unknown"


class DatabaseManager:
    """Менеджер для управления множественными подключениями к БД"""
    
    def __init__(self):
        self.engines = {}
        self.session_makers = {}
        
        # Инициализация основной БД
        self._init_database("primary", DatabaseConfig.PRIMARY_DB)
        
        # Инициализация дополнительных БД если они отличаются от основной
        if DatabaseConfig.ANALYTICS_DB != DatabaseConfig.PRIMARY_DB:
            self._init_database("analytics", DatabaseConfig.ANALYTICS_DB)
        
        if DatabaseConfig.LOGS_DB != DatabaseConfig.PRIMARY_DB:
            self._init_database("logs", DatabaseConfig.LOGS_DB)
    
    def _init_database(self, name: str, url: str):
        """Инициализировать подключение к БД"""
        db_type = DatabaseConfig.get_db_type(url)
        pool_config = DatabaseConfig.POOL_CONFIG.get(db_type, {})
        
        # Создаем engine
        engine = create_engine(
            url,
            echo=settings.DATABASE_ECHO,
            **pool_config
        )
        
        # Создаем session maker
        session_maker = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=engine
        )
        
        self.engines[name] = engine
        self.session_makers[name] = session_maker
    
    def get_engine(self, name: str = "primary"):
        """Получить engine для указанной БД"""
        return self.engines.get(name)
    
    def get_session_maker(self, name: str = "primary"):
        """Получить session maker для указанной БД"""
        return self.session_makers.get(name)
    
    @contextmanager
    def get_session(self, name: str = "primary"):
        """Получить сессию для указанной БД (context manager)"""
        SessionMaker = self.get_session_maker(name)
        session = SessionMaker()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def close_all(self):
        """Закрыть все подключения"""
        for engine in self.engines.values():
            engine.dispose()


# Глобальный экземпляр менеджера
db_manager = DatabaseManager()


# Dependency для FastAPI
def get_db() -> Session:
    """
    Dependency для получения сессии основной БД
    
    Usage:
        @app.get("/")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    SessionMaker = db_manager.get_session_maker("primary")
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()


def get_analytics_db() -> Session:
    """
    Dependency для получения сессии БД аналитики
    
    Usage:
        @app.get("/analytics")
        def endpoint(db: Session = Depends(get_analytics_db)):
            ...
    """
    SessionMaker = db_manager.get_session_maker("analytics")
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()


def get_logs_db() -> Session:
    """
    Dependency для получения сессии БД логов
    
    Usage:
        @app.get("/logs")
        def endpoint(db: Session = Depends(get_logs_db)):
            ...
    """
    SessionMaker = db_manager.get_session_maker("logs")
    db = SessionMaker()
    try:
        yield db
    finally:
        db.close()


# Утилиты для работы с несколькими БД
class TransactionManager:
    """Менеджер транзакций для работы с несколькими БД"""
    
    @staticmethod
    @contextmanager
    def multi_db_transaction(*db_names):
        """
        Выполнить транзакцию в нескольких БД
        Если хотя бы одна упадет - откатятся все
        
        Usage:
            with TransactionManager.multi_db_transaction("primary", "analytics") as (db1, db2):
                user = User(...)
                db1.add(user)
                
                analytic = Analytics(...)
                db2.add(analytic)
        """
        sessions = []
        try:
            # Открываем все сессии
            for name in db_names:
                SessionMaker = db_manager.get_session_maker(name)
                session = SessionMaker()
                sessions.append(session)
            
            yield tuple(sessions)
            
            # Коммитим все сессии
            for session in sessions:
                session.commit()
                
        except Exception:
            # Откатываем все сессии при ошибке
            for session in sessions:
                session.rollback()
            raise
            
        finally:
            # Закрываем все сессии
            for session in sessions:
                session.close()


# Пример использования
"""
# В .env файле:
DATABASE_URL=sqlite:///./moonbot_commander.db
ANALYTICS_DATABASE_URL=postgresql://user:pass@localhost/analytics
LOGS_DATABASE_URL=mysql://user:pass@localhost/logs

# В роутере:
from database_multi import get_db, get_analytics_db, TransactionManager

@router.post("/users")
def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    analytics_db: Session = Depends(get_analytics_db)
):
    # Сохраняем пользователя в основную БД
    user = User(**user_data.dict())
    db.add(user)
    db.commit()
    
    # Сохраняем событие в БД аналитики
    event = AnalyticsEvent(
        type="user_created",
        user_id=user.id
    )
    analytics_db.add(event)
    analytics_db.commit()
    
    return user

# Или с транзакцией:
@router.post("/users-transactional")
def create_user_transactional(user_data: UserCreate):
    with TransactionManager.multi_db_transaction("primary", "analytics") as (db, analytics_db):
        user = User(**user_data.dict())
        db.add(user)
        
        event = AnalyticsEvent(
            type="user_created",
            user_id=user.id
        )
        analytics_db.add(event)
    
    return user
"""


# Для совместимости со старым кодом
def get_db_legacy():
    """Старый метод получения сессии (для обратной совместимости)"""
    return get_db()

