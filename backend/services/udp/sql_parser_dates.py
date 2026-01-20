"""
Обработка дат для SQL парсера

ВАЖНО: MoonBot присылает Unix timestamp.
Все сравнения выполняются с Unix timestamp напрямую.
Все datetime хранятся в локальном времени.
"""
from datetime import datetime
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow, current_timestamp, timestamp_to_datetime


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
        """
        Обработка CloseDate в UPDATE
        
        ЛОГИКА (согласно документации MoonBot):
        1. CloseDate=0 → НЕ меняем статус (ждём Status=1 или валидный CloseDate)
        2. CloseDate > 0 и валидный (после 2020) и в прошлом → Closed
        3. Иначе → не меняем статус
        
        Status=1 обрабатывается отдельно в _apply_update_fields
        """
        from . import utils
        
        close_date = utils.safe_int(updates['CloseDate'])
        
        if close_date == 0:
            # CloseDate=0 означает ордер ещё открыт
            # НЕ меняем статус - ждём явного Status=1 или валидного CloseDate
            log(f"[UDP-LISTENER-{self.server_id}] [UPDATE] Order {order.moonbot_order_id} has CloseDate=0 → Keeping current status ({order.status})")
            return
        
        # Проверяем что это валидный timestamp (после 2020 года)
        MIN_VALID_TIMESTAMP = 1577836800  # 2020-01-01
        is_valid_timestamp = close_date > MIN_VALID_TIMESTAMP
        
        if not is_valid_timestamp:
            # Невалидный timestamp - игнорируем
            log(f"[UDP-LISTENER-{self.server_id}] [UPDATE] Order {order.moonbot_order_id} has invalid CloseDate={close_date} → Ignoring")
            return
        
        now_ts = current_timestamp()
        # Допуск 300 секунд (5 минут) для рассинхронизации часов
        CLOCK_SYNC_TOLERANCE = 300
        is_date_in_future = close_date > (now_ts + CLOCK_SYNC_TOLERANCE)
        
        if not is_date_in_future:
            # CloseDate в прошлом или в пределах допуска - ордер закрыт
            order.status = "Closed"
            try:
                order.closed_at = timestamp_to_datetime(close_date)
            except (ValueError, OSError, OverflowError) as e:
                log(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid CloseDate={close_date}, Error: {e}")
                order.closed_at = utcnow()
            log(f"[UDP-LISTENER-{self.server_id}] ✅ Order {order.moonbot_order_id} marked as Closed (CloseDate={close_date})")
        else:
            # CloseDate в будущем - не меняем статус, ждём Status=1
            log(f"[UDP-LISTENER-{self.server_id}] ⏳ CloseDate={close_date} in future → Keeping current status")
    
    def _process_insert_close_date(self, order: models.MoonBotOrder, close_date: int):
        """
        Обработка CloseDate в INSERT
        
        ВАЖНО: MoonBot может присылать CloseDate = BuyDate при создании ордера!
        Проверяем близость дат чтобы не помечать новые ордера как закрытые.
        """
        close_indicators, has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc = self._count_close_indicators(order)
        
        now_ts = current_timestamp()
        is_date_in_future = close_date > now_ts
        
        MAX_FUTURE_WINDOW = 365 * 24 * 60 * 60
        is_within_reasonable_window = (close_date - now_ts) <= MAX_FUTURE_WINDOW
        
        # Получаем BuyDate для сравнения
        buy_date = getattr(order, 'buy_date', None) or 0
        
        # Если CloseDate очень близок к BuyDate (< 10 минут) - это вероятно новый ордер
        # MoonBot может присылать CloseDate = BuyDate при создании
        CLOSE_BUYDATE_THRESHOLD = 10 * 60  # 10 минут
        close_equals_buy = buy_date > 0 and abs(close_date - buy_date) < CLOSE_BUYDATE_THRESHOLD
        
        if close_equals_buy and close_indicators < 2:
            # CloseDate ≈ BuyDate и нет явных признаков закрытия → открытый ордер
            log(f"[UDP-LISTENER-{self.server_id}] ⏳ INSERT: Order {order.moonbot_order_id} has CloseDate≈BuyDate ({close_date}≈{buy_date}), only {close_indicators} close indicators → Marked as Open")
            log(f"[UDP-LISTENER-{self.server_id}]    Indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}, GainedBTC={has_gained_btc}")
            order.status = "Open"
            order.closed_at = None
            return
        
        if not is_date_in_future:
            # CloseDate в прошлом и НЕ равен BuyDate → закрытый ордер
            if close_indicators >= 1:
                # Есть хотя бы 1 признак закрытия - закрываем
                order.status = "Closed"
                try:
                    order.closed_at = timestamp_to_datetime(close_date)
                except (ValueError, OSError, OverflowError):
                    order.closed_at = utcnow()
                log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Order {order.moonbot_order_id} marked as Closed (CloseDate in past + {close_indicators} indicators)")
            else:
                # CloseDate в прошлом, но нет признаков закрытия - подозрительно
                # Оставляем как Open и ждём UPDATE с реальным статусом
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ INSERT: Order {order.moonbot_order_id} has CloseDate in past but 0 close indicators → Marked as Open (waiting for UPDATE)")
                order.status = "Open"
                order.closed_at = None
        
        else:
            # CloseDate в будущем - ордер ещё открыт
            log(f"[UDP-LISTENER-{self.server_id}] ⏳ INSERT: Future CloseDate={close_date} for order {order.moonbot_order_id} → Keeping as Open")
            order.status = "Open"
            order.closed_at = None
