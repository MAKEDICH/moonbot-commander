from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Index
from sqlalchemy.orm import relationship
from models.database import Base
from utils.datetime_utils import utcnow


class User(Base):
    """Модель пользователя системы"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    totp_secret = Column(String, nullable=True)  # TOTP секрет для 2FA
    totp_enabled = Column(Boolean, default=False)  # Включен ли 2FA
    created_at = Column(DateTime, default=utcnow)

    servers = relationship("Server", back_populates="owner", cascade="all, delete-orphan")
    command_history = relationship("CommandHistory", back_populates="user", cascade="all, delete-orphan")
    quick_commands = relationship("QuickCommand", back_populates="user", cascade="all, delete-orphan")
    command_presets = relationship("CommandPreset", back_populates="user", cascade="all, delete-orphan")
    user_settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    recovery_codes = relationship("RecoveryCode", back_populates="user", cascade="all, delete-orphan")
    scheduled_commands = relationship("ScheduledCommand", back_populates="user", cascade="all, delete-orphan")


class RecoveryCode(Base):
    """Recovery коды для восстановления доступа"""
    __tablename__ = "recovery_codes"

    id = Column(Integer, primary_key=True, index=True)
    code_hash = Column(String, nullable=False)  # Хешированный код
    used = Column(Boolean, default=False)  # Использован ли код
    used_at = Column(DateTime, nullable=True)  # Когда использован
    created_at = Column(DateTime, default=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="recovery_codes")


class UserSettings(Base):
    """Настройки пользователя"""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    ping_interval = Column(Integer, default=30)  # Интервал опроса серверов в секундах
    enable_notifications = Column(Boolean, default=True)  # Включить уведомления
    notification_sound = Column(Boolean, default=True)  # Звук уведомлений
    backend_log_level = Column(Integer, default=2)  # Уровень логирования: 1-критические, 2-неполное, 3-полное, 4-выборочное
    # JSON массив выбранных категорий логов (для level=4)
    # Пример: ["STARTUP", "ERROR", "DATABASE"]
    log_categories = Column(Text, nullable=True)  # JSON строка с категориями
    last_errors_viewed_at = Column(DateTime, nullable=True)  # Время последнего просмотра ошибок API
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    user = relationship("User", back_populates="user_settings")


class Server(Base):
    """Модель сервера MoonBot"""
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    password = Column(String, nullable=True)  # UDP пароль для HMAC-SHA256
    description = Column(String, nullable=True)
    group_name = Column(String, nullable=True)  # Группа сервера
    is_active = Column(Boolean, default=True)
    keepalive_enabled = Column(Boolean, default=True)  # Включен ли keep-alive для этого сервера
    is_localhost = Column(Boolean, default=False)  # Разрешить localhost/127.0.0.1 для этого сервера
    default_currency = Column(String, default='USDT')  # Валюта сервера (автоопределение из lst)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User", back_populates="servers")
    command_history = relationship("CommandHistory", back_populates="server", cascade="all, delete-orphan")
    server_status = relationship("ServerStatus", back_populates="server", uselist=False, cascade="all, delete-orphan")


class ServerStatus(Base):
    """Текущий статус сервера"""
    __tablename__ = "server_status"

    id = Column(Integer, primary_key=True, index=True)
    is_online = Column(Boolean, default=False)  # Онлайн/оффлайн
    last_ping = Column(DateTime, nullable=True)  # Время последнего пинга
    response_time = Column(Float, nullable=True)  # Время отклика в мс
    last_error = Column(String, nullable=True)  # Последняя ошибка
    uptime_percentage = Column(Float, default=100.0)  # Процент uptime
    consecutive_failures = Column(Integer, default=0)  # Количество последовательных неудач
    
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False, unique=True)
    server = relationship("Server", back_populates="server_status")


class CommandHistory(Base):
    """История выполненных команд"""
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    command = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    status = Column(String, nullable=False)  # success, error, timeout
    execution_time = Column(DateTime, default=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    
    user = relationship("User", back_populates="command_history")
    server = relationship("Server", back_populates="command_history")
    image = relationship("CommandImage", back_populates="command_history", uselist=False, cascade="all, delete-orphan")


class QuickCommand(Base):
    """Быстрые команды пользователя"""
    __tablename__ = "quick_commands"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String, nullable=False)  # Название кнопки
    command = Column(String, nullable=False)  # Команда
    order = Column(Integer, default=0)  # Порядок отображения
    created_at = Column(DateTime, default=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="quick_commands")


class CommandPreset(Base):
    """Пресеты команд (последовательность команд)"""
    __tablename__ = "command_presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Название пресета (например, "Пресет 1")
    commands = Column(Text, nullable=False)  # JSON массив команд или многострочный текст
    button_number = Column(Integer, nullable=True)  # Номер кнопки (1, 2, 3...)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="command_presets")


class TwoFactorAttempt(Base):
    """Попытки ввода 2FA кодов (для защиты от brute-force)"""
    __tablename__ = "two_factor_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, index=True)  # Username пользователя
    attempt_time = Column(DateTime, default=utcnow, nullable=False)
    success = Column(Boolean, default=False)  # Успешная попытка или нет
    ip_address = Column(String, nullable=True)  # IP адрес для дополнительной безопасности


class ScheduledCommand(Base):
    """Отложенные команды для выполнения в определенное время"""
    __tablename__ = "scheduled_commands"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Название задачи
    commands = Column(Text, nullable=False)  # Команды (многострочный текст)
    scheduled_time = Column(DateTime, nullable=False, index=True)  # Время выполнения (UTC для scheduler)
    display_time = Column(String, nullable=True)  # Время для отображения пользователю (как он ввел)
    status = Column(String, default="pending", nullable=False)  # pending, executing, completed, failed, cancelled
    created_at = Column(DateTime, default=utcnow)
    executed_at = Column(DateTime, nullable=True)  # Когда была выполнена
    error_message = Column(Text, nullable=True)  # Сообщение об ошибке, если не удалось
    
    use_botname = Column(Boolean, default=False)  # Префикс botname:
    delay_between_bots = Column(Integer, default=0)  # Задержка между ботами
    
    # Новое: поддержка групп
    target_type = Column(String, default="servers", nullable=False)  # servers или groups
    
    # Часовой пояс для отображения
    timezone = Column(String, default="UTC", nullable=False)
    
    # Тип повторения: once (один раз), daily (ежедневно), weekly (еженедельно), monthly (ежемесячно), weekly_days (по дням недели)
    recurrence_type = Column(String, default="once", nullable=False)
    
    # Дни недели для recurrence_type='weekly_days' (JSON строка: "[0,2,4]" = Пн, Ср, Пт)
    # 0=Понедельник, 1=Вторник, 2=Среда, 3=Четверг, 4=Пятница, 5=Суббота, 6=Воскресенье
    weekdays = Column(Text, nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", back_populates="scheduled_commands")


class ScheduledCommandServer(Base):
    """Связь между отложенными командами и серверами (many-to-many)"""
    __tablename__ = "scheduled_command_servers"
    
    id = Column(Integer, primary_key=True, index=True)
    scheduled_command_id = Column(Integer, ForeignKey("scheduled_commands.id"), nullable=False)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)  # NULL если это группа
    group_name = Column(String, nullable=True)  # Название группы (если это группа)


class SchedulerSettings(Base):
    """Настройки scheduler (глобальные для всей системы)"""
    __tablename__ = "scheduler_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    check_interval = Column(Integer, default=5, nullable=False)  # Интервал проверки в секундах
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class CommandImage(Base):
    """Изображения, полученные от ботов в ответ на команды"""
    __tablename__ = "command_images"
    
    id = Column(Integer, primary_key=True, index=True)
    command_history_id = Column(Integer, ForeignKey("command_history.id"), nullable=False, unique=True)
    image_data = Column(Text, nullable=False)  # Base64 encoded JPEG
    created_at = Column(DateTime, default=utcnow)
    
    # Связь с историей команд
    command_history = relationship("CommandHistory", back_populates="image")


class SQLCommandLog(Base):
    """Лог SQL команд от MoonBot (постоянное прослушивание)"""
    __tablename__ = "sql_command_log"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    command_id = Column(Integer, nullable=False, index=True)  # ID от MoonBot [SQLCommand 86516]
    sql_text = Column(Text, nullable=False)  # Полный текст SQL команды
    received_at = Column(DateTime, default=utcnow, index=True)
    processed = Column(Boolean, default=False)  # Обработана ли команда
    
    server = relationship("Server")


class MoonBotOrder(Base):
    """Ордера от MoonBot (распарсенные из SQL команд)"""
    __tablename__ = "moonbot_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    moonbot_order_id = Column(Integer, nullable=False, index=True)  # ID ордера в MoonBot [ID]
    
    # Основные данные ордера
    symbol = Column(String, nullable=True, index=True)  # Тикер (BTC, ETH...) - nullable для совместимости
    buy_price = Column(Float)
    sell_price = Column(Float)
    quantity = Column(Float)
    status = Column(String, nullable=False, default="Open", index=True)  # Open, Closed, Cancelled
    
    # Финансовые показатели
    spent_btc = Column(Float)  # Потрачено BTC
    gained_btc = Column(Float)  # Получено BTC
    profit_btc = Column(Float)  # Профит в BTC
    profit_percent = Column(Float)  # Профит в процентах
    
    # Дополнительная информация
    sell_reason = Column(Text)  # Причина закрытия
    strategy = Column(String)  # Название стратегии
    
    # === ВРЕМЕННЫЕ МЕТКИ (из Moonbot) ===
    buy_date = Column(Integer)  # BuyDate - timestamp Unix
    sell_set_date = Column(Integer)  # SellSetDate - timestamp Unix
    close_date = Column(Integer)  # CloseDate - timestamp Unix (0 = открыт)
    
    # === МЕТАДАННЫЕ И ИСТОЧНИКИ ===
    source = Column(Integer)  # Source
    channel = Column(Integer)  # Channel
    channel_name = Column(String)  # ChannelName
    comment = Column(Text)  # Comment - КРИТИЧНО для определения стратегии!
    strategy_id = Column(Integer)  # StrategyID
    base_currency = Column(Integer)  # BaseCurrency (0=USDT, 1=BTC и т.д.)
    
    # === РАСШИРЕННЫЕ МЕТРИКИ (из SQL логов Moonbot) ===
    is_emulator = Column(Boolean, default=False, index=True)  # Эмулятор или реальный
    emulator = Column(Integer, default=0)  # Emulator (0/1) - дублирует is_emulator для совместимости
    signal_type = Column(String)  # Тип сигнала
    safety_orders_used = Column(Integer)  # Сколько Safety Orders использовано
    latency = Column(Integer)  # Задержка в мс
    ping = Column(Integer)  # Пинг к бирже в мс
    task_id = Column(Integer)  # ID задачи Moonbot
    bought_so = Column(Integer)  # BoughtSO
    btc_in_delta = Column(Float)  # BTCInDelta
    price_blow = Column(Boolean)  # PriceBlow
    daily_vol = Column(String)  # DailyVol
    ex_order_id = Column(String)  # exOrderID - ID на бирже
    
    # === ФАЙЛЫ И СОСТОЯНИЕ ===
    fname = Column(String)  # FName - имя файла резервной копии
    deleted = Column(Integer, default=0)  # deleted
    imp = Column(Integer, default=0)  # Imp
    
    # === РЫНОЧНЫЕ ДАННЫЕ (дополнительные дельты) ===
    bought_q = Column(Float)  # BoughtQ
    btc_1h_delta = Column(Float)  # BTC1hDelta
    btc_24h_delta = Column(Float)  # BTC24hDelta
    btc_5m_delta = Column(Float)  # BTC5mDelta
    dbtc_1m = Column(Float)  # dBTC1m
    exchange_1h_delta = Column(Float)  # Изменение цены за 1ч
    exchange_24h_delta = Column(Float)  # Изменение цены за 24ч
    
    # === PUMP & DUMP ===
    pump_1h = Column(Float, default=0)  # Pump1H
    dump_1h = Column(Float, default=0)  # Dump1H
    
    # === ДЕТАЛЬНЫЕ ДЕЛЬТЫ ===
    d24h = Column(Float, default=0)  # d24h
    d3h = Column(Float, default=0)  # d3h
    d1h = Column(Float, default=0)  # d1h
    d15m = Column(Float, default=0)  # d15m
    d5m = Column(Float, default=0)  # d5m
    d1m = Column(Float, default=0)  # d1m
    
    # === ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ ===
    price_bug = Column(Float, default=0)  # PriceBug
    vd1m = Column(Float, default=0)  # Vd1m (Volume delta 1m)
    lev = Column(Integer, default=1)  # Lev - плечо (leverage)
    bvsv_ratio = Column(Float, default=0)  # bvsvRatio
    is_short = Column(Integer, default=0)  # IsShort (шорт позиция)
    
    # === ОБЪЁМЫ ===
    hvol = Column(Float, default=0)  # hVol
    hvolf = Column(Float, default=0)  # hVolF
    dvol = Column(Float, default=0)  # dVol
    
    # === ВРЕМЕННЫЕ МЕТКИ (наши, для удобства) ===
    opened_at = Column(DateTime)  # datetime из buy_date
    closed_at = Column(DateTime)  # datetime из close_date
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    # === ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ (наши) ===
    created_from_update = Column(Boolean, default=False)  # Флаг: ордер создан из UPDATE (пришел раньше INSERT)
    bot_name = Column(String, nullable=True, index=True)  # Название бота
    
    # Связи
    server = relationship("Server")
    
    # Индекс для быстрого поиска ордера конкретного сервера
    __table_args__ = (
        # Уникальность: один moonbot_order_id на один server
        # (у разных серверов могут быть одинаковые ID)
        Index('idx_server_order', 'server_id', 'moonbot_order_id', unique=True),
    )


class UDPListenerStatus(Base):
    """Статус UDP Listener для каждого сервера"""
    __tablename__ = "udp_listener_status"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False, unique=True)
    is_running = Column(Boolean, default=False)  # Запущен ли listener
    started_at = Column(DateTime)  # Когда запущен
    last_message_at = Column(DateTime)  # Когда последнее сообщение получено
    messages_received = Column(Integer, default=0)  # Количество полученных сообщений
    last_error = Column(String)  # Последняя ошибка
    
    server = relationship("Server")


class CleanupSettings(Base):
    """Настройки автоматической очистки данных"""
    __tablename__ = "cleanup_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    enabled = Column(Boolean, default=False)
    trigger_type = Column(String, default="time")  # time, disk, combined
    days_to_keep = Column(Integer, default=30)
    disk_threshold_percent = Column(Integer, default=80)
    
    # Гибкий выбор что очищать автоматически
    auto_cleanup_sql_logs = Column(Boolean, default=True)
    auto_cleanup_command_history = Column(Boolean, default=True)
    auto_cleanup_backend_logs = Column(Boolean, default=False)
    backend_logs_max_size_mb = Column(Integer, default=10)  # Обрезать до N МБ
    
    # Дополнительные опции для 3000+ серверов
    auto_cleanup_api_errors = Column(Boolean, default=True)  # Очистка ошибок API
    auto_cleanup_charts = Column(Boolean, default=True)  # Очистка графиков
    auto_cleanup_strategy_cache = Column(Boolean, default=True)  # Очистка кэша стратегий
    api_errors_days = Column(Integer, default=7)  # Хранить ошибки N дней
    charts_days = Column(Integer, default=14)  # Хранить графики N дней
    strategy_cache_days = Column(Integer, default=7)  # Хранить кэш стратегий N дней
    
    last_cleanup = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    user = relationship("User")


class ServerBalance(Base):
    """Текущий баланс сервера (обновляется раз в 5 сек)"""
    __tablename__ = "server_balance"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False, unique=True)
    bot_name = Column(String, nullable=True)
    available = Column(Float, default=0.0)  # Доступный баланс (A)
    total = Column(Float, default=0.0)      # Всего баланс (T)
    is_running = Column(Boolean, nullable=True)  # Запущен ли бот (S)
    version = Column(Integer, nullable=True)  # Номер версии MoonBot (V, без точки, например 756)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    
    server = relationship("Server")


class StrategyCache(Base):
    """Кэш стратегий с сервера"""
    __tablename__ = "strategy_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    pack_number = Column(Integer, default=1)  # Номер пакета (если много стратегий)
    bot_name = Column(String, nullable=True)
    data = Column(Text, nullable=False)  # Текст стратегий
    received_at = Column(DateTime, default=utcnow)
    
    server = relationship("Server")
    
    # Композитный индекс для быстрого поиска
    __table_args__ = (
        Index('ix_strategy_cache_server_pack', 'server_id', 'pack_number'),
    )


class MoonBotAPIError(Base):
    """
    Ошибки API от MoonBot
    
    Формат от бота: {"cmd":"errors","bot":"BotName","data":{"E":[...]}}
    """
    __tablename__ = "moonbot_api_errors"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    bot_name = Column(String, nullable=True)
    error_text = Column(Text, nullable=False)  # Текст ошибки
    error_time = Column(DateTime, nullable=True)  # Время ошибки из текста (парсится)
    symbol = Column(String, nullable=True)  # Символ (парсится из текста)
    error_code = Column(Integer, nullable=True)  # Код ошибки [400], [500] и т.д.
    received_at = Column(DateTime, default=utcnow)
    
    server = relationship("Server")
    
    __table_args__ = (
        Index('ix_moonbot_api_errors_server_received', 'server_id', 'received_at'),
    )


class MoonBotChart(Base):
    """
    Данные графика от MoonBot
    
    Хранит бинарные данные графиков для визуализации сделок
    """
    __tablename__ = "moonbot_charts"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    order_db_id = Column(Integer, nullable=False)  # ID ордера в БД MoonBot
    market_name = Column(String, nullable=True)  # Название рынка (символ)
    market_currency = Column(String, nullable=True)  # Валюта
    pump_channel = Column(String, nullable=True)  # Канал пампа
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    session_profit = Column(Float, nullable=True)  # Профит сессии
    chart_data = Column(Text, nullable=True)  # JSON с данными графика (история цен, свечи и т.д.)
    raw_data = Column(Text, nullable=True)  # Base64 закодированные сырые данные (опционально)
    received_at = Column(DateTime, default=utcnow)
    
    server = relationship("Server")
    
    __table_args__ = (
        Index('ix_moonbot_charts_server_order', 'server_id', 'order_db_id'),
    )

