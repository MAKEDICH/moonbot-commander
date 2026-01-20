"""
Конфигурация приложения FastAPI

Создание и настройка экземпляра FastAPI, CORS, rate limiter
"""
import os
import socket
import traceback
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import List
from utils.config_loader import get_config_value
from utils.logging import log

# Rate limiter (глобальный)
limiter = Limiter(key_func=get_remote_address)


def create_app() -> FastAPI:
    """
    Создать и настроить экземпляр FastAPI.
    
    Returns:
        FastAPI: Настроенный экземпляр приложения
    """
    # Загрузка конфигурации из YAML
    app_name: str = get_config_value('app', 'app.name', default='MoonBot Commander')
    app_version: str = get_config_value('app', 'app.version', default='2.0.0')
    app_debug: bool = get_config_value('app', 'app.debug', default=False)
    
    app = FastAPI(
        title=app_name,
        description="Профессиональное приложение для удаленного управления торговыми ботами MoonBot через UDP",
        version=app_version,
        debug=app_debug
    )
    
    # Добавляем rate limiter в app state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    
    # Глобальный обработчик необработанных исключений
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """
        Глобальный обработчик всех необработанных исключений.
        
        Логирует ошибку и возвращает безопасный JSON ответ.
        """
        error_id = id(exc)  # Уникальный ID для отслеживания в логах
        log(f"[ERROR-{error_id}] Unhandled exception: {type(exc).__name__}: {exc}", level="ERROR")
        log(f"[ERROR-{error_id}] Path: {request.url.path}", level="ERROR")
        log(f"[ERROR-{error_id}] Traceback: {traceback.format_exc()}", level="DEBUG")
        
        # В production не показываем детали ошибки
        if app_debug:
            detail = str(exc)
        else:
            detail = "Internal server error"
        
        return JSONResponse(
            status_code=500,
            content={
                "detail": detail,
                "error_id": error_id,
                "type": type(exc).__name__
            }
        )
    
    # CORS настройки
    setup_cors(app)
    
    return app


def setup_cors(app: FastAPI) -> None:
    """
    Настроить CORS для приложения.
    
    Args:
        app: Экземпляр FastAPI приложения
    """
    # Загружаем origins из YAML конфигурации
    cors_origins_yaml = get_config_value('app', 'cors.origins', default=None)
    
    cors_origins: List[str]
    allow_all_origins: bool = False
    
    if cors_origins_yaml and isinstance(cors_origins_yaml, list):
        cors_origins = cors_origins_yaml
    else:
        # Fallback к переменным окружения
        cors_origins_env: str = get_config_value('app', 'cors.origins_env', default='CORS_ORIGINS')
        cors_origins_str: str = os.getenv(cors_origins_env, "http://localhost:3000,http://127.0.0.1:3000")
        
        # Проверяем на wildcard
        if cors_origins_str.strip() == "*":
            allow_all_origins = True
            cors_origins = ["*"]
        else:
            cors_origins = [origin.strip() for origin in cors_origins_str.split(',')]
    
    # Добавляем динамический origin для production (только если не wildcard)
    if not allow_all_origins:
        try:
            hostname: str = socket.gethostname()
            local_ip: str = socket.gethostbyname(hostname)
            cors_origins.append(f"http://{local_ip}:3000")
            cors_origins.append(f"https://{local_ip}:3000")
        except (socket.error, socket.gaierror) as e:
            from utils.logging import log
            log(f"[CORS] Failed to get local IP: {e}", level="WARNING")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=not allow_all_origins,  # credentials не работают с wildcard
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["Content-Type", "Authorization",
                      "Accept", "Origin", "X-Requested-With"],
    )

