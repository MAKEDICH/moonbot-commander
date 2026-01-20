"""
Pytest fixtures для тестов MoonBot Commander

Содержит общие fixtures для всех тестов:
- Тестовая база данных (in-memory SQLite)
- Тестовый клиент FastAPI
- Моки для внешних сервисов
"""
import os
import sys
import pytest
from typing import Generator
from unittest.mock import MagicMock, patch

# Добавляем backend в path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from models.database import Base, get_db
from models import models
from services import auth


# ==================== DATABASE FIXTURES ====================

@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """
    Создать тестовую базу данных (in-memory SQLite).
    
    Yields:
        Session: Сессия тестовой БД
    """
    # Создаём in-memory SQLite для изоляции тестов
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    
    # Создаём все таблицы
    Base.metadata.create_all(bind=engine)
    
    # Создаём сессию
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_client(test_db: Session) -> Generator[TestClient, None, None]:
    """
    Создать тестовый клиент FastAPI.
    
    Args:
        test_db: Тестовая сессия БД
        
    Yields:
        TestClient: Клиент для тестирования API
    """
    # Импортируем app после настройки fixtures
    from main import app
    
    # Переопределяем dependency для БД
    def override_get_db():
        try:
            yield test_db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    with TestClient(app) as client:
        yield client
    
    app.dependency_overrides.clear()


# ==================== USER FIXTURES ====================

@pytest.fixture
def test_user(test_db: Session) -> models.User:
    """
    Создать тестового пользователя.
    
    Args:
        test_db: Тестовая сессия БД
        
    Returns:
        models.User: Созданный пользователь
    """
    user = models.User(
        username="testuser",
        email="test@example.com",
        hashed_password=auth.get_password_hash("testpassword123")
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_token(test_user: models.User) -> str:
    """
    Получить JWT токен для тестового пользователя.
    
    Args:
        test_user: Тестовый пользователь
        
    Returns:
        str: JWT токен
    """
    return auth.create_access_token(data={"sub": test_user.username})


@pytest.fixture
def auth_headers(auth_token: str) -> dict:
    """
    Получить заголовки авторизации.
    
    Args:
        auth_token: JWT токен
        
    Returns:
        dict: Заголовки с Bearer токеном
    """
    return {"Authorization": f"Bearer {auth_token}"}


# ==================== SERVER FIXTURES ====================

@pytest.fixture
def test_server(test_db: Session, test_user: models.User) -> models.Server:
    """
    Создать тестовый сервер.
    
    Args:
        test_db: Тестовая сессия БД
        test_user: Владелец сервера
        
    Returns:
        models.Server: Созданный сервер
    """
    server = models.Server(
        name="Test Server",
        host="192.168.1.100",
        port=5005,
        user_id=test_user.id,
        is_active=True
    )
    test_db.add(server)
    test_db.commit()
    test_db.refresh(server)
    return server


# ==================== MOCK FIXTURES ====================

@pytest.fixture
def mock_udp_client():
    """
    Мок UDP клиента для тестов без реальных сетевых вызовов.
    
    Yields:
        MagicMock: Замоканный UDP клиент
    """
    with patch('services.udp_client.UDPClient') as mock:
        instance = mock.return_value
        instance.send_command.return_value = (True, "OK")
        instance.send_command_sync.return_value = (True, "OK")
        yield instance



