"""
Обработка балансов для UDP Listener

Парсинг и сохранение данных о балансах от MoonBot.
Оптимизировано для 3000+ серверов с использованием Batch Processor.
"""
import re
from typing import Tuple, Optional

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from utils.config_loader import get_config_value
from .processors_utils import clean_currency_value
from .batch_processor import get_batch_processor
from .listener_status import update_server_online_status


# Счётчик для уменьшения логирования (глобальный для всех серверов)
_balance_counter = 0
_log_every_n = 500  # Логировать каждое N-е обновление баланса


class BalanceProcessor:
    """
    Процессор обновлений баланса
    
    Оптимизирован для высоких нагрузок:
    - Использует Batch Processor для группировки записей в БД
    - Минимизирует количество DB commits
    - Минимизирует логирование
    """
    
    def __init__(self, server_id: int):
        self.server_id = server_id
        # Флаг использования batch processing
        self._use_batch = get_config_value(
            'high_load', 'udp.batch.enabled', default=True
        )
    
    def process_balance_update(self, packet: dict):
        """
        Обработка обновления баланса
        
        Args:
            packet: Пакет с данными баланса
        """
        bot_name = packet.get("bot", "")
        available = 0.0
        total = 0.0
        is_running = None
        version = None
        
        # Логируем только каждое N-е обновление для снижения нагрузки
        global _balance_counter
        _balance_counter += 1
        
        if "data" in packet:
            data_value = packet.get("data")
            
            if isinstance(data_value, str):
                available, total = self._parse_balance_string(data_value)
            elif isinstance(data_value, dict):
                available, total, is_running, version = self._parse_balance_dict(data_value)
        else:
            available, total, is_running, version = self._parse_balance_top_level(packet)
        
        self._save_balance_to_db(available, total, bot_name, is_running, version)
        
        # Обновляем статус сервера как online при получении баланса
        update_server_online_status(self.server_id)
    
    def _parse_balance_string(self, data_value: str) -> Tuple[float, float]:
        """
        Парсинг баланса из строки (старый формат 1)
        
        Args:
            data_value: Строка с балансом в формате "A:123.45 T:678.90"
        
        Returns:
            Кортеж (available, total)
        """
        a_match = re.search(r'A:([\d.]+)', data_value)
        t_match = re.search(r'T:([\d.]+)', data_value)
        
        available = float(a_match.group(1)) if a_match else 0.0
        total = float(t_match.group(1)) if t_match else 0.0
        
        return available, total
    
    def _parse_balance_dict(self, data_value: dict) -> Tuple[float, float, Optional[bool], Optional[int]]:
        """
        Парсинг баланса из объекта (новый формат)
        
        Args:
            data_value: Словарь с данными баланса
        
        Returns:
            Кортеж (available, total, is_running, version)
        """
        a_value = data_value.get("A", 0.0)
        t_value = data_value.get("T", 0.0)
        
        available = clean_currency_value(a_value, self.server_id)
        total = clean_currency_value(t_value, self.server_id)
        
        is_running = data_value.get("S", None)
        version = data_value.get("V", None)
        
        if version is not None:
            try:
                version = int(version)
            except (ValueError, TypeError):
                version = None
        
        return available, total, is_running, version
    
    def _parse_balance_top_level(self, packet: dict) -> Tuple[float, float, Optional[bool], Optional[int]]:
        """
        Парсинг баланса из верхнего уровня (старый формат 2)
        
        Args:
            packet: Пакет с данными баланса на верхнем уровне
        
        Returns:
            Кортеж (available, total, is_running, version)
        """
        a_value = packet.get("A", 0.0)
        t_value = packet.get("T", 0.0)
        
        available = clean_currency_value(a_value, self.server_id)
        total = clean_currency_value(t_value, self.server_id)
        
        is_running = packet.get("S", None)
        version = packet.get("V", None)
        
        if version is not None:
            try:
                version = int(version)
            except (ValueError, TypeError):
                version = None
        
        return available, total, is_running, version
    
    def _save_balance_to_db(
        self,
        available: float,
        total: float,
        bot_name: str,
        is_running: Optional[bool],
        version: Optional[int]
    ):
        """
        Сохранение баланса в БД
        
        Args:
            available: Доступный баланс
            total: Общий баланс
            bot_name: Имя бота
            is_running: Флаг работы бота
            version: Версия MoonBot
        """
        # Используем Batch Processor для высоких нагрузок
        if self._use_batch:
            try:
                batch_processor = get_batch_processor()
                batch_processor.add_balance(
                    server_id=self.server_id,
                    available=available,
                    total=total,
                    bot_name=bot_name,
                    is_running=is_running,
                    version=version
                )
                # Логируем только каждое N-е обновление глобально
                if _balance_counter % _log_every_n == 0:
                    log(f"[BALANCE-BATCH] Processed {_balance_counter} balances, "
                        f"last: server={self.server_id}, {available:.2f}/{total:.2f}")
                return
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Batch processor error, falling back: {e}")
        
        # Fallback: прямая запись в БД
        self._save_balance_to_db_direct(available, total, bot_name, is_running, version)
    
    def _save_balance_to_db_direct(
        self,
        available: float,
        total: float,
        bot_name: str,
        is_running: Optional[bool],
        version: Optional[int]
    ):
        """
        Прямое сохранение баланса в БД (fallback)
        
        Args:
            available: Доступный баланс
            total: Общий баланс
            bot_name: Имя бота
            is_running: Флаг работы бота
            version: Версия MoonBot
        """
        db = SessionLocal()
        try:
            balance = db.query(models.ServerBalance).filter(
                models.ServerBalance.server_id == self.server_id
            ).first()
            
            if not balance:
                balance = models.ServerBalance(server_id=self.server_id)
                db.add(balance)
            
            balance.available = available
            balance.total = total
            balance.bot_name = bot_name
            
            if hasattr(balance, 'is_running'):
                balance.is_running = is_running
            if hasattr(balance, 'version'):
                balance.version = version
            
            balance.updated_at = utcnow()
            
            db.commit()
            
            log_msg = f"[UDP-LISTENER-{self.server_id}] 💰 Balance: Available={available:.2f}, Total={total:.2f}"
            if is_running is not None:
                log_msg += f", Running={is_running}"
            if version is not None:
                log_msg += f", Version={version}"
            log(log_msg)
            
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Balance update error: {e}")
            db.rollback()
        finally:
            db.close()

