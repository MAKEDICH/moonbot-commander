"""
Обработка INSERT команд для SQL парсера
"""
import re
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from . import utils
from .strategy_normalizer import StrategyNormalizer


class SQLParserInsertMixin:
    """Методы для обработки INSERT команд"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if hasattr(self, 'server_id'):
            self._strategy_normalizer = StrategyNormalizer(self.server_id)
    
    def _get_strategy_normalizer(self):
        """Получение или создание нормализатора стратегий"""
        if not hasattr(self, '_strategy_normalizer'):
            self._strategy_normalizer = StrategyNormalizer(self.server_id)
        return self._strategy_normalizer
    
    def parse_insert_order(self, db: Session, sql: str, command_id: int, moonbot_order_id: int = None, bot_name: str = None):
        """Парсинг INSERT INTO Orders команды"""
        try:
            fields_match = re.search(r'insert\s+into\s+Orders\s*\(([^)]+)\)', sql, re.IGNORECASE)
            if not fields_match:
                log(f"[UDP-LISTENER-{self.server_id}] INSERT без полей: {sql[:100]}")
                return
            
            fields_str = fields_match.group(1)
            fields = [f.strip().strip('[]').strip() for f in fields_str.split(',')]
            
            values_match = re.search(r'values\s*\((.*)\)', sql, re.IGNORECASE | re.DOTALL)
            if not values_match:
                log(f"[UDP-LISTENER-{self.server_id}] INSERT без values: {sql[:100]}")
                return
            
            values_str = values_match.group(1).strip()
            values = self._parse_values_clause(values_str)
            
            if len(fields) != len(values):
                log(f"[UDP-LISTENER-{self.server_id}] INSERT mismatch: {len(fields)} fields vs {len(values)} values")
                min_len = min(len(fields), len(values))
                if min_len > 0:
                    log(f"[UDP-LISTENER-{self.server_id}] Using first {min_len} fields/values")
                    data = dict(zip(fields[:min_len], values[:min_len]))
                else:
                    return
            else:
                data = dict(zip(fields, values))
            
            task_id = self._extract_task_id(data)
            
            if moonbot_order_id is None:
                if task_id and task_id > 0:
                    moonbot_order_id = task_id
                    log(f"[UDP-LISTENER-{self.server_id}] 🧠 Using TaskID as moonbot_order_id: {task_id}")
                else:
                    moonbot_order_id = command_id
            
            # Дополнительная попытка извлечь ID из exOrderID
            if not moonbot_order_id or moonbot_order_id == 0:
                log(f"[UDP-LISTENER-{self.server_id}] [WARN] No valid order ID available for INSERT (ID={moonbot_order_id}), trying to extract...")
                if 'exOrderID' in data:
                    try:
                        ex_order_id = data['exOrderID'].strip().strip("'\"")
                        if ex_order_id.isdigit():
                            moonbot_order_id = int(ex_order_id)
                            log(f"[UDP-LISTENER-{self.server_id}] ✅ Using exOrderID as moonbot_order_id: {moonbot_order_id}")
                        else:
                            ex_id_match = re.search(r'(\d+)', ex_order_id)
                            if ex_id_match:
                                moonbot_order_id = int(ex_id_match.group(1))
                                log(f"[UDP-LISTENER-{self.server_id}] ✅ Extracted ID from exOrderID: {moonbot_order_id}")
                    except Exception as e:
                        log(f"[UDP-LISTENER-{self.server_id}] [WARN] Error extracting ID from exOrderID: {e}")
            
            if not moonbot_order_id or moonbot_order_id == 0:
                log(f"[UDP-LISTENER-{self.server_id}] [WARN] Cannot determine order ID for INSERT, skipping...")
                return
            
            existing_order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()
            
            if existing_order:
                if getattr(existing_order, 'created_from_update', False):
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] INSERT arrived for UPDATE-created order (ID={moonbot_order_id})")
                    existing_order.created_from_update = False
                order = existing_order
            else:
                order = models.MoonBotOrder(
                    server_id=self.server_id,
                    moonbot_order_id=moonbot_order_id,
                    symbol="UNKNOWN",  # Будет обновлено из данных INSERT
                    status="Open"
                )
                db.add(order)
                db.flush()  # Получаем ID сразу
            
            self._apply_insert_fields(order, data, db)
            order.updated_at = utcnow()
            
            # Сохраняем bot_name если передан
            if bot_name:
                order.bot_name = bot_name
                log(f"[UDP-LISTENER-{self.server_id}] 💾 Updated bot_name for INSERT order {moonbot_order_id}: {bot_name}")
            
            log(f"[UDP-LISTENER-{self.server_id}] {'Updated' if existing_order else 'Created'} order {moonbot_order_id}: {order.symbol} (Qty:{order.quantity}, Strategy:{order.strategy})")
            
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] INSERT parse error: {e}")
            import traceback
            traceback.print_exc()
    
    def _apply_insert_fields(self, order: models.MoonBotOrder, data: dict, db: Session):
        """Применение полей к ордеру из INSERT"""
        # Полный маппинг всех 54 полей из проекта A
        field_mapping = {
            # === ОСНОВНЫЕ ПОЛЯ ===
            'exOrderID': 'ex_order_id',
            'Coin': 'symbol',
            'Symbol': 'symbol',
            'BuyDate': 'buy_date',
            'SellSetDate': 'sell_set_date',
            'CloseDate': 'close_date',
            'BuyPrice': 'buy_price',
            'SellPrice': 'sell_price',
            'Quantity': 'quantity',
            'SpentBTC': 'spent_btc',
            'GainedBTC': 'gained_btc',
            'ProfitBTC': 'profit_btc',
            
            # === МЕТАДАННЫЕ ===
            'Source': 'source',
            'Channel': 'channel',
            'ChannelName': 'channel_name',
            'Status': 'moonbot_status',
            'Comment': 'comment',
            'SellReason': 'sell_reason',
            'SignalType': 'signal_type',
            'BaseCurrency': 'base_currency',
            'StrategyID': 'strategy_id',
            
            # === ФАЙЛЫ И ФЛАГИ ===
            'FName': 'fname',
            'deleted': 'deleted',
            'Emulator': 'emulator',
            'Imp': 'imp',
            
            # === РЫНОЧНЫЕ ДАННЫЕ ===
            'BoughtQ': 'bought_q',
            'BTC1hDelta': 'btc_1h_delta',
            'Exchange1hDelta': 'exchange_1h_delta',
            'BTC24hDelta': 'btc_24h_delta',
            'Exchange24hDelta': 'exchange_24h_delta',
            'bvsvRatio': 'bvsv_ratio',
            'BTC5mDelta': 'btc_5m_delta',
            'IsShort': 'is_short',
            
            # === PUMP & DUMP ===
            'Pump1H': 'pump_1h',
            'Dump1H': 'dump_1h',
            
            # === ДЕТАЛЬНЫЕ ДЕЛЬТЫ ===
            'd24h': 'd24h',
            'd3h': 'd3h',
            'd1h': 'd1h',
            'd15m': 'd15m',
            'd5m': 'd5m',
            'd1m': 'd1m',
            'dBTC1m': 'dbtc_1m',
            
            # === ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ ===
            'PriceBug': 'price_bug',
            'Vd1m': 'vd1m',
            'Lev': 'lev',
            
            # === ОБЪЁМЫ ===
            'hVol': 'hvol',
            'hVolF': 'hvolf',
            'dVol': 'dvol',
            
            # === ID И ЗАДАЧИ ===
            'TaskID': 'task_id',
            
            # === ДОПОЛНИТЕЛЬНЫЕ (из E) ===
            'BoughtSO': 'bought_so',
            'BTCInDelta': 'btc_in_delta',
            'Latency': 'latency',
            'Ping': 'ping',
            'SafetyOrdersUsed': 'safety_orders_used',
            'PriceBlow': 'price_blow',
            'DailyVol': 'daily_vol',
        }
        
        # Извлекаем стратегию из трёх источников (как в проекте A)
        normalizer = self._get_strategy_normalizer()
        strategy_from_text = normalizer.extract_strategy_from_all_sources(data)
        
        # Определяем валюту для конвертации TRY → USDT
        insert_currency = self._get_insert_currency(order, data, db)
        
        # Применяем все поля
        for sql_field, model_field in field_mapping.items():
            if sql_field in data:
                value = data[sql_field]
                
                # Конвертируем в нужный тип
                if model_field in ['buy_price', 'sell_price', 'quantity', 'spent_btc', 'gained_btc', 'profit_btc',
                                   'btc_1h_delta', 'exchange_1h_delta', 'btc_24h_delta', 'exchange_24h_delta',
                                   'bvsv_ratio', 'btc_5m_delta', 'pump_1h', 'dump_1h', 'd24h', 'd3h', 'd1h',
                                   'd15m', 'd5m', 'd1m', 'dbtc_1m', 'price_bug', 'vd1m', 'hvol', 'hvolf',
                                   'dvol', 'bought_q', 'btc_in_delta']:
                    value = utils.safe_float(value)
                    # Конвертация TRY → USDT
                    if value is not None and insert_currency and str(insert_currency).upper() == 'TRY':
                        if model_field in ['profit_btc', 'spent_btc', 'gained_btc']:
                            value = self._convert_try_to_usdt(value)
                
                elif model_field in ['source', 'channel', 'task_id', 'bought_so', 'latency', 'ping', 'safety_orders_used',
                                    'strategy_id', 'deleted', 'emulator', 'imp', 'is_short', 'lev', 'base_currency']:
                    # Integer поля
                    value = utils.safe_int(value) if value is not None else None
                
                elif model_field in ['buy_date', 'sell_set_date', 'close_date']:
                    # Timestamp поля (сохраняем как Integer Unix timestamp)
                    value = utils.safe_int(value)
                    # Обработка будет в _process_insert_timestamps
                
                elif model_field in ['comment', 'channel_name', 'fname', 'daily_vol']:
                    # Текстовые поля
                    value = str(value).strip() if value else None
                
                elif model_field == 'moonbot_status':
                    # Это поле из SQL не соответствует нашему полю status
                    # Пропускаем его, status устанавливается отдельно
                    continue
                
                elif model_field in ['price_blow']:
                    # Boolean поля
                    value = bool(utils.safe_int(value)) if value is not None else None
                
                else:  # Строковые поля
                    value = str(value).strip() if value else None
                
                # Устанавливаем значение
                if value is not None:
                    setattr(order, model_field, value)
        
        # Синхронизируем emulator (int) и is_emulator (bool)
        if hasattr(order, 'emulator') and order.emulator is not None:
            order.is_emulator = bool(order.emulator)
        elif 'Emulator' in data:
            emulator_value = utils.safe_int(data['Emulator'])
            order.emulator = emulator_value
            order.is_emulator = bool(emulator_value)
        
        # Устанавливаем стратегию с нормализацией
        normalizer = self._get_strategy_normalizer()
        if strategy_from_text:
            normalized_strategy = normalizer.normalize_strategy_name(strategy_from_text)
            if normalized_strategy:
                order.strategy = normalized_strategy
                log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Set strategy '{strategy_from_text}' → '{normalized_strategy}'")
            else:
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ INSERT: Strategy '{strategy_from_text}' filtered out as invalid")
        elif order.strategy:
            normalized_strategy = normalizer.normalize_strategy_name(order.strategy)
            if normalized_strategy:
                if normalized_strategy != order.strategy:
                    log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Normalized strategy '{order.strategy}' → '{normalized_strategy}'")
                order.strategy = normalized_strategy
            else:
                order.strategy = None
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ INSERT: Strategy '{order.strategy}' filtered out as invalid")
        
        # Валидация profit_btc для эмулятора
        self._validate_emulator_profit(order)
        
        # Обработка временных меток
        self._process_insert_timestamps(order, data)
        
        # Обработка CloseDate=0 с умной логикой
        self._process_insert_close_logic(order, data)
        
        # Расчёт недостающих полей
        self._calculate_missing_fields(order)
    
    def _get_insert_currency(self, order: models.MoonBotOrder, data: dict, db: Session) -> Optional[str]:
        """Определение валюты для конвертации"""
        insert_currency = order.base_currency if hasattr(order, 'base_currency') else None
        
        if 'BaseCurrency' in data:
            try:
                base_curr_value = data['BaseCurrency']
                base_curr_int = int(base_curr_value)
                insert_currency = base_curr_int
            except (ValueError, TypeError):
                insert_currency = data['BaseCurrency']
        
        # Если валюта не указана, берём из сервера
        if not insert_currency:
            server = db.query(models.Server).filter(models.Server.id == self.server_id).first()
            if server:
                insert_currency = server.default_currency or 'USDT'
        
        return insert_currency
    
    def _convert_try_to_usdt(self, value: float) -> float:
        """
        Конвертация TRY в USDT
        Используем примерный курс TRY/USD
        """
        if value is None:
            return None
        
        # Примерный курс: 1 USD ≈ 30-35 TRY (можно вынести в конфиг)
        TRY_TO_USD_RATE = 0.03  # 1 TRY = 0.03 USD
        converted = value * TRY_TO_USD_RATE
        log(f"[UDP-LISTENER-{self.server_id}] 💱 Converted {value:.2f} TRY → {converted:.2f} USDT")
        return converted
    
    def _validate_emulator_profit(self, order: models.MoonBotOrder):
        """
        Валидация profit_btc для эмуляторных ордеров
        Проверяет разумность значения и пересчитывает при необходимости
        """
        if not order.is_emulator or order.profit_btc is None:
            return
        
        MAX_REASONABLE_PROFIT_MULTIPLIER = 100.0
        
        if order.spent_btc and order.spent_btc > 0:
            if abs(order.profit_btc) > abs(order.spent_btc) * MAX_REASONABLE_PROFIT_MULTIPLIER:
                # profit_btc заоблачно большой, пересчитываем
                if order.buy_price and order.sell_price and order.quantity and order.quantity > 0:
                    recalculated_profit = (order.sell_price - order.buy_price) * order.quantity
                    old_profit = order.profit_btc
                    order.profit_btc = recalculated_profit
                    log(f"[UDP-LISTENER-{self.server_id}] ⚠️ INSERT EMU Order: Invalid ProfitBTC {old_profit:.2f}, recalculated from prices: {recalculated_profit:.2f}")
                else:
                    # Ограничиваем заоблачное значение
                    old_profit = order.profit_btc
                    order.profit_btc = order.spent_btc * MAX_REASONABLE_PROFIT_MULTIPLIER if order.profit_btc > 0 else -order.spent_btc * MAX_REASONABLE_PROFIT_MULTIPLIER
                    log(f"[UDP-LISTENER-{self.server_id}] ⚠️ INSERT EMU Order: Capped ProfitBTC from {old_profit:.2f} to {order.profit_btc:.2f}")
    
    def _process_insert_timestamps(self, order: models.MoonBotOrder, data: dict):
        """Обработка временных меток из INSERT"""
        from . import utils
        
        # BuyDate (integer timestamp) → opened_at (datetime)
        if hasattr(order, 'buy_date') and order.buy_date and order.buy_date > 0:
            try:
                order.opened_at = datetime.fromtimestamp(order.buy_date, tz=timezone.utc)
            except (ValueError, OSError, OverflowError) as e:
                log(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid BuyDate={order.buy_date}, Error: {e}")
                order.opened_at = utcnow()
        
        # CloseDate (integer timestamp) → closed_at (datetime)
        # Примечание: CloseDate=0 означает что ордер открыт
        if hasattr(order, 'close_date') and order.close_date and order.close_date > 0:
            try:
                order.closed_at = datetime.fromtimestamp(order.close_date, tz=timezone.utc)
            except (ValueError, OSError, OverflowError) as e:
                log(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid CloseDate={order.close_date}, Error: {e}")
                order.closed_at = None
    
    def _process_insert_close_logic(self, order: models.MoonBotOrder, data: dict):
        """
        Умная обработка CloseDate=0
        Проверяет признаки закрытия даже если CloseDate=0
        """
        from . import utils
        
        if 'CloseDate' not in data:
            return
        
        close_date_timestamp = utils.safe_int(data['CloseDate'])
        
        if close_date_timestamp == 0:
            # Проверяем признаки закрытия (используем >= 2 как в оригинале)
            has_sell_reason = order.sell_reason and len(str(order.sell_reason).strip()) > 0
            has_sell_price = order.sell_price and order.sell_price > 0
            has_profit_calculated = order.profit_btc is not None
            has_gained_btc = order.gained_btc is not None and order.gained_btc > 0
            
            close_indicators = sum([has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc])
            
            if close_indicators >= 2:
                # Есть признаки закрытия, но CloseDate = 0 - это ошибка MoonBot
                order.status = "Closed"
                if not order.closed_at:
                    order.closed_at = utcnow()
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ [INSERT] Order {order.moonbot_order_id} has CloseDate=0 but {close_indicators} close indicators → Marked as Closed")
            else:
                # Нет признаков закрытия - ордер открыт
                order.status = "Open"
                order.closed_at = None
                if not order.opened_at:
                    order.opened_at = utcnow()
                log(f"[UDP-LISTENER-{self.server_id}] [INSERT] Order has CloseDate=0, only {close_indicators} close indicators → Marked as Open")
        
        elif close_date_timestamp > 0:
            # У нас есть реальная дата закрытия - используем логику из sql_parser_dates
            self._process_insert_close_date(order, close_date_timestamp)
    
    def _calculate_missing_fields(self, order: models.MoonBotOrder):
        """Расчёт недостающих полей (buy_price, profit_percent, gained_btc)"""
        # 1. Вычисляем buy_price если его нет
        if not order.buy_price and order.spent_btc and order.quantity and order.quantity > 0:
            order.buy_price = order.spent_btc / order.quantity
        
        # 2. Вычисляем profit_percent
        if order.profit_btc is not None and order.spent_btc and order.spent_btc > 0:
            order.profit_percent = (order.profit_btc / order.spent_btc) * 100
        
        # 3. Вычисляем gained_btc
        if order.profit_btc is not None and order.spent_btc and not order.gained_btc:
            order.gained_btc = order.spent_btc + order.profit_btc
