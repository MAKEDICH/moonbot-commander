"""
Конфигурация приложения для масштабирования
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Настройки приложения"""
    
    # Database
    DATABASE_URL: str = "sqlite:///./moonbot_commander.db"
    DATABASE_ECHO: bool = False
    
    # Application
    APP_NAME: str = "MoonBot Commander"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    
    # Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 дней по умолчанию
    ENCRYPTION_KEY: Optional[str] = None
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Caching
    CACHE_ENABLED: bool = True
    CACHE_TTL_SECONDS: int = 300  # 5 минут
    
    # UDP
    UDP_TIMEOUT: int = 5
    UDP_MAX_RETRIES: int = 3
    
    # Scheduler
    SCHEDULER_CHECK_INTERVAL: int = 5
    
    # Backup
    BACKUP_ENABLED: bool = True
    BACKUP_DIR: str = "./backups"
    BACKUP_RETENTION_DAYS: int = 30
    AUTO_BACKUP_INTERVAL_HOURS: int = 24
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "moonbot_commander.log"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Получить настройки приложения (кэшируется)"""
    return Settings()


# Экспортируем для удобства
settings = get_settings()

