"""
Реестр миграций по версиям.

Содержит методы регистрации миграций для каждой версии приложения.
Этот модуль используется как mixin для VersionedMigrationSystem.
"""

from .migration_base import Migration


class MigrationRegistryMixin:
    """
    Mixin с методами регистрации миграций по версиям.
    
    Наследуется классом VersionedMigrationSystem.
    """
    
    def _register_v1_migrations(self):
        """Миграции для версии 1.x"""
        
        # v1.1.0 - Добавление паролей
        self._register_migration(Migration(
            version="1.1.0",
            name="add_server_password",
            description="Добавление поля password для серверов (HMAC-SHA256)",
            up=self._migrate_add_password,
            check=lambda conn: not self._column_exists(conn, "servers", "password"),
        ))
        
        # v1.2.0 - Keep-alive
        self._register_migration(Migration(
            version="1.2.0",
            name="add_keepalive",
            description="Добавление keep-alive для серверов",
            up=self._migrate_add_keepalive,
            check=lambda conn: not self._column_exists(conn, "servers", "keepalive_enabled"),
        ))
    
    def _register_v2_0_migrations(self):
        """Миграции для версии 2.0.x"""
        
        # v2.0.0 - Двухфакторная аутентификация
        self._register_migration(Migration(
            version="2.0.0",
            name="add_2fa",
            description="Добавление двухфакторной аутентификации",
            up=self._migrate_add_2fa,
            check=lambda conn: not self._column_exists(conn, "users", "totp_secret"),
        ))
        
        # v2.0.0 - Recovery коды
        self._register_migration(Migration(
            version="2.0.0",
            name="add_recovery_codes",
            description="Добавление recovery кодов для 2FA",
            up=self._migrate_add_recovery_codes,
            check=lambda conn: not self._table_exists(conn, "recovery_codes"),
            dependencies=["add_2fa"],
        ))
        
        # v2.0.0 - UDP Listener
        self._register_migration(Migration(
            version="2.0.0",
            name="add_udp_listener",
            description="Добавление UDP Listener для приёма данных",
            up=self._migrate_add_udp_listener,
            check=lambda conn: not self._table_exists(conn, "udp_listener_status"),
        ))
        
        # v2.0.0 - Балансы и стратегии
        self._register_migration(Migration(
            version="2.0.0",
            name="add_balance_and_strategies",
            description="Добавление таблиц балансов и стратегий",
            up=self._migrate_add_balance_and_strategies,
            check=lambda conn: not self._table_exists(conn, "server_balance"),
        ))
        
        # v2.0.0 - Расширенный планировщик
        self._register_migration(Migration(
            version="2.0.0",
            name="add_scheduled_commands_full",
            description="Расширенный планировщик команд",
            up=self._migrate_add_scheduled_commands_full,
            check=lambda conn: not self._table_exists(conn, "scheduled_commands"),
        ))
        
        # v2.0.0 - Настройки планировщика
        self._register_migration(Migration(
            version="2.0.0",
            name="add_scheduler_settings",
            description="Настройки планировщика",
            up=self._migrate_add_scheduler_settings,
            check=lambda conn: not self._table_exists(conn, "scheduler_settings"),
        ))
        
        # v2.0.0 - Часовые пояса
        self._register_migration(Migration(
            version="2.0.0",
            name="add_timezone",
            description="Поддержка часовых поясов",
            up=self._migrate_add_timezone,
            check=lambda conn: not self._column_exists(conn, "scheduled_commands", "timezone"),
            dependencies=["add_scheduled_commands_full"],
        ))
        
        # v2.0.0 - Display time
        self._register_migration(Migration(
            version="2.0.0",
            name="add_display_time",
            description="Время отображения для команд",
            up=self._migrate_add_display_time,
            check=lambda conn: not self._column_exists(conn, "scheduled_commands", "display_time"),
            dependencies=["add_scheduled_commands_full"],
        ))
        
        # v2.0.0 - Настройки очистки
        self._register_migration(Migration(
            version="2.0.0",
            name="add_cleanup_settings",
            description="Настройки автоматической очистки",
            up=self._migrate_add_cleanup_settings,
            check=lambda conn: not self._table_exists(conn, "cleanup_settings"),
        ))
        
        # v2.0.0 - MoonBot Orders
        self._register_migration(Migration(
            version="2.0.0",
            name="add_moonbot_orders",
            description="Таблица ордеров MoonBot",
            up=self._migrate_add_moonbot_orders,
            check=lambda conn: not self._table_exists(conn, "moonbot_orders"),
        ))
    
    def _register_v2_1_migrations(self):
        """Миграции для версии 2.1.x"""
        
        # v2.1.0 - Расширенные поля баланса
        self._register_migration(Migration(
            version="2.1.0",
            name="add_balance_fields",
            description="Поля is_running и version в балансах",
            up=self._migrate_add_balance_fields,
            check=lambda conn: not self._column_exists(conn, "server_balance", "is_running"),
            dependencies=["add_balance_and_strategies"],
        ))
        
        # v2.1.0 - Повторяющиеся команды
        self._register_migration(Migration(
            version="2.1.0",
            name="add_recurrence_weekdays",
            description="Повторяющиеся команды по дням недели",
            up=self._migrate_add_recurrence_weekdays,
            check=lambda conn: not self._column_exists(conn, "scheduled_commands", "weekdays"),
            dependencies=["add_scheduled_commands_full"],
        ))
        
        # v2.1.0 - Localhost соединения
        self._register_migration(Migration(
            version="2.1.0",
            name="add_is_localhost",
            description="Поддержка localhost соединений",
            up=self._migrate_add_is_localhost,
            check=lambda conn: not self._column_exists(conn, "servers", "is_localhost"),
        ))
        
        # v2.1.2 - Мультивалютность
        self._register_migration(Migration(
            version="2.1.2",
            name="add_default_currency",
            description="Мультивалютная поддержка",
            up=self._migrate_add_default_currency,
            check=lambda conn: not self._column_exists(conn, "servers", "default_currency"),
        ))
        
        # v2.1.2 - Расширенные поля ордеров
        self._register_migration(Migration(
            version="2.1.2",
            name="add_moonbot_orders_extended",
            description="Расширенная информация об ордерах",
            up=self._migrate_add_moonbot_orders_extended,
            check=lambda conn: not self._column_exists(conn, "moonbot_orders", "created_from_update"),
            dependencies=["add_moonbot_orders"],
        ))
        
        # v2.1.3 - Расширенные настройки очистки
        self._register_migration(Migration(
            version="2.1.3",
            name="add_cleanup_settings_v2",
            description="Расширенные настройки очистки",
            up=self._migrate_add_cleanup_settings_v2,
            check=lambda conn: not self._column_exists(conn, "cleanup_settings", "auto_cleanup_sql_logs"),
            dependencies=["add_cleanup_settings"],
        ))
        
        # v2.1.5 - Графики MoonBot
        self._register_migration(Migration(
            version="2.1.5",
            name="add_moonbot_charts",
            description="Таблица графиков MoonBot",
            up=self._migrate_add_moonbot_charts,
            check=lambda conn: not self._table_exists(conn, "moonbot_charts"),
        ))
        
        # v2.1.8 - Время просмотра ошибок
        self._register_migration(Migration(
            version="2.1.8",
            name="add_last_errors_viewed_at",
            description="Время последнего просмотра ошибок API",
            up=self._migrate_add_last_errors_viewed_at,
            check=lambda conn: not self._column_exists(conn, "user_settings", "last_errors_viewed_at"),
        ))


