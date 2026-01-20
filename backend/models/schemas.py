from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# User Schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    username: Optional[str] = None  # Для 2FA flow


class TokenData(BaseModel):
    username: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class RegisterResponse(BaseModel):
    user: User
    recovery_codes: List[str]


class PasswordRecovery(BaseModel):
    username: str = Field(..., min_length=3)
    recovery_code: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class TwoFactorSetup(BaseModel):
    pass


class TwoFactorVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorRecovery(BaseModel):
    username: str = Field(..., min_length=3)
    totp_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)


class TwoFactorLogin(BaseModel):
    """Вход с двухфакторной аутентификацией"""
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)
    totp_code: str = Field(..., min_length=6, max_length=6)


# Server Schemas
class ServerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(..., ge=1, le=65535)
    password: Optional[str] = None  # UDP пароль для HMAC-SHA256
    description: Optional[str] = Field(None, max_length=500)  # ИСПРАВЛЕНО: Ограничение длины
    group_name: Optional[str] = Field(None, max_length=200)  # Группы через запятую
    keepalive_enabled: bool = True  # Включен ли keep-alive
    is_localhost: bool = False  # Разрешить localhost/127.0.0.1
    


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    host: Optional[str] = Field(None, min_length=1, max_length=255)
    port: Optional[int] = Field(None, ge=1, le=65535)
    password: Optional[str] = None  # UDP пароль
    description: Optional[str] = Field(None, max_length=500)  # ИСПРАВЛЕНО: Ограничение длины
    group_name: Optional[str] = Field(None, max_length=200)  # Группы через запятую
    is_active: Optional[bool] = None
    keepalive_enabled: Optional[bool] = None  # Включен ли keep-alive
    is_localhost: Optional[bool] = None  # Разрешить localhost


class Server(ServerBase):
    id: int
    is_active: bool
    is_localhost: bool
    created_at: datetime
    updated_at: datetime
    user_id: int
    group_name: Optional[str] = None
    password: Optional[str] = None  # UDP пароль
    keepalive_enabled: bool = True
    default_currency: Optional[str] = 'USDT'  # Базовая валюта сервера

    class Config:
        from_attributes = True


# Command Schemas
class CommandRequest(BaseModel):
    server_id: int
    command: str = Field(..., min_length=1)
    timeout: Optional[int] = Field(default=5, ge=1, le=30)


class BulkCommandRequest(BaseModel):
    server_ids: List[int]
    command: str = Field(..., min_length=1)
    timeout: Optional[int] = Field(default=5, ge=1, le=30)


class CommandResponse(BaseModel):
    command: str
    response: Optional[str]
    status: str
    execution_time: datetime
    server_name: str


class CommandHistory(BaseModel):
    id: int
    command: str
    response: Optional[str]
    status: str
    execution_time: datetime
    server_id: int

    class Config:
        from_attributes = True


# Stats
class ServerStats(BaseModel):
    total_servers: int
    active_servers: int
    total_commands: int
    successful_commands: int
    failed_commands: int


