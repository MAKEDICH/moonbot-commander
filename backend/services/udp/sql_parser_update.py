"""
Обработка UPDATE команд для SQL парсера
"""
import re
from datetime import timedelta
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from . import utils


class SQLParserUpdateMixin:
    """Методы для обработки UPDATE команд"""
    
    def _extract_strategy_from_text(self, updates: dict) -> Optional[str]:
        """
        Извлечение стратегии из текстовых полей UPDATE
        
        Ищет стратегию в SellReason, ChannelName и Comment в формате:
        - (strategy <StrategyName>)
        - <StrategyName>
        
        Returns:
            Название стратегии или None
        """
        strategy_from_text = None
        
        # 🎯 КРИТИЧНО: SellReason - это ПРИЧИНА ЗАКРЫТИЯ, а НЕ стратегия!
        # SellReason содержит: "Auto Price Down", "Manual Sell", "Stop Loss" и т.д.
        # Стратегия может быть в формате (strategy <Name>) внутри SellReason
        
        # Проверяем SellReason ТОЛЬКО на наличие (strategy <Name>)
        if 'SellReason' in updates:
            sellreason_value = str(updates['SellReason']).strip()
            # Ищем стратегию ТОЛЬКО в формате (strategy <StrategyName>)
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', sellreason_value, re.IGNORECASE)
            if strategy_match:
                strategy_from_text = strategy_match.group(1).strip()
                log(f"[UDP-LISTENER-{self.server_id}] Found strategy in SellReason: '{strategy_from_text}'")
        
        # Если не нашли в SellReason, проверяем ChannelName
        if not strategy_from_text and 'ChannelName' in updates:
            channel_value = str(updates['ChannelName']).strip()
            channel_value = channel_value.strip("'\"")
            # Сначала ищем в формате (strategy <StrategyName>)
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', channel_value, re.IGNORECASE)
            if strategy_match:
                strategy_from_text = strategy_match.group(1).strip()
                log(f"[UDP-LISTENER-{self.server_id}] Found strategy in ChannelName: '{strategy_from_text}'")
            else:
                # Если не нашли, ищем просто <StrategyName>
                strategy_match = re.search(r'<([^<>]+)>', channel_value)
                if strategy_match:
                    strategy_from_text = strategy_match.group(1).strip()
                    log(f"[UDP-LISTENER-{self.server_id}] Found strategy in ChannelName: '{strategy_from_text}'")
        
        # Если не нашли в ChannelName, проверяем Comment
        if not strategy_from_text and 'Comment' in updates:
            comment_value = str(updates['Comment']).strip()
            # Убираем кавычки если есть
            comment_value = comment_value.strip("'\"")
            
            # 🎯 КРИТИЧНО: Если Comment начинается с "CPU:" - это системная информация
            # Не извлекаем из него стратегию, чтобы ордер отображался как MANUAL
            if comment_value.startswith('CPU:'):
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ Comment starts with 'CPU:' - skipping strategy extraction (will be MANUAL)")
                return None
            
            # Сначала ищем в формате (strategy <StrategyName>)
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', comment_value, re.IGNORECASE)
            if strategy_match:
                strategy_from_text = strategy_match.group(1).strip()
            else:
                # Если не нашли, ищем просто <StrategyName>
                strategy_match = re.search(r'<([^<>]+)>', comment_value)
                if strategy_match:
                    strategy_from_text = strategy_match.group(1).strip()
        
        return strategy_from_text
    
    def parse_update_order(self, db: Session, sql: str, moonbot_order_id: int = None, bot_name: str = None):
        """Парсинг UPDATE Orders команды"""
        try:
            if not moonbot_order_id:
                id_match = re.search(r'\[?ID\]?\s*=\s*(\d+)', sql, re.IGNORECASE)
                if not id_match:
                    log(f"[UDP-LISTENER-{self.server_id}] UPDATE без ID и без oid: {sql[:100]}")
                    return
                
                moonbot_order_id = int(id_match.group(1))
                log(f"[UDP-LISTENER-{self.server_id}] [INFO] Using ID from SQL WHERE: {moonbot_order_id}")
            else:
                log(f"[UDP-LISTENER-{self.server_id}] [INFO] Using oid from packet: {moonbot_order_id}")
            
            set_match = re.search(r'set\s+(.+?)\s+where', sql, re.IGNORECASE | re.DOTALL)
            if not set_match:
                return
            
            set_clause = set_match.group(1)
            updates = self._parse_set_clause(set_clause)
            
            order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()
            
            if not order:
                order = self._find_order_by_fingerprint(db, updates, moonbot_order_id)
                if not order:
                    return
            
            self._apply_update_fields(order, updates)
            order.updated_at = utcnow()
            
            # Сохраняем bot_name если передан (обновляем всегда, даже если уже есть значение)
            if bot_name:
                order.bot_name = bot_name
                log(f"[UDP-LISTENER-{self.server_id}] 💾 Updated bot_name for order {moonbot_order_id}: {bot_name}")
            
            log(f"[UDP-LISTENER-{self.server_id}] Updated order {moonbot_order_id}: {len(updates)} fields")
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] UPDATE parse error: {e}")
            import traceback
            traceback.print_exc()
    
    def _find_order_by_fingerprint(self, db: Session, updates: dict, moonbot_order_id: int) -> Optional[models.MoonBotOrder]:
        """Поиск ордера по fingerprint (quantity + spent_btc)"""
        log(f"[UDP-LISTENER-{self.server_id}] ⚠️ UPDATE для несуществующего ордера ID={moonbot_order_id}")
        log(f"[UDP-LISTENER-{self.server_id}] 🔍 Применяем FINGERPRINT MATCHING...")
        
        quantity = utils.safe_float(updates.get('Quantity'))
        spent_btc = utils.safe_float(updates.get('SpentBTC'))
        
        if quantity:
            time_threshold = utcnow() - timedelta(seconds=120)
            
            candidates = db.query(models.MoonBotOrder)\
                .filter(models.MoonBotOrder.server_id == self.server_id)\
                .filter(models.MoonBotOrder.created_at >= time_threshold)\
                .filter(
                    func.abs(models.MoonBotOrder.quantity - quantity) < 1.0
                )\
                .order_by(models.MoonBotOrder.created_at.desc())\
                .all()
            
            log(f"[UDP-LISTENER-{self.server_id}] 📊 Найдено {len(candidates)} кандидатов с quantity ≈ {quantity}")
            
            best_match = None
            if spent_btc and candidates:
                for candidate in candidates:
                    if candidate.spent_btc and abs(candidate.spent_btc - spent_btc) < 1.0:
                        best_match = candidate
                        break
            
            if not best_match and candidates:
                best_match = candidates[0]
            
            if best_match:
                log(f"[UDP-LISTENER-{self.server_id}] ✅ НАЙДЕН ордер по fingerprint!")
                log(f"[UDP-LISTENER-{self.server_id}]    Symbol: {best_match.symbol}")
                log(f"[UDP-LISTENER-{self.server_id}]    Original ID: {best_match.moonbot_order_id}")
                log(f"[UDP-LISTENER-{self.server_id}]    New ID: {moonbot_order_id}")
                
                best_match.moonbot_order_id = moonbot_order_id
                return best_match
            else:
                log(f"[UDP-LISTENER-{self.server_id}] ❌ Не найдено подходящих ордеров")
        else:
            log(f"[UDP-LISTENER-{self.server_id}] ❌ Нет Quantity для fingerprint matching")
        
        log(f"[UDP-LISTENER-{self.server_id}] ⏭️ Пропускаем UPDATE")
        return None
    
    def _apply_update_fields(self, order: models.MoonBotOrder, updates: dict):
        """Применение обновлений к ордеру из UPDATE"""
        # Полный маппинг всех полей из MoonBot Orders таблицы
        field_mapping = {
            # === ОСНОВНЫЕ ПОЛЯ ===
            'exOrderID': ('ex_order_id', str),
            'Coin': ('symbol', str),
            'Symbol': ('symbol', str),
            'BuyDate': ('buy_date', int),
            'SellSetDate': ('sell_set_date', int),
            'CloseDate': ('close_date', int),
            'BuyPrice': ('buy_price', float),
            'SellPrice': ('sell_price', float),
            'Quantity': ('quantity', float),
            'SpentBTC': ('spent_btc', float),
            'GainedBTC': ('gained_btc', float),
            'ProfitBTC': ('profit_btc', float),
            
            # === МЕТАДАННЫЕ ===
            'Source': ('source', int),
            'Channel': ('channel', int),
            'ChannelName': ('channel_name', str),
            'Comment': ('comment', str),  # Comment -> comment, НЕ strategy!
            'SellReason': ('sell_reason', str),
            'SignalType': ('signal_type', str),
            'Strategy': ('strategy', str),
            'StrategyID': ('strategy_id', int),
            'BaseCurrency': ('base_currency', int),
            
            # === ФАЙЛЫ И ФЛАГИ ===
            'FName': ('fname', str),
            'deleted': ('deleted', int),
            'Emulator': ('emulator', int),
            'Imp': ('imp', int),
            
            # === РЫНОЧНЫЕ ДАННЫЕ ===
            'BoughtQ': ('bought_q', float),
            'BTC1hDelta': ('btc_1h_delta', float),
            'Exchange1hDelta': ('exchange_1h_delta', float),
            'BTC24hDelta': ('btc_24h_delta', float),
            'Exchange24hDelta': ('exchange_24h_delta', float),
            'bvsvRatio': ('bvsv_ratio', float),
            'BTC5mDelta': ('btc_5m_delta', float),
            'IsShort': ('is_short', int),
            
            # === PUMP & DUMP ===
            'Pump1H': ('pump_1h', float),
            'Dump1H': ('dump_1h', float),
            
            # === ДЕТАЛЬНЫЕ ДЕЛЬТЫ ===
            'd24h': ('d24h', float),
            'd3h': ('d3h', float),
            'd1h': ('d1h', float),
            'd15m': ('d15m', float),
            'd5m': ('d5m', float),
            'd1m': ('d1m', float),
            'dBTC1m': ('dbtc_1m', float),
            
            # === ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ ===
            'PriceBug': ('price_bug', float),
            'Vd1m': ('vd1m', float),
            'Lev': ('lev', int),
            
            # === ОБЪЁМЫ ===
            'hVol': ('hvol', float),
            'hVolF': ('hvolf', float),
            'dVol': ('dvol', float),
            
            # === ID И ЗАДАЧИ ===
            'TaskID': ('task_id', int),
            
            # === ДОПОЛНИТЕЛЬНЫЕ ===
            'BoughtSO': ('bought_so', int),
            'BTCInDelta': ('btc_in_delta', float),
            'Latency': ('latency', int),
            'Ping': ('ping', int),
            'SafetyOrdersUsed': ('safety_orders_used', int),
            'PriceBlow': ('price_blow', bool),
            'DailyVol': ('daily_vol', str),
        }
        
        strategy_from_text = self._extract_strategy_from_text(updates)
        
        for sql_field, (model_field, field_type) in field_mapping.items():
            if sql_field in updates:
                try:
                    if field_type == float:
                        value = utils.safe_float(updates[sql_field])
                    elif field_type == int:
                        value = utils.safe_int(updates[sql_field])
                    elif field_type == bool:
                        value = bool(utils.safe_int(updates[sql_field]))
                    else:
                        value = str(updates[sql_field]).strip() if updates[sql_field] else None
                    
                    if model_field == 'strategy' and strategy_from_text:
                        continue
                    
                    if value is not None:
                        setattr(order, model_field, value)
                        
                        # Синхронизируем emulator и is_emulator
                        if model_field == 'emulator':
                            order.is_emulator = bool(value)
                except Exception as e:
                    log(f"[UDP-LISTENER-{self.server_id}] Error setting {model_field}: {e}")
        
        if strategy_from_text:
            order.strategy = strategy_from_text
        
        if 'Lev' in updates and not order.quantity:
            order.quantity = utils.safe_float(updates['Lev'])
        
        if order.profit_btc is not None and order.spent_btc:
            if order.gained_btc == 0 or order.gained_btc is None:
                order.gained_btc = order.spent_btc + order.profit_btc
        
        if not order.buy_price and order.spent_btc and order.quantity and order.quantity > 0:
            order.buy_price = order.spent_btc / order.quantity
        
        if order.profit_btc is not None and order.spent_btc and order.spent_btc > 0:
            order.profit_percent = (order.profit_btc / order.spent_btc) * 100
        
        if 'CloseDate' in updates:
            self._process_close_date(order, updates)
        
        if order.symbol == 'UNKNOWN' and 'FName' in updates:
            extracted_symbol = utils.extract_symbol_from_fname(updates['FName'], self.server_id)
            if extracted_symbol:
                order.symbol = extracted_symbol
                log(f"[UDP-LISTENER-{self.server_id}] ✅ Fixed UNKNOWN → {extracted_symbol} from FName!")
        
        if 'CloseDate' not in updates and order.status == "Open":
            # Проверяем признаки закрытия (используем >= 2 как в оригинале)
            # Явно преобразуем в bool чтобы избежать None в sum()
            has_sell_reason = bool(order.sell_reason and len(str(order.sell_reason).strip()) > 0)
            has_sell_price = bool(order.sell_price is not None and order.sell_price > 0)
            has_profit_calculated = bool(order.profit_btc is not None)
            has_gained_btc = bool(order.gained_btc is not None and order.gained_btc > 0)
            
            close_indicators = sum([has_sell_reason, has_sell_price, has_profit_calculated, has_gained_btc])
            
            if close_indicators >= 2:
                # У ордера есть признаки закрытия, но он все еще Open
                order.status = "Closed"
                
                if not order.closed_at:
                    order.closed_at = utcnow()
                
                log(f"[UDP-LISTENER-{self.server_id}] 🔄 SMART RE-CHECK: Order {order.moonbot_order_id} has {close_indicators} close indicators → Changed status to Closed")
