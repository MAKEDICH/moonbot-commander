from sqlalchemy.orm import Session
from sqlalchemy import text, func
from datetime import datetime, timedelta
import os
import shutil
import models


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
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))  # 3 уровня выше
        
        db_files = {
            'moonbot_db': os.path.join(backend_dir, 'backend', 'moonbot.db'),
            'commander_db': os.path.join(backend_dir, 'backend', 'moonbot_commander.db'),
        }
        
        file_sizes = {}
        for key, filepath in db_files.items():
            if os.path.exists(filepath):
                file_sizes[key] = os.path.getsize(filepath)
            else:
                file_sizes[key] = 0
        
        # Размер логов
        log_files = {
            'commander_log': os.path.join(backend_dir, 'backend', 'moonbot_commander.log'),
            'crash_log': os.path.join(backend_dir, 'backend', 'backend_crash.log')
        }
        total_log_size = 0
        for log_file in log_files.values():
            if os.path.exists(log_file):
                total_log_size += os.path.getsize(log_file)
        
        file_sizes['logs'] = total_log_size
        
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
        print(f"Error getting database stats: {e}")
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
        print(f"Error cleaning up logs: {e}")
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
        print(f"Error cleaning up command history: {e}")
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
        print(f"Error vacuuming database: {e}")
        return {
            'status': 'error',
            'freed_space': '0 B',
            'message': str(e)
        }


def cleanup_backend_logs(max_size_mb: int = 0) -> dict:
    """Очистить файлы логов backend
    
    Args:
        max_size_mb: Максимальный размер лог-файла в МБ. Если 0 - удалить полностью
    
    Returns:
        dict: {'deleted_count': int, 'freed_bytes': int, 'status': str}
    """
    try:
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        
        log_files = [
            os.path.join(backend_dir, 'backend', 'moonbot_commander.log'),
            os.path.join(backend_dir, 'backend', 'backend_crash.log'),
            os.path.join(backend_dir, 'backend', 'udp_listener.log'),
        ]
        
        deleted_count = 0
        freed_bytes = 0
        
        for log_file in log_files:
            if not os.path.exists(log_file):
                continue
                
            file_size = os.path.getsize(log_file)
            
            if max_size_mb == 0:
                # Удалить файл полностью
                try:
                    os.remove(log_file)
                    deleted_count += 1
                    freed_bytes += file_size
                except Exception as e:
                    print(f"Error deleting {log_file}: {e}")
            else:
                # Обрезать файл если он больше max_size_mb
                max_bytes = max_size_mb * 1024 * 1024
                if file_size > max_bytes:
                    try:
                        # Читаем последние N байт файла
                        with open(log_file, 'rb') as f:
                            f.seek(-max_bytes, os.SEEK_END)
                            data = f.read()
                        
                        # Перезаписываем файл
                        with open(log_file, 'wb') as f:
                            f.write(data)
                        
                        deleted_count += 1
                        freed_bytes += (file_size - max_bytes)
                    except Exception as e:
                        print(f"Error truncating {log_file}: {e}")
        
        return {
            'deleted_count': deleted_count,
            'freed_bytes': freed_bytes,
            'status': 'success'
        }
    except Exception as e:
        print(f"Error cleaning up backend logs: {e}")
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
            print(f"[AUTO-CLEANUP] Running for user {user_id}")
            
            if settings.auto_cleanup_sql_logs:
                cleanup_old_logs(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_command_history:
                cleanup_command_history(user_id, settings.days_to_keep, db)
            
            if settings.auto_cleanup_backend_logs:
                cleanup_backend_logs(settings.backend_logs_max_size_mb)
            
            # Обновить время последней очистки
            settings.last_cleanup = datetime.utcnow()
            db.commit()
            
            print(f"[AUTO-CLEANUP] Completed for user {user_id}")
    except Exception as e:
        print(f"[AUTO-CLEANUP] Error for user {user_id}: {e}")
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
        print(f"Error getting disk usage: {e}")
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
        print(f"Error in full cleanup: {e}")
        return {
            'status': 'error',
            'logs_deleted': 0,
            'history_deleted': 0,
            'message': str(e)
        }

