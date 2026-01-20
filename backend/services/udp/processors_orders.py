"""
Обработка ордеров для UDP Listener

Парсинг и сохранение данных об ордерах от MoonBot.

Оптимизировано для 3000+ серверов:
- Кэширование user_id для серверов (единый глобальный кэш)
- Batch processing для SQL логов
- Асинхронные WebSocket уведомления
- Уменьшенное логирование
"""
import re
from typing import Optional

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow, format_iso
from utils.config_loader import get_config_value
from services.user_id_cache import get_user_id_for_server, set_user_id_for_server


def get_cached_user_id(server_id: int) -> Optional[int]:
    """
    Получить user_id из глобального кэша или БД.
    
    Использует единый глобальный кэш из services/user_id_cache.py
    
    Args:
        server_id: ID сервера
        
    Returns:
        user_id или None
    """
    # Сначала проверяем глобальный кэш
    user_id = get_user_id_for_server(server_id)
    if user_id is not None:
        return user_id
    
    # Не в кэше - загружаем из БД и кэшируем
    db = SessionLocal()
    try:
        server = db.query(models.Server.user_id).filter(
            models.Server.id == server_id
        ).first()
        user_id = server.user_id if server else None
        
        if user_id is not None:
            set_user_id_for_server(server_id, user_id)
        
        return user_id
    finally:
        db.close()


class OrderProcessor:
    """
    Процессор обновлений ордеров
    
    Оптимизирован для 3000+ серверов:
    - Кэширование user_id
    - Batch processing для SQL логов
    - Асинхронные WebSocket уведомления
    """
    
    # Счётчик для уменьшения логирования
    _log_counter = 0
    _log_every_n = 100  # Логировать каждый N-й ордер
    
    def __init__(self, server_id: int):
        self.server_id = server_id
        self._use_batch = get_config_value(
            'high_load', 'udp.batch.enabled', default=True
        )
    
    def process_order_update(self, packet: dict):
        """
        Обработка обновления ордера
        
        Args:
            packet: Пакет с данными ордера
        """
        oid = packet.get("oid")
        sql = packet.get("sql", "")
        bot_name = packet.get("bot", "")
        
        # Уменьшенное логирование для высокой нагрузки
        OrderProcessor._log_counter += 1
        if OrderProcessor._log_counter % OrderProcessor._log_every_n == 0:
            log(f"[UDP-LISTENER-{self.server_id}] 📦 Order updates processed: {OrderProcessor._log_counter}")
        
        if sql:
            self.process_sql_command(sql, moonbot_order_id=oid, bot_name=bot_name)
    
    def process_sql_command(self, sql_text: str, moonbot_order_id: int = None, bot_name: str = None):
        """
        Парсинг и сохранение SQL команды в БД
        
        Args:
            sql_text: Текст SQL команды
            moonbot_order_id: ID ордера от MoonBot
            bot_name: Имя бота
        """
        from .parsers import SQLParser
        from .batch_processor import get_batch_processor
        
        try:
            match = re.search(r'\[SQLCommand (\d+)\]', sql_text)
            if match:
                command_id = int(match.group(1))
                sql_body = sql_text[match.end():].strip()
            else:
                command_id = moonbot_order_id if moonbot_order_id else 0
                sql_body = sql_text.strip()
            
            # Получаем user_id из кэша (не из БД каждый раз!)
            user_id = get_cached_user_id(self.server_id)
            
            # Используем batch processing для SQL логов если включено
            if self._use_batch:
                try:
                    batch_processor = get_batch_processor()
                    batch_processor.add_sql_log(
                        server_id=self.server_id,
                        command_id=command_id,
                        sql_text=sql_body
                    )
                    
                    # Для ордеров всё ещё нужна синхронная обработка (парсинг SQL)
                    if "Orders" in sql_body:
                        self._process_order_sql(sql_body, command_id, moonbot_order_id, bot_name)
                    
                    # Отправляем WebSocket уведомления асинхронно
                    if user_id:
                        self._send_websocket_notifications_async(user_id, command_id, sql_body)
                    
                    return
                except Exception as e:
                    log(f"[UDP-LISTENER-{self.server_id}] Batch error, falling back: {e}")
            
            # Fallback: прямая запись в БД
            self._process_sql_direct(sql_body, command_id, moonbot_order_id, bot_name, user_id)
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Parse error: {e}", level="ERROR")
    
    def _process_order_sql(self, sql_body: str, command_id: int, moonbot_order_id: int, bot_name: str):
        """
        Обработка SQL для ордеров (парсинг и сохранение)
        
        Args:
            sql_body: Тело SQL
            command_id: ID команды
            moonbot_order_id: ID ордера от MoonBot
            bot_name: Имя бота
        """
        from .parsers import SQLParser
        
        db = SessionLocal()
        try:
            parser = SQLParser(self.server_id)
            parser.parse_and_save_order(db, sql_body, command_id, moonbot_order_id, bot_name=bot_name)
            db.commit()
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Order parse error: {e}", level="ERROR")
            db.rollback()
        finally:
            db.close()
    
    def _process_sql_direct(self, sql_body: str, command_id: int, moonbot_order_id: int, 
                           bot_name: str, user_id: Optional[int]):
        """
        Прямая обработка SQL (fallback)
        
        Args:
            sql_body: Тело SQL
            command_id: ID команды
            moonbot_order_id: ID ордера от MoonBot
            bot_name: Имя бота
            user_id: ID пользователя
        """
        from .parsers import SQLParser
        
        db = SessionLocal()
        try:
            sql_log = models.SQLCommandLog(
                server_id=self.server_id,
                command_id=command_id,
                sql_text=sql_body,
                received_at=utcnow(),
                processed=False
            )
            db.add(sql_log)
            
            if "Orders" in sql_body:
                parser = SQLParser(self.server_id)
                parser.parse_and_save_order(db, sql_body, command_id, moonbot_order_id, bot_name=bot_name)
            
            db.commit()
            
            if user_id:
                self._send_websocket_notifications_async(user_id, sql_log.id, sql_body)
            
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] DB Error: {e}", level="ERROR")
            db.rollback()
        finally:
            db.close()
    
    def _send_websocket_notifications_async(self, user_id: int, sql_log_id: int, sql_body: str):
        """
        Асинхронная отправка WebSocket уведомлений (не блокирует UDP поток)
        
        Args:
            user_id: ID пользователя
            sql_log_id: ID лога SQL (или command_id)
            sql_body: Тело SQL команды
        """
        from services.websocket_manager import notify_sql_log_sync, notify_order_update_sync
        
        # Формируем данные для уведомления
        log_data = {
            "id": sql_log_id,
            "server_id": self.server_id,
            "command_id": sql_log_id,
            "sql_text": sql_body[:500] if sql_body else "",
            "received_at": format_iso(utcnow()),
            "processed": False
        }
        
        # Отправляем уведомления (они уже thread-safe)
        try:
            notify_sql_log_sync(user_id, self.server_id, log_data)
            
            if "Orders" in sql_body:
                notify_order_update_sync(user_id, self.server_id)
        except Exception as e:
            # Не блокируем обработку при ошибке WS
            pass
