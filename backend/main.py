"""
MoonBot UDP Commander - Main Application

Точка входа FastAPI приложения
"""
from services import udp
from services.udp_client import UDPClient
from models import models
from models.database import engine, SessionLocal
from api.routers import cleanup, strategies
from utils.logging import log
from updates.core.auto_migrate import run_auto_migrations
from services.fix_currency_on_startup import fix_server_currencies

# Импорт core модулей
from core import (
    create_app,
    register_startup_events,
    register_shutdown_events,
    register_websocket_endpoint
)

# ==================== ИНИЦИАЛИЗАЦИЯ ====================

# Автоматическое применение миграций
try:
    run_auto_migrations()
except Exception as e:
    log(f"[MAIN] Warning: Auto-migration failed: {e}", level="WARNING")

# Создание таблиц
models.Base.metadata.create_all(bind=engine)

# Исправление валют серверов при запуске
try:
    fix_server_currencies()
except Exception as e:
    log(f"[MAIN] Warning: Currency fix failed: {e}", level="WARNING")

# ==================== СОЗДАНИЕ ПРИЛОЖЕНИЯ ====================

# Создаём приложение
app = create_app()

# Регистрируем роутеры
app.include_router(cleanup.router, prefix="/api/cleanup", tags=["cleanup"])
app.include_router(strategies.router, prefix="/api/strategies", tags=["strategies"])

# UDP клиент
udp_client = UDPClient()

# ==================== ИМПОРТ ЭНДПОИНТОВ ====================

# Все эндпоинты автоматически регистрируются при импорте
import api.api_system_reset
import api.api_auth
import api.api_auth_2fa
# ВАЖНО: api_server_utils должен импортироваться РАНЬШЕ api_server
# чтобы /api/servers/balances регистрировался раньше /api/servers/{server_id}
import api.api_server_utils
import api.api_server
import api.get_trading_currencies
import api.api_commands
import api.get_stats
import api.api_quick_command
import api.api_presets
import api.get_bot_commands_2  # Основная версия команд
import api.get_bot_command_categories
import api.api_user_setting
import api.check_for_updates
import api.get_dashboard_stats
import api.get_commands_daily_stats
import api.get_monthly_profit
import api.root
import api.health_check
import api.api_scheduled_commands
import api.api_scheduler
import api.api_listener
import api.api_sql_log
import api.api_orders
import api.get_moonbot_orders
import api.get_profit_chart_data
import api.get_profit_chart_all_servers
import api.get_strategies_comparison
import api.get_strategies_comparison_all
import api.api_heatmap
import api.sync_orders_from_datetime
import api.get_trading_stats_details
import api.api_errors
import api.api_charts
import api.api_proxy
import api.api_upbit_cache
import api.api_updates
import api.api_data_export
import api.api_binance_alpha
import api.health_metrics  # Метрики производительности для мониторинга

# Регистрируем прокси роутер
app.include_router(api.api_proxy.router, prefix="/api/proxy", tags=["proxy"])
app.include_router(api.api_upbit_cache.router, prefix="/api/upbit", tags=["upbit"])
app.include_router(api.api_binance_alpha.router, prefix="/api", tags=["binance-alpha"])
app.include_router(api.api_data_export.router)
app.include_router(api.api_data_export.public_router)  # Публичный API для восстановления
app.include_router(api.health_check.router)  # Health check для Docker

# Trading Stats (модульная версия)
import api.trading_stats
api.trading_stats.setup(app)

# ==================== РЕГИСТРАЦИЯ СОБЫТИЙ ====================

# Startup и Shutdown события
register_startup_events(app)
register_shutdown_events(app)

# WebSocket endpoint
register_websocket_endpoint(app)

# ==================== READY ====================

log("[MAIN] Application initialized successfully")
