"""
Обработка ошибок API для UDP Listener

Парсинг и сохранение ошибок API от MoonBot.

Оптимизировано для 3000+ серверов:
- Batch processing для ошибок
- Кэширование user_id
- Уменьшенное логирование
"""
import re
from datetime import datetime
from typing import Optional

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from .processors_orders import get_cached_user_id
from .batch_processor import get_batch_processor
from utils.config_loader import get_config_value


class ErrorProcessor:
    """
    Процессор ошибок API от MoonBot
    
    Оптимизирован для 3000+ серверов
    """
    
    # Счётчик для уменьшения логирования
    _error_counter = 0
    _log_every_n = 50
    
    def __init__(self, server_id: int):
        self.server_id = server_id
        self._use_batch = get_config_value(
            'high_load', 'udp.batch.enabled', default=True
        )
    
    def process_api_errors(self, packet: dict):
        """
        Обработка ошибок API от MoonBot
        
        Формат: {"cmd":"errors","bot":"BotName","data":{"E":[
            "04.12 00:12:56.268: TON [400] CheckMarginRatio fail! ...",
            ...
        ]}}
        
        Args:
            packet: Пакет с данными ошибок
        """
        bot_name = packet.get("bot", "")
        data = packet.get("data", {})
        
        if not isinstance(data, dict):
            return
        
        errors = data.get("E", [])
        if not errors:
            return
        
        # Используем batch processing если включено
        if self._use_batch:
            try:
                batch_processor = get_batch_processor()
                for error_text in errors:
                    error_time, symbol, error_code = self._parse_error_text(error_text)
                    batch_processor.add_api_error(
                        server_id=self.server_id,
                        bot_name=bot_name,
                        error_text=error_text,
                        error_time=error_time,
                        symbol=symbol,
                        error_code=error_code
                    )
                
                # Отправляем WebSocket уведомление (используем кэш user_id)
                user_id = get_cached_user_id(self.server_id)
                if user_id:
                    self._send_error_notification(user_id, bot_name, len(errors))
                
                # Уменьшенное логирование
                ErrorProcessor._error_counter += len(errors)
                if ErrorProcessor._error_counter % ErrorProcessor._log_every_n == 0:
                    log(f"[UDP-LISTENER-{self.server_id}] ⚠️ API errors processed: {ErrorProcessor._error_counter}")
                
                return
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Batch error, falling back: {e}")
        
        # Fallback: прямая запись в БД
        self._process_errors_direct(errors, bot_name)
    
    def _process_errors_direct(self, errors: list, bot_name: str):
        """
        Прямая обработка ошибок (fallback)
        
        Args:
            errors: Список ошибок
            bot_name: Имя бота
        """
        db = SessionLocal()
        try:
            now = utcnow()
            for error_text in errors:
                error_time, symbol, error_code = self._parse_error_text(error_text)
                
                api_error = models.MoonBotAPIError(
                    server_id=self.server_id,
                    bot_name=bot_name,
                    error_text=error_text,
                    error_time=error_time,
                    symbol=symbol,
                    error_code=error_code,
                    received_at=now
                )
                db.add(api_error)
            
            db.commit()
            
            # Используем кэш user_id
            user_id = get_cached_user_id(self.server_id)
            if user_id:
                self._send_error_notification(user_id, bot_name, len(errors))
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Error saving API errors: {e}", level="ERROR")
            db.rollback()
        finally:
            db.close()
    
    def _parse_error_text(self, error_text: str) -> tuple:
        """
        Парсинг текста ошибки для извлечения данных
        
        Формат: "04.12 00:12:56.268: TON [400] CheckMarginRatio fail! ..."
        
        Args:
            error_text: Текст ошибки
        
        Returns:
            Кортеж (error_time, symbol, error_code)
        """
        error_time = None
        symbol = None
        error_code = None
        
        # Извлекаем время
        time_match = re.match(r'(\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2}\.\d+):', error_text)
        if time_match:
            try:
                time_str = time_match.group(1)
                # Добавляем текущий год
                current_year = datetime.now().year
                error_time = datetime.strptime(f"{current_year}.{time_str}", "%Y.%d.%m %H:%M:%S.%f")
            except ValueError:
                pass
        
        # Извлекаем символ (первое слово после времени)
        symbol_match = re.search(r':\s*([A-Z]{2,10})\s+\[', error_text)
        if symbol_match:
            symbol = symbol_match.group(1)
        
        # Извлекаем код ошибки
        code_match = re.search(r'\[(\d{3})\]', error_text)
        if code_match:
            error_code = int(code_match.group(1))
        
        return error_time, symbol, error_code
    
    def _send_error_notification(self, user_id: int, bot_name: str, count: int):
        """
        Отправка WebSocket уведомления об ошибках API
        
        Args:
            user_id: ID пользователя
            bot_name: Имя бота
            count: Количество ошибок
        """
        try:
            from services.websocket_manager import notify_api_error_sync
            notify_api_error_sync(user_id, self.server_id, bot_name, count)
        except Exception:
            pass  # Не блокируем обработку при ошибке WS