# Quick Command Schemas
class QuickCommandBase(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    command: str = Field(..., min_length=1, max_length=500)
    order: Optional[int] = 0


class QuickCommandCreate(QuickCommandBase):
    pass


class QuickCommandUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    command: Optional[str] = Field(None, min_length=1, max_length=500)
    order: Optional[int] = None


class QuickCommand(QuickCommandBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Command Preset Schemas
class CommandPresetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    commands: str = Field(..., min_length=1)  # JSON массив или многострочный текст
    button_number: Optional[int] = None


class CommandPresetCreate(CommandPresetBase):
    pass


class CommandPresetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    commands: Optional[str] = Field(None, min_length=1)
    button_number: Optional[int] = None


class CommandPreset(CommandPresetBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Bot Command Reference
class BotCommand(BaseModel):
    """Справочная информация о команде бота"""
    command: str
    description: str
    category: str
    example: Optional[str] = None


# User Settings Schemas
class UserSettingsBase(BaseModel):
    # FIXED: Increased max to 3600 (1 hour) to match UserSettingsUpdate
    # REASONING: le=300 (5 min) was causing validation errors on GET response!
    # When ping_interval=3060 in DB, GET /api/user/settings would fail with 500
    ping_interval: int = Field(default=30, ge=5, le=3600)  # From 5 to 3600 seconds
    enable_notifications: bool = True
    notification_sound: bool = True
    backend_log_level: int = Field(default=2, ge=1, le=3)  # 1-критические, 2-неполное, 3-полное


class UserSettingsUpdate(BaseModel):
    # Увеличен максимум до 3600 (1 час) для гибкости настройки
    ping_interval: Optional[int] = Field(None, ge=5, le=3600)
    enable_notifications: Optional[bool] = None
    notification_sound: Optional[bool] = None
    backend_log_level: Optional[int] = Field(None, ge=1, le=3)  # 1-критические, 2-неполное, 3-полное


class UserSettings(UserSettingsBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Server Status Schemas
class ServerStatusBase(BaseModel):
    is_online: bool
    last_ping: Optional[datetime] = None
    response_time: Optional[float] = None
    last_error: Optional[str] = None
    uptime_percentage: float = 100.0
    consecutive_failures: int = 0


class ServerStatus(ServerStatusBase):
    id: int
    server_id: int

    class Config:
        from_attributes = True


# Dashboard Statistics
class DashboardStats(BaseModel):
    """Статистика для дашборда"""
    total_servers: int
    online_servers: int
    offline_servers: int
    total_commands_today: int
    successful_commands_today: int
    failed_commands_today: int
    avg_response_time: Optional[float] = None
    total_commands_all_time: int


class ServerWithStatus(Server):
    """Сервер со статусом"""
    status: Optional[ServerStatus] = None


class CommandStatsDaily(BaseModel):
    """Статистика команд по дням"""
    date: str
    count: int
    successful: int
    failed: int


class ServerUptime(BaseModel):
    """Uptime сервера"""
    server_id: int
    server_name: str
    uptime_percentage: float
    is_online: bool
    last_ping: Optional[datetime]


# Scheduled Command Schemas
class ScheduledCommandCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    commands: str = Field(..., min_length=1)
    scheduled_time: datetime  # Время выполнения (UTC)
    display_time: str  # Время для отображения (как ввел пользователь)
    timezone: str = Field(default="UTC")  # Часовой пояс пользователя
    target_type: str = Field(default="servers", pattern="^(servers|groups)$")  # servers или groups
    server_ids: List[int] = Field(default_factory=list)  # ID серверов (если target_type=servers)
    group_ids: List[str] = Field(default_factory=list)  # Названия групп (если target_type=groups)
    use_botname: bool = False
    delay_between_bots: int = Field(default=0, ge=0, le=3600)
    recurrence_type: str = Field(default="once", pattern="^(once|daily|weekly|monthly|weekly_days)$")  # Тип повторения
    weekdays: Optional[List[int]] = Field(default=None, description="Дни недели для weekly_days: [0-6], где 0=Пн, 6=Вс")


class ScheduledCommandUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    commands: Optional[str] = Field(None, min_length=1)
    scheduled_time: Optional[datetime] = None
    display_time: Optional[str] = None  # Время для отображения
    timezone: Optional[str] = None
    target_type: Optional[str] = Field(None, pattern="^(servers|groups)$")
    server_ids: Optional[List[int]] = None
    group_ids: Optional[List[str]] = None  # Названия групп (строки)
    use_botname: Optional[bool] = None
    delay_between_bots: Optional[int] = Field(None, ge=0, le=3600)
    recurrence_type: Optional[str] = Field(None, pattern="^(once|daily|weekly|monthly|weekly_days)$")
    weekdays: Optional[List[int]] = Field(None, description="Дни недели для weekly_days: [0-6]")


class ScheduledCommand(BaseModel):
    id: int
    name: str
    commands: str
    scheduled_time: datetime
    display_time: Optional[str]
    status: str  # pending, executing, completed, failed, cancelled
    created_at: datetime
    executed_at: Optional[datetime]
    error_message: Optional[str]
    use_botname: bool
    delay_between_bots: int
    target_type: str
    timezone: str
    user_id: int
    recurrence_type: str = "once"  # once, daily, weekly, monthly, weekly_days
    weekdays: Optional[str] = None  # JSON строка для БД: "[0,2,4]"
    
    class Config:
        from_attributes = True


class ScheduledCommandWithServers(ScheduledCommand):
    server_ids: List[int] = []  # Список ID серверов
    group_ids: List[str] = []  # Список названий групп


# Scheduler Settings Schemas
class SchedulerSettings(BaseModel):
    id: int
    check_interval: int
    updated_at: datetime
    enabled: bool = False  # По умолчанию ВЫКЛЮЧЕН
    
    class Config:
        from_attributes = True
        # Игнорируем extra поля при создании из ORM
        extra = "ignore"


class SchedulerSettingsUpdate(BaseModel):
    check_interval: Optional[int] = Field(None, ge=1, le=60, description="Интервал проверки от 1 до 60 секунд")
    enabled: Optional[bool] = Field(None, description="Включен ли scheduler")


# System Reset Schema
class SystemResetRequest(BaseModel):
    code: str = Field(..., description="Код доступа для сброса системы")


# ==================== V2.0 SCHEMAS ====================

# Алиасы для совместимости с роутерами v2.0
UserResponse = User  # Используем существующий класс User
CommandExecute = CommandRequest  # Алиас для CommandRequest


class ServerResponse(BaseModel):
    """Ответ с информацией о сервере"""
    id: int
    name: str
    host: str
    port: int
    description: Optional[str] = None
    group_name: Optional[str] = None
    is_active: bool
    keepalive_enabled: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    user_id: int
    
    class Config:
        from_attributes = True


class CommandExecutionResponse(BaseModel):
    """Результат выполнения команды"""
    success: bool
    response: Optional[str] = None
    execution_time: float  # в миллисекундах
    history_id: int


class CommandHistoryResponse(BaseModel):
    """История команд"""
    id: int
    command: str
    response: Optional[str] = None
    status: str
    execution_time: datetime
    response_time_ms: Optional[float] = None
    server_id: int
    
    class Config:
        from_attributes = True


