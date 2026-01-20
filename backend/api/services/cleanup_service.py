"""
Сервис очистки данных.

Содержит функции для:
- Получения статистики БД
- Очистки файлов логов
- Авто-очистки по расписанию
- Полной очистки временных данных
"""

from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import shutil
import glob
import re

from models import models
from utils.logging import log
from utils.datetime_utils import utcnow

# Импортируем операции очистки БД из отдельного модуля
from .cleanup_db_operations import (
    cleanup_old_logs,
    cleanup_command_history,
    cleanup_api_errors,
    cleanup_charts,
    cleanup_strategy_cache,
    vacuum_database
)

# Реэкспорт для обратной совместимости
__all__ = [
    'get_database_stats',
    'cleanup_old_logs',
    'cleanup_command_history',
    'cleanup_api_errors',
    'cleanup_charts',
    'cleanup_strategy_cache',
    'vacuum_database',
    'cleanup_backend_logs',
    'auto_cleanup_check',
    'get_disk_usage',
    'full_cleanup'
]


def get_database_stats(user_id: int, db: Session) -> dict:
    """Получить статистику размера БД и количества записей"""
    try:
        # Подсчитать записи в таблицах
        sql_logs_count = db.query(func.count(models.SQLCommandLog.id)).scalar() or 0
        command_history_count = db.query(func.count(models.CommandHistory.id)).filter(
            models.CommandHistory.user_id == user_id
        ).scalar() or 0
        orders_count = db.query(func.count(models.MoonBotOrder.id)).scalar() or 0
        
        # Получить размер файлов БД (в директории backend)
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        project_root = os.path.dirname(backend_dir)
        
        db_files = {
            'moonbot_db': os.path.join(backend_dir, 'moonbot.db'),
            'commander_db': os.path.join(backend_dir, 'moonbot_commander.db'),
        }
        
        file_sizes = {}
        for key, filepath in db_files.items():
            if os.path.exists(filepath):
                file_sizes[key] = os.path.getsize(filepath)
            else:
                file_sizes[key] = 0
        
        # Размер РОТИРОВАННЫХ логов
        log_patterns = [
            '*_moonbot_*.log',
            '*_backend_*.log',
            '*_frontend_*.log',
            '*_scheduler_*.log'
        ]
        
        total_rotated_logs_size = 0
        logs_dir = os.path.join(project_root, 'logs')
        
        for pattern in log_patterns:
            pattern_path = os.path.join(logs_dir, pattern)
            for log_file in glob.glob(pattern_path):
                if os.path.exists(log_file):
                    total_rotated_logs_size += os.path.getsize(log_file)
        
        file_sizes['logs'] = total_rotated_logs_size
        
        # Проверяем наличие других файлов
        additional_files = {
            'alembic.ini': os.path.join(backend_dir, 'alembic.ini'),
            '.env': os.path.join(backend_dir, '.env')
        }
        
        for key, filepath in additional_files.items():
            if os.path.exists(filepath):
                file_sizes[key] = os.path.getsize(filepath)
            else:
                file_sizes[key] = 0
        
        # Получить свободное место на диске
        disk_usage = get_disk_usage()
        
        return {
            'tables': {
                'sql_logs': sql_logs_count,
                'command_history': command_history_count,
                'orders': orders_count
            },
            'files': file_sizes,
            'disk': disk_usage
        }
    except Exception as e:
        log(f"Error getting database stats: {e}", level="ERROR")
        return {
            'tables': {},
            'files': {},
            'disk': {}
        }


def cleanup_backend_logs(max_size_mb: int = 0) -> dict:
    """Очистить РОТИРОВАННЫЕ файлы логов backend
    
    Чистим ТОЛЬКО старые ротированные файлы (.log.1, .log.2, .log.3, etc.)
    НЕ трогаем активные .log файлы (они заняты приложением)
    
    Args:
        max_size_mb: Максимальный размер РОТИРОВАННЫХ логов в МБ. Если 0 - удалить все
    
    Returns:
        dict: {'deleted_count': int, 'freed_bytes': int, 'status': str}
    """
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        project_root = os.path.dirname(backend_dir)
        logs_dir = os.path.join(project_root, 'logs')
        
        log_patterns = [
            '*_moonbot_*.log',
            '*_backend_*.log',
            '*_frontend_*.log',
            '*_scheduler_*.log'
        ]
        
        deleted_count = 0
        freed_bytes = 0
        
        # Собираем все ротированные файлы
        rotated_files = []
        for pattern in log_patterns:
            pattern_path = os.path.join(logs_dir, pattern)
            for log_file in glob.glob(pattern_path):
                if os.path.exists(log_file):
                    file_size = os.path.getsize(log_file)
                    match = re.search(r'\.(\d+)$', log_file)
                    rotation_num = int(match.group(1)) if match else 0
                    rotated_files.append({
                        'path': log_file,
                        'size': file_size,
                        'rotation': rotation_num
                    })
        
        if not rotated_files:
            return {
                'deleted_count': 0,
                'freed_bytes': 0,
                'status': 'success',
                'message': 'Нет ротированных файлов для удаления'
            }
        
        # Сортируем по номеру ротации (от самых старых к новым)
        rotated_files.sort(key=lambda x: x['rotation'], reverse=True)
        
        if max_size_mb == 0:
            # Удалить ВСЕ ротированные файлы
            for file_info in rotated_files:
                try:
                    os.remove(file_info['path'])
                    deleted_count += 1
                    freed_bytes += file_info['size']
                    log(f"[CLEANUP] Deleted rotated log: {os.path.basename(file_info['path'])}")
                except Exception as e:
                    log(f"[CLEANUP] Error deleting {file_info['path']}: {e}", level="ERROR")
        else:
            # Удалять старые файлы, пока общий размер не станет <= max_size_mb
            max_bytes = max_size_mb * 1024 * 1024
            current_size = sum(f['size'] for f in rotated_files)
            
            if current_size <= max_bytes:
                return {
                    'deleted_count': 0,
                    'freed_bytes': 0,
                    'status': 'success',
                    'message': f'Размер логов уже в пределах {max_size_mb} MB'
                }
            
            for file_info in rotated_files:
                if current_size <= max_bytes:
                    break
                
                try:
                    os.remove(file_info['path'])
                    deleted_count += 1
                    freed_bytes += file_info['size']
                    current_size -= file_info['size']
                except Exception as e:
                    log(f"[CLEANUP] Error deleting {file_info['path']}: {e}", level="ERROR")
        
        log(f"[CLEANUP] Backend logs cleanup: {deleted_count} files, {freed_bytes / 1024 / 1024:.2f} MB freed")
        
        return {
            'deleted_count': deleted_count,
            'freed_bytes': freed_bytes,
            'status': 'success'
        }
    except Exception as e:
        log(f"[CLEANUP] Error cleaning up backend logs: {e}", level="ERROR")
        return {
            'deleted_count': 0,
            'freed_bytes': 0,
            'status': 'error',
            'message': str(e)
        }


def auto_cleanup_check(user_id: int, db: Session) -> None:
    """
    Проверить необходимость автоочистки (запускается по расписанию).
    
    ВАЖНО для 3000+ серверов: регулярная очистка критична!
    """
    try:
        settings = db.query(models.CleanupSettings).filter(
            models.CleanupSettings.user_id == user_id
        ).first()
        
        if not settings or not settings.enabled:
            return
        
        should_cleanup = False
        
        # Проверка по времени
        if settings.trigger_type in ['time', 'combined']:
            if settings.last_cleanup:
                days_since_cleanup = (utcnow() - settings.last_cleanup).days
                if days_since_cleanup >= settings.days_to_keep:
                    should_cleanup = True
            else:
                should_cleanup = True
        
        # Проверка по диску
        if settings.trigger_type in ['disk', 'combined']:
            disk_info = get_disk_usage()
            if disk_info['percent'] >= settings.disk_threshold_percent:
                should_cleanup = True
        
        if should_cleanup:
            log(f"[AUTO-CLEANUP] Running for user {user_id}")
            
            if settings.auto_cleanup_sql_logs:
                cleanup_old_logs(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_command_history:
                cleanup_command_history(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_backend_logs:
                cleanup_backend_logs(settings.backend_logs_max_size_mb)
            
            # Очистка для 3000+ серверов
            if getattr(settings, 'auto_cleanup_api_errors', True):
                api_errors_days = getattr(settings, 'api_errors_days', 7)
                cleanup_api_errors(user_id, api_errors_days, db)
            
            if getattr(settings, 'auto_cleanup_charts', True):
                charts_days = getattr(settings, 'charts_days', 14)
                cleanup_charts(user_id, charts_days, db)
            
            if getattr(settings, 'auto_cleanup_strategy_cache', True):
                strategy_cache_days = getattr(settings, 'strategy_cache_days', 7)
                cleanup_strategy_cache(user_id, strategy_cache_days, db)
            
            settings.last_cleanup = utcnow()
            db.commit()
            
            log(f"[AUTO-CLEANUP] Completed for user {user_id}")
    except Exception as e:
        log(f"[AUTO-CLEANUP] Error for user {user_id}: {e}")
        db.rollback()


def get_disk_usage() -> dict:
    """Получить информацию о диске"""
    try:
        usage = shutil.disk_usage(os.getcwd())
        return {
            'total': usage.total,
            'used': usage.used,
            'free': usage.free,
            'percent': (usage.used / usage.total) * 100
        }
    except Exception as e:
        log(f"Error getting disk usage: {e}")
        return {
            'total': 0,
            'used': 0,
            'free': 0,
            'percent': 0
        }


def full_cleanup(user_id: int, db: Session) -> dict:
    """Полная очистка временных данных (БЕЗОПАСНАЯ)
    
    Удаляет:
    - SQL логи
    - История команд
    - API ошибки
    - Графики
    - Кэш стратегий
    
    НЕ ТРОГАЕТ (защищённые данные):
    - Аккаунты пользователей (User)
    - Добавленные серверы (MoonBotServer)
    - Ордера (MoonBotOrder)
    - Настройки пользователя
    - Группы серверов
    """
    try:
        logs_result = cleanup_old_logs(user_id, 0, db)
        history_result = cleanup_command_history(user_id, 0, db)
        api_errors_result = cleanup_api_errors(user_id, 0, db)
        charts_result = cleanup_charts(user_id, 0, db)
        strategy_cache_result = cleanup_strategy_cache(user_id, 0, db)
        
        vacuum_database(db)
        
        return {
            'status': 'success',
            'logs_deleted': logs_result.get('deleted_count', 0),
            'history_deleted': history_result.get('deleted_count', 0),
            'api_errors_deleted': api_errors_result.get('deleted_count', 0),
            'charts_deleted': charts_result.get('deleted_count', 0),
            'strategy_cache_deleted': strategy_cache_result.get('deleted_count', 0)
        }
    except Exception as e:
        log(f"Error in full cleanup: {e}")
        return {
            'status': 'error',
            'logs_deleted': 0,
            'history_deleted': 0,
            'api_errors_deleted': 0,
            'charts_deleted': 0,
            'strategy_cache_deleted': 0,
            'message': str(e)
        }
