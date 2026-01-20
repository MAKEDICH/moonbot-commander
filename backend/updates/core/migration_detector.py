"""
Обнаружение примененных миграций по структуре
"""
import sqlite3
from pathlib import Path
from typing import List
import logging
from .migration_types import (
    table_exists,
    column_exists,
    check_package_installed,
    check_env_contains
)


logger = logging.getLogger(__name__)


def detect_applied_by_structure(conn: sqlite3.Connection, db_path: Path) -> List[str]:
    """Определить примененные миграции по структуре БД и файловой системе"""
    applied = []
    
    # БД миграции
    db_checks = {
        'migrate_add_password': lambda: column_exists(conn, 'servers', 'password'),
        'migrate_add_keepalive': lambda: column_exists(conn, 'servers', 'keepalive_enabled'),
        'migrate_add_2fa': lambda: column_exists(conn, 'users', 'totp_secret'),
        'migrate_add_recovery_codes': lambda: table_exists(conn, 'recovery_codes'),
        'migrate_add_udp_listener': lambda: table_exists(conn, 'moonbot_orders'),
        'migrate_add_balance_and_strategies': lambda: table_exists(conn, 'server_balance'),
        'migrate_add_balance_fields': lambda: column_exists(conn, 'server_balance', 'is_running') and column_exists(conn, 'server_balance', 'version'),
        'migrate_add_cleanup_settings': lambda: table_exists(conn, 'cleanup_settings'),
        'migrate_001_recurrence_weekdays': lambda: column_exists(conn, 'scheduled_commands', 'weekdays'),
        'migrate_002_add_is_localhost': lambda: column_exists(conn, 'servers', 'is_localhost'),
        'migrate_add_created_from_update': lambda: column_exists(conn, 'moonbot_orders', 'created_from_update'),
        'migrate_add_display_time': lambda: column_exists(conn, 'scheduled_commands', 'display_time'),
        'migrate_add_timezone': lambda: column_exists(conn, 'scheduled_commands', 'timezone'),
        'migrate_add_default_currency': lambda: column_exists(conn, 'moonbot_orders', 'base_currency'),
        'migrate_scheduled_commands_full': lambda: column_exists(conn, 'scheduled_commands', 'recurrence_type'),
        'migrate_add_scheduler_settings': lambda: table_exists(conn, 'scheduler_settings'),
        'migrate_cleanup_settings_v2': lambda: column_exists(conn, 'cleanup_settings', 'auto_cleanup_sql_logs'),
        'migrate_moonbot_orders_extended': lambda: column_exists(conn, 'moonbot_orders', 'exchange'),
    }
    
    # Проверка зависимостей
    dependencies_checks = {
        'add_websockets_dependency': lambda: check_package_installed('websockets'),
        'add_aiohttp_packaging': lambda: check_package_installed('aiohttp') and check_package_installed('packaging'),
    }
    
    # Проверка конфигураций
    config_checks = {
        'update_env_cors_origins': lambda: check_env_contains(db_path, 'CORS_ORIGINS', 'localhost:3000'),
        'add_env_moonbot_mode': lambda: check_env_contains(db_path, 'MOONBOT_MODE'),
    }
    
    # Проверка структуры
    structure_checks = {
        'create_logs_directory': lambda: (db_path.parent / 'logs').exists(),
        'create_backups_directory': lambda: (db_path.parent / 'backups').exists(),
        'create_api_directory': lambda: (db_path.parent / 'api').exists(),
    }
    
    # Проверка файлов
    files_checks = {
        'migrate_scheduler_enabled_file': lambda: (
            (db_path.parent / 'services' / 'scheduler_enabled.txt').exists()
            or (db_path.parent / 'scheduler_enabled.txt').exists()
        ),
    }
    
    # Выполняем все проверки
    all_checks = {**db_checks, **dependencies_checks, **config_checks, **structure_checks, **files_checks}
    
    for migration, check in all_checks.items():
        try:
            if check():
                applied.append(migration)
        except Exception:
            pass  # Проверка не удалась - считаем миграцию не применённой
    
    return applied

