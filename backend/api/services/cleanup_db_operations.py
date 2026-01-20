"""
Операции очистки данных в БД.

Содержит функции для удаления старых записей из различных таблиц:
- SQL логи
- История команд
- API ошибки
- Графики
- Кэш стратегий
"""

from sqlalchemy.orm import Session
from datetime import timedelta

from models import models
from utils.logging import log
from utils.datetime_utils import utcnow


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
            cutoff_date = utcnow() - timedelta(days=days)
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
            cutoff_date = utcnow() - timedelta(days=days)
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


def cleanup_api_errors(user_id: int, days: int, db: Session) -> dict:
    """Удалить старые ошибки API.
    
    ВАЖНО для 3000+ серверов - ошибки накапливаются быстро!
    
    Args:
        user_id: ID пользователя
        days: Количество дней для хранения. Если 0 - удалить всё
    
    Returns:
        dict: {'deleted_count': int, 'status': str}
    """
    try:
        # Получаем серверы пользователя
        user_servers = db.query(models.Server.id).filter(
            models.Server.user_id == user_id
        ).all()
        server_ids = [s.id for s in user_servers]
        
        if not server_ids:
            return {'deleted_count': 0, 'status': 'success'}
        
        if days == 0:
            # Удалить ВСЕ ошибки
            deleted = db.query(models.MoonBotAPIError).filter(
                models.MoonBotAPIError.server_id.in_(server_ids)
            ).delete(synchronize_session=False)
        else:
            # Удалить ошибки старше указанного количества дней
            cutoff_date = utcnow() - timedelta(days=days)
            deleted = db.query(models.MoonBotAPIError).filter(
                models.MoonBotAPIError.server_id.in_(server_ids),
                models.MoonBotAPIError.received_at < cutoff_date
            ).delete(synchronize_session=False)
        
        db.commit()
        log(f"[CLEANUP] Deleted {deleted} API errors for user {user_id}")
        return {'deleted_count': deleted, 'status': 'success'}
    except Exception as e:
        db.rollback()
        log(f"Error cleaning up API errors: {e}")
        return {'deleted_count': 0, 'status': 'error', 'message': str(e)}


def cleanup_charts(user_id: int, days: int, db: Session) -> dict:
    """Удалить старые графики.
    
    ВАЖНО для 3000+ серверов - графики занимают много места!
    
    Args:
        user_id: ID пользователя
        days: Количество дней для хранения. Если 0 - удалить всё
    
    Returns:
        dict: {'deleted_count': int, 'status': str}
    """
    try:
        # Получаем серверы пользователя
        user_servers = db.query(models.Server.id).filter(
            models.Server.user_id == user_id
        ).all()
        server_ids = [s.id for s in user_servers]
        
        if not server_ids:
            return {'deleted_count': 0, 'status': 'success'}
        
        if days == 0:
            # Удалить ВСЕ графики
            deleted = db.query(models.MoonBotChart).filter(
                models.MoonBotChart.server_id.in_(server_ids)
            ).delete(synchronize_session=False)
        else:
            # Удалить графики старше указанного количества дней
            cutoff_date = utcnow() - timedelta(days=days)
            deleted = db.query(models.MoonBotChart).filter(
                models.MoonBotChart.server_id.in_(server_ids),
                models.MoonBotChart.received_at < cutoff_date
            ).delete(synchronize_session=False)
        
        db.commit()
        log(f"[CLEANUP] Deleted {deleted} charts for user {user_id}")
        return {'deleted_count': deleted, 'status': 'success'}
    except Exception as e:
        db.rollback()
        log(f"Error cleaning up charts: {e}")
        return {'deleted_count': 0, 'status': 'error', 'message': str(e)}


def cleanup_strategy_cache(user_id: int, days: int, db: Session) -> dict:
    """Удалить старые записи кэша стратегий.
    
    Args:
        user_id: ID пользователя
        days: Количество дней для хранения. Если 0 - удалить всё
    
    Returns:
        dict: {'deleted_count': int, 'status': str}
    """
    try:
        # Получаем серверы пользователя
        user_servers = db.query(models.Server.id).filter(
            models.Server.user_id == user_id
        ).all()
        server_ids = [s.id for s in user_servers]
        
        if not server_ids:
            return {'deleted_count': 0, 'status': 'success'}
        
        if days == 0:
            # Удалить ВСЕ записи кэша
            deleted = db.query(models.StrategyCache).filter(
                models.StrategyCache.server_id.in_(server_ids)
            ).delete(synchronize_session=False)
        else:
            # Удалить записи старше указанного количества дней
            cutoff_date = utcnow() - timedelta(days=days)
            deleted = db.query(models.StrategyCache).filter(
                models.StrategyCache.server_id.in_(server_ids),
                models.StrategyCache.received_at < cutoff_date
            ).delete(synchronize_session=False)
        
        db.commit()
        log(f"[CLEANUP] Deleted {deleted} strategy cache entries for user {user_id}")
        return {'deleted_count': deleted, 'status': 'success'}
    except Exception as e:
        db.rollback()
        log(f"Error cleaning up strategy cache: {e}")
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


