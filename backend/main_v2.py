"""
MoonBot Commander API v2.0
Оптимизированная версия с модульной архитектурой для масштабирования
"""
from fastapi import FastAPI, Request, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from config import settings
from database import Base, engine, get_db
from sqlalchemy.orm import Session
from api.routers import auth, servers, commands
from api.services.cache import CacheService
from backup_service import BackupService
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# РАЗМЫШЛЕНИЕ: Импортируем get_current_user для защиты admin endpoints
from auth import get_current_user
import models  # Для типа User

# Настройка логирования
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(settings.LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle события приложения"""
    logger.info("=" * 60)
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info("=" * 60)
    
    # Создаем таблицы БД если нужно
    Base.metadata.create_all(bind=engine)
    logger.info("✓ Database initialized")
    
    # Создаем директории для бэкапов
    Path(settings.BACKUP_DIR).mkdir(parents=True, exist_ok=True)
    logger.info(f"✓ Backup directory ready: {settings.BACKUP_DIR}")
    
    # Очищаем кэш при старте
    CacheService.clear()
    logger.info("✓ Cache cleared")
    
    logger.info("Application ready!")
    
    yield
    
    # Cleanup при завершении
    logger.info("Shutting down application...")
    CacheService.clear()
    logger.info("Application stopped")


# Инициализация приложения
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="UDP Commander for MoonBot with multi-user support",
    lifespan=lifespan
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(",") if isinstance(settings.CORS_ORIGINS, str) else settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Глобальный обработчик ошибок
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Глобальный обработчик исключений"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


# Подключение роутеров
app.include_router(auth.router)
app.include_router(servers.router)
app.include_router(commands.router)

# TODO: Добавить остальные роутеры:
# - dashboard (статистика)
# - scheduled_commands (планировщик)
# - trading (ордера, аналитика)
# - admin (управление системой, бэкапы)


# Базовые эндпоинты
@app.get("/")
async def root():
    """Корневой эндпоинт"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    """Health check для мониторинга"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "cache_enabled": settings.CACHE_ENABLED,
        "backup_enabled": settings.BACKUP_ENABLED
    }


@app.get("/api/system/info")
@limiter.limit("10/minute")
async def system_info(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)  # ИСПРАВЛЕНО: Требует авторизацию
):
    """
    Информация о системе
    
    РАЗМЫШЛЕНИЕ: Системная информация может содержать чувствительные данные
    (DEBUG статус, версии). Требуем авторизацию!
    """
    from models_v2 import SchemaVersion
    
    # ИСПРАВЛЕНО: Используем get_db вместо ручного SessionLocal
    # Получаем версию схемы БД
    latest_version = db.query(SchemaVersion).order_by(
        SchemaVersion.applied_at.desc()
    ).first()
    
    schema_version = latest_version.version if latest_version else "1.0"
    
    return {
        "app_version": settings.APP_VERSION,
        "schema_version": schema_version,
        "cache_enabled": settings.CACHE_ENABLED,
        "backup_enabled": settings.BACKUP_ENABLED,
        # РАЗМЫШЛЕНИЕ: DEBUG только для аутентифицированных пользователей
        "debug": settings.DEBUG
    }


@app.post("/api/system/cache/clear")
@limiter.limit("5/hour")
async def clear_cache(
    request: Request,
    current_user: models.User = Depends(get_current_user)  # ИСПРАВЛЕНО: Требует авторизацию!
):
    """
    Очистить кэш
    
    РАЗМЫШЛЕНИЕ: Очистка кэша - это административная операция!
    Без авторизации злоумышленник может DoS атаковать приложение,
    постоянно очищая кэш и снижая производительность.
    """
    CacheService.clear()
    logger.info(f"Cache cleared by user {current_user.username}")
    return {"message": "Cache cleared successfully"}


@app.get("/api/system/backups")
@limiter.limit("20/minute")
async def list_backups(
    request: Request,
    current_user: models.User = Depends(get_current_user)  # ИСПРАВЛЕНО: Требует авторизацию!
):
    """
    Список доступных бэкапов
    
    РАЗМЫШЛЕНИЕ: Список бэкапов может раскрыть информацию о структуре БД,
    частоте обновлений, и т.д. Требуем авторизацию!
    """
    backup_service = BackupService()
    backups = backup_service.list_backups()
    
    return {
        "backups": backups,
        "total": len(backups)
    }


@app.post("/api/system/backup/create")
@limiter.limit("5/hour")
async def create_manual_backup(
    request: Request,
    current_user: models.User = Depends(get_current_user)  # ИСПРАВЛЕНО: Требует авторизацию!
):
    """
    Создать ручной бэкап
    
    РАЗМЫШЛЕНИЕ: Создание бэкапа - это I/O операция которая может замедлить сервер!
    Без авторизации злоумышленник может создавать бэкапы каждую минуту,
    заполняя диск и нагружая систему. КРИТИЧЕСКИ ВАЖНА АВТОРИЗАЦИЯ!
    """
    # ИСПРАВЛЕНО: Используем DATABASE_URL из config вместо хардкода
    db_path = settings.DATABASE_URL.replace("sqlite:///./", "")
    
    backup_service = BackupService()
    success, backup_path, error = backup_service.create_backup(
        db_path=db_path,  # ИСПРАВЛЕНО: Теперь конфигурируемо
        backup_type="manual",
        version=settings.APP_VERSION
    )
    
    if success:
        logger.info(f"Manual backup created by user {current_user.username}: {backup_path}")
        return {
            "success": True,
            "backup_path": backup_path,
            "message": "Backup created successfully"
        }
    else:
        logger.error(f"Backup creation failed for user {current_user.username}: {error}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "error": error
            }
        )


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main_v2:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )

