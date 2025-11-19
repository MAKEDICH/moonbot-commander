from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timedelta
import os
import shutil
import models
from logger_utils import log


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
        # Используем абсолютный путь для корректного определения директории
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))  # 3 уровня выше от api/services/cleanup_service.py
        
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
        
        # 🎯 НОВАЯ ЛОГИКА: Размер РОТИРОВАННЫХ логов (.log.1, .log.2, etc.)
        # Активные .log файлы НЕ считаем (они заняты приложением)
        
        import glob
        
        # Паттерны для поиска РОТИРОВАННЫХ файлов
        log_patterns = [
            'moonbot_commander.log.*',
            'backend_crash.log.*',
            'udp_listener.log.*'
        ]
        
        total_rotated_logs_size = 0
        
        for pattern in log_patterns:
            pattern_path = os.path.join(backend_dir, pattern)
            for log_file in glob.glob(pattern_path):
                if os.path.exists(log_file):
                    total_rotated_logs_size += os.path.getsize(log_file)
        
        # Добавляем общий размер РОТИРОВАННЫХ логов
        file_sizes['logs'] = total_rotated_logs_size
        
        # Проверяем наличие других файлов в backend директории
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


def cleanup_old_logs(user_id: int, days: int, db: Session) -> dict:
    """Удалить старые SQL логи
    
    Args:
        user_id: ID пользователя (не используется, логи общие)
        days: Количество дней для хранения. Если 0 - удалить всё
    
    Returns:
        dict: {'deleted_count': int, 'status': str}
    """
    try:
        if days == 0:
            # Удалить ВСЕ логи
            deleted = db.query(models.SQLCommandLog).delete(synchronize_session=False)
        else:
            # Удалить логи старше указанного количества дней
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted = db.query(models.SQLCommandLog).filter(
                models.SQLCommandLog.received_at < cutoff_date
            ).delete(synchronize_session=False)
        
        db.commit()
        return {'deleted_count': deleted, 'status': 'success'}
    except Exception as e:
        db.rollback()
        log(f"Error cleaning up logs: {e}")
        import traceback
        traceback.print_exc()
        return {'deleted_count': 0, 'status': 'error', 'message': str(e)}


def cleanup_command_history(user_id: int, days: int, db: Session) -> dict:
    """Удалить старую историю команд
    
    Args:
        user_id: ID пользователя
        days: Количество дней для хранения. Если 0 - удалить всю историю пользователя
    
    Returns:
        dict: {'deleted_count': int, 'status': str}
    """
    try:
        if days == 0:
            # Удалить ВСЮ историю команд пользователя
            deleted = db.query(models.CommandHistory).filter(
                models.CommandHistory.user_id == user_id
            ).delete(synchronize_session=False)
        else:
            # Удалить историю старше указанного количества дней
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            deleted = db.query(models.CommandHistory).filter(
                models.CommandHistory.user_id == user_id,
                models.CommandHistory.execution_time < cutoff_date
            ).delete(synchronize_session=False)
        
        db.commit()
        return {'deleted_count': deleted, 'status': 'success'}
    except Exception as e:
        db.rollback()
        log(f"Error cleaning up command history: {e}")
        import traceback
        traceback.print_exc()
        return {'deleted_count': 0, 'status': 'error', 'message': str(e)}


def vacuum_database(db: Session) -> dict:
    """Оптимизировать БД (VACUUM для SQLite)"""
    try:
        # Закрываем текущую транзакцию
        db.commit()
        
        # Выполняем VACUUM (работает только вне транзакции в SQLite)
        connection = db.connection().connection
        connection.execute("VACUUM")
        
        return {
            'status': 'success',
            'freed_space': 'База данных оптимизирована'
        }
    except Exception as e:
        log(f"Error vacuuming database: {e}")
        return {
            'status': 'error',
            'freed_space': '0 B',
            'message': str(e)
        }


def cleanup_backend_logs(max_size_mb: int = 0) -> dict:
    """Очистить РОТИРОВАННЫЕ файлы логов backend
    
    🎯 НОВАЯ ЛОГИКА:
    - Чистим ТОЛЬКО старые ротированные файлы (.log.1, .log.2, .log.3, etc.)
    - НЕ трогаем активные .log файлы (они заняты приложением)
    - Если max_size_mb = 0 → удаляем ВСЕ ротированные файлы
    - Если max_size_mb > 0 → удаляем старые файлы, пока общий размер не станет <= max_size_mb
    
    Args:
        max_size_mb: Максимальный размер РОТИРОВАННЫХ логов в МБ. Если 0 - удалить все ротированные
    
    Returns:
        dict: {'deleted_count': int, 'freed_bytes': int, 'status': str}
    """
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        
        # Паттерны для поиска РОТИРОВАННЫХ файлов
        log_patterns = [
            'moonbot_commander.log.*',
            'backend_crash.log.*',
            'udp_listener.log.*'
        ]
        
        deleted_count = 0
        freed_bytes = 0
        
        import glob
        
        # Собираем все ротированные файлы
        rotated_files = []
        for pattern in log_patterns:
            pattern_path = os.path.join(backend_dir, pattern)
            for log_file in glob.glob(pattern_path):
                if os.path.exists(log_file):
                    file_size = os.path.getsize(log_file)
                    # Получаем номер ротации (log.1, log.2, etc.)
                    # Чем больше номер, тем старше файл
                    import re
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
        # Самые старые файлы имеют больший номер
        rotated_files.sort(key=lambda x: x['rotation'], reverse=True)
        
        if max_size_mb == 0:
            # Удалить ВСЕ ротированные файлы
            for file_info in rotated_files:
                try:
                    os.remove(file_info['path'])
                    deleted_count += 1
                    freed_bytes += file_info['size']
                    log(f"[CLEANUP] Deleted rotated log: {os.path.basename(file_info['path'])} ({file_info['size'] / 1024 / 1024:.2f} MB)")
                except Exception as e:
                    log(f"[CLEANUP] Error deleting {file_info['path']}: {e}", level="ERROR")
        else:
            # Удалять старые файлы, пока общий размер не станет <= max_size_mb
            max_bytes = max_size_mb * 1024 * 1024
            
            # Сначала считаем текущий размер
            current_size = sum(f['size'] for f in rotated_files)
            
            if current_size <= max_bytes:
                # Уже в пределах лимита
                return {
                    'deleted_count': 0,
                    'freed_bytes': 0,
                    'status': 'success',
                    'message': f'Размер ротированных логов ({current_size / 1024 / 1024:.2f} MB) уже в пределах {max_size_mb} MB'
                }
            
            # Удаляем самые старые файлы, пока не достигнем цели
            for file_info in rotated_files:
                if current_size <= max_bytes:
                    break
                
                try:
                    os.remove(file_info['path'])
                    deleted_count += 1
                    freed_bytes += file_info['size']
                    current_size -= file_info['size']
                    log(f"[CLEANUP] Deleted old rotated log: {os.path.basename(file_info['path'])} ({file_info['size'] / 1024 / 1024:.2f} MB)")
                except Exception as e:
                    log(f"[CLEANUP] Error deleting {file_info['path']}: {e}", level="ERROR")
        
        log(f"[CLEANUP] Backend logs cleanup complete: {deleted_count} files deleted, {freed_bytes / 1024 / 1024:.2f} MB freed")
        
        return {
            'deleted_count': deleted_count,
            'freed_bytes': freed_bytes,
            'status': 'success'
        }
    except Exception as e:
        log(f"[CLEANUP] Error cleaning up backend logs: {e}", level="ERROR")
        import traceback
        traceback.print_exc()
        return {
            'deleted_count': 0,
            'freed_bytes': 0,
            'status': 'error',
            'message': str(e)
        }


def auto_cleanup_check(user_id: int, db: Session) -> None:
    """Проверить необходимость автоочистки (запускается по расписанию)"""
    try:
        # Получить настройки пользователя
        settings = db.query(models.CleanupSettings).filter(
            models.CleanupSettings.user_id == user_id
        ).first()
        
        if not settings or not settings.enabled:
            return
        
        should_cleanup = False
        
        # Проверка по времени
        if settings.trigger_type in ['time', 'combined']:
            if settings.last_cleanup:
                days_since_cleanup = (datetime.utcnow() - settings.last_cleanup).days
                if days_since_cleanup >= settings.days_to_keep:
                    should_cleanup = True
            else:
                should_cleanup = True
        
        # Проверка по диску
        if settings.trigger_type in ['disk', 'combined']:
            disk_info = get_disk_usage()
            if disk_info['percent'] >= settings.disk_threshold_percent:
                should_cleanup = True
        
        # Выполнить очистку только того, что включено
        if should_cleanup:
            log(f"[AUTO-CLEANUP] Running for user {user_id}")
            
            if settings.auto_cleanup_sql_logs:
                cleanup_old_logs(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_command_history:
                cleanup_command_history(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_backend_logs:
                cleanup_backend_logs(settings.backend_logs_max_size_mb)
            
            # Обновить время последней очистки
            settings.last_cleanup = datetime.utcnow()
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
    
    НЕ ТРОГАЕТ (защищённые данные):
    - Аккаунты пользователей (User)
    - Добавленные серверы (MoonBotServer)
    - Ордера (MoonBotOrder)
    - Настройки пользователя
    - Группы серверов
    """
    try:
        # Очистить SQL логи
        logs_result = cleanup_old_logs(user_id, 0, db)
        
        # Очистить историю команд
        history_result = cleanup_command_history(user_id, 0, db)
        
        # Оптимизировать БД
        vacuum_database(db)
        
        return {
            'status': 'success',
            'logs_deleted': logs_result.get('deleted_count', 0),
            'history_deleted': history_result.get('deleted_count', 0)
        }
    except Exception as e:
        log(f"Error in full cleanup: {e}")
        return {
            'status': 'error',
            'logs_deleted': 0,
            'history_deleted': 0,
            'message': str(e)
        }

