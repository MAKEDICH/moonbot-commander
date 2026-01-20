"""
Обработка дат для SQL парсера
"""
from datetime import datetime, timezone
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow


class SQLParserDatesMixin:
    """Методы для обработки дат в SQL командах"""
    
    def _count_close_indicators(self, order: models.MoonBotOrder) -> tuple:
        """
        Подсчёт признаков закрытия ордера
        
        Returns:
            tuple: (count, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc)
        """
        # Важно: явно приводим к int (1/0) чтобы избежать любых проблем с None
        has_sell_reason = 1 if (order.sell_reason and len(str(order.sell_reason).strip()) > 0) else 0
        has_sell_price = 1 if (order.sell_price is not None and order.sell_price > 0) else 0
        has_profit_calculated = 1 if (order.profit_btc is not None) else 0
        has_gained_btc = 1 if (order.gained_btc is not None and order.gained_btc > 0) else 0
        
        close_indicators = has_sell_reason + has_sell_price + has_profit_calculated + has_gained_btc
        
        return close_indicators, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc
    
    def _process_close_date(self, order: models.MoonBotOrder, updates: dict):
        """Обработка CloseDate в UPDATE"""
        from . import utils
        
        close_date = utils.safe_int(updates['CloseDate'])
        if close_date == 0:
            # CloseDate = 0, но проверяем признаки закрытия
            close_indicators, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc = self._count_close_indicators(order)
            
            if close_indicators >= 2:
                # Есть признаки закрытия, но CloseDate = 0 - это ошибка MoonBot
                order.status = "Closed"
                if not order.closed_at:
                    order.closed_at = utcnow()
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ Order {order.moonbot_order_id} has CloseDate=0 but {close_indicators} close indicators → Marked as Closed")
            else:
                order.status = "Open"
                order.closed_at = None
                if not order.opened_at:
                    order.opened_at = utcnow()
        elif close_date > 0:
            close_indicators, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc = self._count_close_indicators(order)
            
            current_timestamp = int(utcnow().timestamp())
            is_date_in_future = close_date > current_timestamp
            
            MAX_FUTURE_WINDOW = 365 * 24 * 60 * 60
            is_within_reasonable_window = (close_date - current_timestamp) <= MAX_FUTURE_WINDOW
            
            if not is_date_in_future:
                # Классический случай: дата в прошлом - ордер закрыт
                order.status = "Closed"
                try:
                    order.closed_at = datetime.fromtimestamp(close_date, tz=timezone.utc)
                except (ValueError, OSError, OverflowError) as e:
                    log(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid CloseDate={close_date}, Error: {e}")
                    order.closed_at = utcnow()
                log(f"[UDP-LISTENER-{self.server_id}] ✅ Order {order.moonbot_order_id} marked as Closed (CloseDate in past)")
            
            elif close_indicators >= 2 and is_within_reasonable_window:
                # 🎯 ГЕНИАЛЬНЫЙ СЛУЧАЙ: Дата в будущем, НО есть признаки закрытия!
                # Это значит ордер УЖЕ закрыт (долгосрочный ордер или рассинхронизация времени)
                order.status = "Closed"
                try:
                    order.closed_at = datetime.fromtimestamp(close_date, tz=timezone.utc)
                except (ValueError, OSError, OverflowError) as e:
                    order.closed_at = utcnow()
                
                log(f"[UDP-LISTENER-{self.server_id}] ✅ Order {order.moonbot_order_id} marked as Closed")
                log(f"[UDP-LISTENER-{self.server_id}]    CloseDate={close_date} is {close_date - current_timestamp}s in future (time sync issue)")
                log(f"[UDP-LISTENER-{self.server_id}]    BUT has {close_indicators} close indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}, GainedBTC={has_gained_btc}")
                log(f"[UDP-LISTENER-{self.server_id}]    → SMART DETECTION: Order is actually closed!")
            
            else:
                log(f"[UDP-LISTENER-{self.server_id}] ⏳ CloseDate={close_date} in future for order {order.moonbot_order_id}")
                log(f"[UDP-LISTENER-{self.server_id}]    Only {close_indicators} close indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}, GainedBTC={has_gained_btc}")
                log(f"[UDP-LISTENER-{self.server_id}]    → Keeping status as Open (planned close)")
                if order.status != "Open":
                    order.status = "Open"
    
    def _process_insert_close_date(self, order: models.MoonBotOrder, close_date: int):
        """Обработка CloseDate в INSERT"""
        close_indicators, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc = self._count_close_indicators(order)
        
        current_timestamp = int(utcnow().timestamp())
        is_date_in_future = close_date > current_timestamp
        
        MAX_FUTURE_WINDOW = 365 * 24 * 60 * 60
        is_within_reasonable_window = (close_date - current_timestamp) <= MAX_FUTURE_WINDOW
        
        if not is_date_in_future:
            order.status = "Closed"
            try:
                order.closed_at = datetime.fromtimestamp(close_date, tz=timezone.utc)
            except (ValueError, OSError, OverflowError):
                order.closed_at = utcnow()
            log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Order {order.moonbot_order_id} marked as Closed (CloseDate in past)")
        
        elif close_indicators >= 2 and is_within_reasonable_window:
            order.status = "Closed"
            try:
                order.closed_at = datetime.fromtimestamp(close_date, tz=timezone.utc)
            except (ValueError, OSError, OverflowError):
                order.closed_at = utcnow()
            log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Order {order.moonbot_order_id} marked as Closed (smart detection)")
            log(f"[UDP-LISTENER-{self.server_id}]    CloseDate={close_date} is {close_date - current_timestamp}s in future, but has {close_indicators} close indicators")
        
        else:
            log(f"[UDP-LISTENER-{self.server_id}] ⏳ INSERT: Future CloseDate={close_date} for order {order.moonbot_order_id}, setting status as Open")
            order.status = "Open"
            order.closed_at = None
