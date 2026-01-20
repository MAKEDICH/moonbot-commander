"""
Модели базы данных версия 2.0
Оптимизированы для масштабирования с улучшенными индексами
"""
from models.database import Base
import sys
from datetime import datetime
from pathlib import Path

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float, Index, UniqueConstraint
from sqlalchemy.orm import relationship

BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))


class SchemaVersion(Base):
    """Версия схемы базы данных"""
    __tablename__ = "schema_versions"

    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, nullable=False, unique=True)  # Например, "2.0.0"
    applied_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    description = Column(Text)

    __table_args__ = (
        Index('idx_schema_version', 'version'),
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    totp_secret = Column(String(32), nullable=True)
    totp_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    # Для масштабирования
    last_login = Column(DateTime)
    login_count = Column(Integer, default=0)

    servers = relationship("Server", back_populates="owner",
                           cascade="all, delete-orphan", lazy="selectin")
    command_history = relationship(
        "CommandHistory", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")
    quick_commands = relationship(
        "QuickCommand", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    command_presets = relationship(
        "CommandPreset", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    user_settings = relationship("UserSettings", back_populates="user",
                                 uselist=False, cascade="all, delete-orphan", lazy="selectin")
    recovery_codes = relationship(
        "RecoveryCode", back_populates="user", cascade="all, delete-orphan", lazy="selectin")
    scheduled_commands = relationship(
        "ScheduledCommand", back_populates="user", cascade="all, delete-orphan", lazy="dynamic")

    __table_args__ = (
        Index('idx_user_active', 'is_active'),
        Index('idx_user_email_active', 'email', 'is_active'),
    )


class RecoveryCode(Base):
    """Recovery коды для восстановления доступа"""
    __tablename__ = "recovery_codes"

    id = Column(Integer, primary_key=True, index=True)
    code_hash = Column(String(255), nullable=False)
    used = Column(Boolean, default=False, index=True)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="recovery_codes")

    __table_args__ = (
        Index('idx_recovery_user_used', 'user_id', 'used'),
    )


class UserSettings(Base):
    """Настройки пользователя"""
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    ping_interval = Column(Integer, default=30)
    enable_notifications = Column(Boolean, default=True)
    notification_sound = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, unique=True)
    user = relationship("User", back_populates="user_settings")


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    password = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    group_name = Column(String(100), nullable=True, index=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner = relationship("User", back_populates="servers")
    command_history = relationship(
        "CommandHistory", back_populates="server", cascade="all, delete-orphan", lazy="dynamic")
    server_status = relationship("ServerStatus", back_populates="server",
                                 uselist=False, cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index('idx_server_user_active', 'user_id', 'is_active'),
        Index('idx_server_group', 'group_name', 'user_id'),
        Index('idx_server_host_port', 'host', 'port'),
    )


class ServerStatus(Base):
    """Текущий статус сервера"""
    __tablename__ = "server_status"

    id = Column(Integer, primary_key=True, index=True)
    is_online = Column(Boolean, default=False, index=True)
    last_ping = Column(DateTime, nullable=True, index=True)
    response_time = Column(Float, nullable=True)
    last_error = Column(Text, nullable=True)
    uptime_percentage = Column(Float, default=100.0)
    consecutive_failures = Column(Integer, default=0)

    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    server = relationship("Server", back_populates="server_status")

    __table_args__ = (
        Index('idx_server_status_online', 'is_online', 'last_ping'),
    )


class CommandHistory(Base):
    __tablename__ = "command_history"

    id = Column(Integer, primary_key=True, index=True)
    command = Column(Text, nullable=False)
    response = Column(Text, nullable=True)
    # success, error, timeout
    status = Column(String(20), nullable=False, index=True)
    execution_time = Column(
        DateTime, default=datetime.utcnow, nullable=False, index=True)
    response_time_ms = Column(Float)  # Время выполнения в миллисекундах

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=False, index=True)

    user = relationship("User", back_populates="command_history")
    server = relationship("Server", back_populates="command_history")
    image = relationship("CommandImage", back_populates="command_history",
                         uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_cmd_history_user_time', 'user_id', 'execution_time'),
        Index('idx_cmd_history_server_time', 'server_id', 'execution_time'),
        Index('idx_cmd_history_status_time', 'status', 'execution_time'),
    )


class QuickCommand(Base):
    """Быстрые команды пользователя"""
    __tablename__ = "quick_commands"

    id = Column(Integer, primary_key=True, index=True)
    label = Column(String(255), nullable=False)
    command = Column(String(1000), nullable=False)
    order = Column(Integer, default=0, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    usage_count = Column(Integer, default=0)  # Счетчик использования
    last_used = Column(DateTime)  # Последнее использование

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="quick_commands")

    __table_args__ = (
        Index('idx_quick_cmd_user_order', 'user_id', 'order'),
    )


class CommandPreset(Base):
    """Пресеты команд (последовательность команд)"""
    __tablename__ = "command_presets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    commands = Column(Text, nullable=False)
    button_number = Column(Integer, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)
    usage_count = Column(Integer, default=0)
    last_used = Column(DateTime)

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="command_presets")

    __table_args__ = (
        Index('idx_preset_user_button', 'user_id', 'button_number'),
    )


class TwoFactorAttempt(Base):
    """Попытки входа 2FA (для защиты от brute-force)"""
    __tablename__ = "two_factor_attempts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, index=True)
    attempt_time = Column(DateTime, default=datetime.utcnow,
                          nullable=False, index=True)
    success = Column(Boolean, default=False, index=True)
    ip_address = Column(String(45), nullable=True,
                        index=True)  # IPv6 поддержка

    __table_args__ = (
        Index('idx_2fa_user_time', 'username', 'attempt_time'),
        Index('idx_2fa_ip_time', 'ip_address', 'attempt_time'),
    )


class ScheduledCommand(Base):
    """Запланированные команды для выполнения в определённое время"""
    __tablename__ = "scheduled_commands"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    commands = Column(Text, nullable=False)
    scheduled_time = Column(DateTime, nullable=False, index=True)
    display_time = Column(String(100), nullable=True)
    status = Column(String(20), default="pending", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    executed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    use_botname = Column(Boolean, default=False)
    delay_between_bots = Column(Integer, default=0)
    target_type = Column(String(20), default="servers", nullable=False)
    timezone = Column(String(50), default="UTC", nullable=False)

    user_id = Column(Integer, ForeignKey(
        "users.id", ondelete="CASCADE"), nullable=False, index=True)
    user = relationship("User", back_populates="scheduled_commands")

    __table_args__ = (
        Index('idx_sched_status_time', 'status', 'scheduled_time'),
        Index('idx_sched_user_status', 'user_id', 'status'),
    )


class ScheduledCommandServer(Base):
    """Связь между запланированными командами и серверами (many-to-many)"""
    __tablename__ = "scheduled_command_servers"

    id = Column(Integer, primary_key=True, index=True)
    scheduled_command_id = Column(Integer, ForeignKey(
        "scheduled_commands.id", ondelete="CASCADE"), nullable=False, index=True)
    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=True, index=True)  # NULL если это группа
    group_name = Column(String(255), nullable=True)  # Название группы (если это группа)

    __table_args__ = (
        Index('idx_sched_server_link', 'scheduled_command_id', 'server_id'),
    )


class SchedulerSettings(Base):
    """Настройки scheduler (глобальные для всех клиентов)"""
    __tablename__ = "scheduler_settings"

    id = Column(Integer, primary_key=True, index=True)
    check_interval = Column(Integer, default=5, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)


class CommandImage(Base):
    """Изображения, полученные от ботов в ответ на команды"""
    __tablename__ = "command_images"

    id = Column(Integer, primary_key=True, index=True)
    command_history_id = Column(Integer, ForeignKey(
        "command_history.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    image_data = Column(Text, nullable=False)  # Base64 encoded
    image_size = Column(Integer)  # Размер в байтах
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    command_history = relationship("CommandHistory", back_populates="image")


class SQLCommandLog(Base):
    """Лог SQL команд от MoonBot (удаленная синхронизация)"""
    __tablename__ = "sql_command_log"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=False, index=True)
    command_id = Column(Integer, nullable=False, index=True)
    sql_text = Column(Text, nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow,
                         nullable=False, index=True)
    processed = Column(Boolean, default=False, index=True)
    processed_at = Column(DateTime)

    server = relationship("Server")

    __table_args__ = (
        Index('idx_sql_log_server_cmd', 'server_id', 'command_id'),
        Index('idx_sql_log_processed', 'processed', 'received_at'),
        UniqueConstraint('server_id', 'command_id', name='uq_server_command'),
    )


class MoonBotOrder(Base):
    """Ордера от MoonBot (парсятся из SQL команд)"""
    __tablename__ = "moonbot_orders"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=False, index=True)
    moonbot_order_id = Column(Integer, nullable=False, index=True)

    symbol = Column(String(50), nullable=False, index=True)
    buy_price = Column(Float)
    sell_price = Column(Float)
    quantity = Column(Float)
    status = Column(String(20), nullable=False, default="Open", index=True)

    spent_btc = Column(Float)
    gained_btc = Column(Float)
    profit_btc = Column(Float, index=True)
    profit_percent = Column(Float)

    sell_reason = Column(Text)
    strategy = Column(String(100), index=True)
    close_date = Column(DateTime)

    opened_at = Column(DateTime, index=True)
    closed_at = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)

    server = relationship("Server")

    __table_args__ = (
        Index('idx_order_server_moonbot', 'server_id',
              'moonbot_order_id', unique=True),
        Index('idx_order_status_time', 'status', 'closed_at'),
        Index('idx_order_strategy_profit', 'strategy', 'profit_btc'),
        Index('idx_order_symbol_status', 'symbol', 'status'),
    )


class UDPListenerStatus(Base):
    """Статус UDP Listener для каждого сервера"""
    __tablename__ = "udp_listener_status"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey(
        "servers.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    is_running = Column(Boolean, default=False, index=True)
    started_at = Column(DateTime)
    last_message_at = Column(DateTime, index=True)
    messages_received = Column(Integer, default=0)
    last_error = Column(Text)

    server = relationship("Server")

    __table_args__ = (
        Index('idx_listener_running', 'is_running', 'last_message_at'),
    )


class DataBackup(Base):
    """История бэкапов данных"""
    __tablename__ = "data_backups"

    id = Column(Integer, primary_key=True, index=True)
    backup_path = Column(String(500), nullable=False)
    backup_size = Column(Integer)  # Размер в байтах
    created_at = Column(DateTime, default=datetime.utcnow,
                        nullable=False, index=True)
    # manual, automatic, pre-upgrade
    backup_type = Column(String(20), default="manual")
    version = Column(String(20))  # Версия приложения на момент бэкапа
    status = Column(String(20), default="completed")  # completed, failed
    error_message = Column(Text)

    __table_args__ = (
        Index('idx_backup_type_date', 'backup_type', 'created_at'),
    )
