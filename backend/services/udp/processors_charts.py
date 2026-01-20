"""
Обработка графиков для UDP Listener

Парсинг и сохранение бинарных данных графиков от MoonBot.

Оптимизировано для 3000+ серверов:
- Уменьшенное логирование
- Кэширование user_id
- Асинхронные WebSocket уведомления
"""
import json

from models.database import SessionLocal
from models import models
from utils.logging import log
from utils.datetime_utils import utcnow
from .processors_orders import get_cached_user_id


class ChartProcessor:
    """
    Процессор бинарных пакетов графиков
    
    Оптимизирован для 3000+ серверов
    """
    
    # Счётчик для уменьшения логирования
    _chart_counter = 0
    _log_every_n = 50  # Логировать каждый N-й график
    
    def __init__(self, server_id: int):
        self.server_id = server_id
        self.chart_assembler = None
    
    def is_chart_packet(self, data: bytes) -> bool:
        """
        Проверка, является ли пакет бинарными данными графика
        
        Формат заголовка:
        - Flag (1 байт) = 0 (чтобы отличить от gzip)
        - Kind (1 байт) = 1 (график)
        
        Args:
            data: Бинарные данные пакета
        
        Returns:
            True если это пакет графика
        """
        if len(data) < 8:
            return False
        
        # Flag = 0, Kind = 1 для графиков
        # Также проверяем что это НЕ gzip (gzip начинается с 0x1f 0x8b)
        is_chart = data[0] == 0 and data[1] == 1
        
        return is_chart
    
    def process_chart_packet(self, data: bytes):
        """
        Обработка бинарного пакета графика от MoonBot
        
        Пакет может быть фрагментирован, поэтому используем сборщик
        
        Args:
            data: Бинарные данные пакета
        """
        from services.chart_parser import parse_header, ChartFragmentAssembler
        
        if len(data) < 8:
            return
        
        # Парсим заголовок
        header = parse_header(data)
        if not header:
            return
        
        # Инициализируем сборщик если нужно
        if self.chart_assembler is None:
            self.chart_assembler = ChartFragmentAssembler()
        
        # Добавляем фрагмент
        result = self.chart_assembler.add_fragment(data)
        
        if result is not None:
            # Все фрагменты получены - парсим и сохраняем
            assembled_header, complete_data = result
            self._save_chart_data(complete_data, header.order_id)
    
    def _save_chart_data(self, data: bytes, order_id: int):
        """
        Парсинг и сохранение данных графика в БД и на диск
        
        Args:
            data: Полные бинарные данные графика
            order_id: ID ордера
        """
        try:
            from services.chart_parser import parse_chart_binary
            from services.chart_storage import save_chart
            
            chart = parse_chart_binary(data)
            if not chart:
                return
            
            # Уменьшенное логирование
            ChartProcessor._chart_counter += 1
            if ChartProcessor._chart_counter % ChartProcessor._log_every_n == 0:
                log(f"[UDP-LISTENER-{self.server_id}] 📊 Charts processed: {ChartProcessor._chart_counter}")
            
            # Сериализуем данные графика в JSON
            chart_json = self._serialize_chart(chart)
            
            db = SessionLocal()
            try:
                self._save_chart_to_db(db, chart, chart_json, order_id)
                
                # Сохранение на диск в отдельном try-блоке (не критично)
                try:
                    save_chart(
                        source_id=f"server_{self.server_id}",
                        order_id=order_id,
                        chart_data=chart_json,
                        binary_data=data
                    )
                except Exception:
                    pass  # Не критично
                
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Chart save error: {e}", level="ERROR")
                db.rollback()
            finally:
                db.close()
                
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Chart parse error: {e}", level="ERROR")
    
    def _serialize_chart(self, chart) -> dict:
        """
        Сериализация данных графика в JSON-совместимый словарь
        
        Args:
            chart: Объект графика
        
        Returns:
            Словарь с данными графика
        """
        return {
            "version": chart.version,
            "market_name": chart.market_name,
            "market_currency": chart.market_currency,
            "pump_channel": chart.pump_channel,
            "bn_market_name": chart.bn_market_name,
            "start_time": chart.start_time.isoformat() if chart.start_time else None,
            "end_time": chart.end_time.isoformat() if chart.end_time else None,
            "history_prices": [
                {"time": p.time.isoformat(), "price": p.price}
                for p in chart.history_prices
            ],
            "orders": [
                {
                    "order_id": o.order_id,
                    "mean_price": o.mean_price,
                    "create_time": o.create_time.isoformat() if o.create_time else None,
                    "open_time": o.open_time.isoformat() if o.open_time else None,
                    "close_time": o.close_time.isoformat() if o.close_time else None
                }
                for o in chart.orders
            ],
            "trades": [
                {"time": t.time.isoformat(), "price": t.price}
                for t in chart.trades
            ],
            "deltas": {
                "last_1m_delta": chart.deltas.last_1m_delta,
                "last_5m_delta": chart.deltas.last_5m_delta,
                "last_1h_delta": chart.deltas.last_1h_delta,
                "last_3h_delta": chart.deltas.last_3h_delta,
                "last_24h_delta": chart.deltas.last_24h_delta,
                "pump_delta_1h": chart.deltas.pump_delta_1h,
                "dump_delta_1h": chart.deltas.dump_delta_1h,
                "hvol": chart.deltas.hvol,
                "hvol_fast": chart.deltas.hvol_fast,
                "test_price_down": chart.deltas.test_price_down,
                "test_price_up": chart.deltas.test_price_up,
                "is_moonshot": chart.deltas.is_moonshot,
                "session_profit": chart.deltas.session_profit
            } if chart.deltas else None,
            "closest_prices": [
                {"time": p.time.isoformat(), "price": p.price}
                for p in chart.closest_prices
            ],
            "candles": [
                {
                    "time": c.time.isoformat(),
                    "count": c.count,
                    "min_price": c.min_price,
                    "max_price": c.max_price,
                    "buy_volume": c.buy_volume,
                    "sell_volume": c.sell_volume
                }
                for c in chart.candles
            ]
        }
    
    def _save_chart_to_db(self, db, chart, chart_json: dict, order_id: int):
        """
        Сохранение графика в базу данных
        
        Args:
            db: Сессия базы данных
            chart: Объект графика
            chart_json: Сериализованные данные
            order_id: ID ордера
        """
        # Проверяем, есть ли уже график для этого ордера
        existing = db.query(models.MoonBotChart).filter(
            models.MoonBotChart.server_id == self.server_id,
            models.MoonBotChart.order_db_id == order_id
        ).first()
        
        chart_data_json = json.dumps(chart_json, ensure_ascii=False)
        
        if existing:
            # Обновляем существующий
            existing.market_name = chart.market_name
            existing.market_currency = chart.market_currency
            existing.pump_channel = chart.pump_channel
            existing.start_time = chart.start_time
            existing.end_time = chart.end_time
            existing.session_profit = chart.deltas.session_profit if chart.deltas else None
            existing.chart_data = chart_data_json
            existing.received_at = utcnow()
        else:
            # Создаём новый
            new_chart = models.MoonBotChart(
                server_id=self.server_id,
                order_db_id=order_id,
                market_name=chart.market_name,
                market_currency=chart.market_currency,
                pump_channel=chart.pump_channel,
                start_time=chart.start_time,
                end_time=chart.end_time,
                session_profit=chart.deltas.session_profit if chart.deltas else None,
                chart_data=chart_data_json,
                received_at=utcnow()
            )
            db.add(new_chart)
        
        db.commit()
        
        # Отправляем WebSocket уведомление о новом графике (используем кэш user_id)
        self._send_chart_notification(chart, order_id)
    
    def _send_chart_notification(self, chart, order_id: int):
        """
        Отправка WebSocket уведомления о новом графике
        
        Args:
            chart: Объект графика
            order_id: ID ордера
        """
        try:
            from services.websocket_manager import ws_manager
            
            # Используем кэшированный user_id вместо запроса к БД
            user_id = get_cached_user_id(self.server_id)
            if user_id:
                ws_manager.send_message_threadsafe(
                    {
                        "type": "chart_update",
                        "server_id": self.server_id,
                        "order_id": order_id,
                        "market_name": chart.market_name,
                        "market_currency": chart.market_currency,
                        "session_profit": chart.deltas.session_profit if chart.deltas else None
                    },
                    user_id
                )
        except Exception:
            pass  # Не блокируем обработку при ошибке WS

