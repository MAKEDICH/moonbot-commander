"""
Обработка стратегий для UDP Listener

Парсинг и сохранение данных о стратегиях и ответов lst от MoonBot.

Оптимизировано для 3000+ серверов:
- Batch processing для записи в БД
- Уменьшенное логирование
- Кэширование user_id
"""
import re

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from utils.config_loader import get_config_value
from . import utils
from .processors_orders import get_cached_user_id
from .batch_processor import get_batch_processor


class StrategyProcessor:
    """
    Процессор стратегий и ответов lst
    
    Оптимизирован для 3000+ серверов:
    - Batch processing для стратегий
    - Минимизация запросов к БД
    """
    
    # Счётчик для уменьшения логирования
    _strategy_counter = 0
    _lst_counter = 0
    _log_every_n = 200  # Увеличено для 3000 серверов
    
    def __init__(self, server_id: int):
        self.server_id = server_id
        self._use_batch = get_config_value(
            'high_load', 'udp.batch.enabled', default=True
        )
    
    def process_strategies_response(self, packet: dict):
        """
        Обработка ответа со стратегиями
        
        Args:
            packet: Пакет с данными стратегий
        """
        pack_number = packet.get("N", 1)
        data = packet.get("data", "")
        bot_name = packet.get("bot", "")
        
        # Уменьшенное логирование
        StrategyProcessor._strategy_counter += 1
        
        # Используем Batch Processor для высоких нагрузок
        if self._use_batch:
            try:
                batch_processor = get_batch_processor()
                batch_processor.add_strategy_cache(
                    server_id=self.server_id,
                    pack_number=pack_number,
                    data=data,
                    bot_name=bot_name
                )
                
                if StrategyProcessor._strategy_counter % StrategyProcessor._log_every_n == 0:
                    log(f"[STRATEGY-BATCH] Processed {StrategyProcessor._strategy_counter} strategies")
                return
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Batch error, falling back: {e}")
        
        # Fallback: прямая запись
        self._save_strategy_direct(pack_number, data, bot_name)
    
    def _save_strategy_direct(self, pack_number: int, data: str, bot_name: str):
        """
        Прямое сохранение стратегии в БД (fallback)
        
        Args:
            pack_number: Номер пакета
            data: Данные стратегии
            bot_name: Имя бота
        """
        db = SessionLocal()
        try:
            strat_cache = db.query(models.StrategyCache).filter(
                models.StrategyCache.server_id == self.server_id,
                models.StrategyCache.pack_number == pack_number
            ).first()
            
            if not strat_cache:
                strat_cache = models.StrategyCache(
                    server_id=self.server_id,
                    pack_number=pack_number
                )
                db.add(strat_cache)
            
            strat_cache.data = data
            strat_cache.bot_name = bot_name
            strat_cache.received_at = utcnow()
            
            db.commit()
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Strategies save error: {e}", level="ERROR")
            db.rollback()
        finally:
            db.close()
    
    def process_lst_response(self, message: str):
        """
        Обработка ответа на команду lst
        
        Оптимизировано: выполняется реже (только при изменениях)
        
        Args:
            message: Текст ответа lst
        """
        try:
            currency = utils.extract_currency(message, self.server_id)
            
            total_open = 0
            
            sell_match = re.search(r'Open Sell Orders:\s*(\d+)', message)
            if sell_match:
                total_open += int(sell_match.group(1))
            
            buy_match = re.search(r'Open Buy Orders:\s*(\d+)', message)
            if buy_match:
                total_open += int(buy_match.group(1))
            
            symbols_found = []
            lines = message.split('\n')
            for line in lines:
                if '$' in line and '%' in line and '(' in line:
                    parts = line.strip().split()
                    if parts:
                        symbol = parts[0].strip()
                        if 2 <= len(symbol) <= 10 and symbol.isalpha():
                            symbols_found.append(symbol.upper())
            
            # Уменьшенное логирование
            StrategyProcessor._lst_counter += 1
            
            db = SessionLocal()
            try:
                our_open_count = db.query(models.MoonBotOrder).filter(
                    models.MoonBotOrder.server_id == self.server_id,
                    models.MoonBotOrder.status == "Open"
                ).count()
                
                if symbols_found:
                    from sqlalchemy import or_
                    unknown_orders = db.query(models.MoonBotOrder).filter(
                        models.MoonBotOrder.server_id == self.server_id,
                        models.MoonBotOrder.status == "Open",
                        or_(
                            models.MoonBotOrder.symbol == "UNKNOWN",
                            models.MoonBotOrder.symbol == None,
                            models.MoonBotOrder.symbol == ""
                        )
                    ).order_by(models.MoonBotOrder.id.desc()).limit(len(symbols_found)).all()
                    
                    for i, order in enumerate(unknown_orders):
                        if i < len(symbols_found):
                            order.symbol = symbols_found[i]
                    
                    db.commit()
                
                server = db.query(models.Server).filter(
                    models.Server.id == self.server_id
                ).first()
                
                if server and server.default_currency != currency:
                    server.default_currency = currency
                    db.commit()
                
                if our_open_count > total_open:
                    excess = our_open_count - total_open
                    
                    old_orders = db.query(models.MoonBotOrder).filter(
                        models.MoonBotOrder.server_id == self.server_id,
                        models.MoonBotOrder.status == "Open"
                    ).order_by(models.MoonBotOrder.updated_at.asc()).limit(excess).all()
                    
                    now = utcnow()
                    for order in old_orders:
                        order.status = "Closed"
                        order.closed_at = now
                        order.updated_at = now
                    
                    db.commit()
                
                if StrategyProcessor._lst_counter % StrategyProcessor._log_every_n == 0:
                    log(f"[LST-BATCH] Processed {StrategyProcessor._lst_counter} lst responses")
                
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Error processing lst: {e}", level="ERROR")
                db.rollback()
            finally:
                db.close()
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Error parsing lst: {e}", level="ERROR")

