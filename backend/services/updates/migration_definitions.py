"""
Определения всех методов миграций.

Содержит все методы _migrate_* для выполнения конкретных миграций БД.
Этот модуль используется как mixin для VersionedMigrationSystem.
"""

import sqlite3
import logging

logger = logging.getLogger(__name__)


class MigrationDefinitionsMixin:
    """
    Mixin с определениями всех миграций.
    
    Предоставляет методы для выполнения конкретных миграций БД.
    Наследуется классом VersionedMigrationSystem.
    """
    
    def _migrate_add_password(self, conn: sqlite3.Connection) -> bool:
        """Добавление поля password для серверов"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE servers ADD COLUMN password TEXT")
        return True
    
    def _migrate_add_keepalive(self, conn: sqlite3.Connection) -> bool:
        """Добавление keep-alive"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE servers ADD COLUMN keepalive_enabled BOOLEAN DEFAULT TRUE")
        return True
    
    def _migrate_add_2fa(self, conn: sqlite3.Connection) -> bool:
        """Добавление 2FA"""
        cursor = conn.cursor()
        if not self._column_exists(conn, "users", "totp_secret"):
            cursor.execute("ALTER TABLE users ADD COLUMN totp_secret TEXT")
        if not self._column_exists(conn, "users", "totp_enabled"):
            cursor.execute("ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE")
        return True
    
    def _migrate_add_recovery_codes(self, conn: sqlite3.Connection) -> bool:
        """Добавление recovery кодов"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recovery_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code_hash TEXT NOT NULL,
                used BOOLEAN DEFAULT FALSE,
                used_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        return True
    
    def _migrate_add_udp_listener(self, conn: sqlite3.Connection) -> bool:
        """Добавление UDP Listener"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS udp_listener_status (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL UNIQUE,
                is_running BOOLEAN DEFAULT FALSE,
                started_at TIMESTAMP,
                last_message_at TIMESTAMP,
                messages_received INTEGER DEFAULT 0,
                last_error TEXT,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        return True
    
    def _migrate_add_balance_and_strategies(self, conn: sqlite3.Connection) -> bool:
        """Добавление балансов и стратегий"""
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS server_balance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL UNIQUE,
                bot_name TEXT,
                available REAL DEFAULT 0.0,
                total REAL DEFAULT 0.0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS strategy_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                pack_number INTEGER DEFAULT 1,
                bot_name TEXT,
                data TEXT NOT NULL,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        return True
    
    def _migrate_add_scheduled_commands_full(self, conn: sqlite3.Connection) -> bool:
        """Расширенный планировщик команд"""
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_commands (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                commands TEXT NOT NULL,
                scheduled_time TIMESTAMP NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                executed_at TIMESTAMP,
                error_message TEXT,
                use_botname BOOLEAN DEFAULT FALSE,
                delay_between_bots INTEGER DEFAULT 0,
                target_type TEXT DEFAULT 'servers',
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduled_command_servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scheduled_command_id INTEGER NOT NULL,
                server_id INTEGER,
                group_name TEXT,
                FOREIGN KEY (scheduled_command_id) REFERENCES scheduled_commands(id),
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        return True
    
    def _migrate_add_scheduler_settings(self, conn: sqlite3.Connection) -> bool:
        """Настройки планировщика"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scheduler_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                check_interval INTEGER DEFAULT 5,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        return True
    
    def _migrate_add_timezone(self, conn: sqlite3.Connection) -> bool:
        """Часовые пояса"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN timezone TEXT DEFAULT 'UTC'")
        return True
    
    def _migrate_add_display_time(self, conn: sqlite3.Connection) -> bool:
        """Display time"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN display_time TEXT")
        return True
    
    def _migrate_add_cleanup_settings(self, conn: sqlite3.Connection) -> bool:
        """Настройки очистки"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cleanup_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                enabled BOOLEAN DEFAULT FALSE,
                trigger_type TEXT DEFAULT 'time',
                days_to_keep INTEGER DEFAULT 30,
                disk_threshold_percent INTEGER DEFAULT 80,
                last_cleanup TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        return True
    
    def _migrate_add_moonbot_orders(self, conn: sqlite3.Connection) -> bool:
        """Таблица ордеров MoonBot"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moonbot_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                moonbot_order_id INTEGER NOT NULL,
                symbol TEXT,
                buy_price REAL,
                sell_price REAL,
                quantity REAL,
                status TEXT DEFAULT 'Open',
                spent_btc REAL,
                gained_btc REAL,
                profit_btc REAL,
                profit_percent REAL,
                sell_reason TEXT,
                strategy TEXT,
                buy_date INTEGER,
                sell_set_date INTEGER,
                close_date INTEGER,
                source INTEGER,
                channel INTEGER,
                channel_name TEXT,
                comment TEXT,
                strategy_id INTEGER,
                base_currency INTEGER,
                is_emulator BOOLEAN DEFAULT FALSE,
                opened_at TIMESTAMP,
                closed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        # Создаём индекс
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_server_order 
            ON moonbot_orders(server_id, moonbot_order_id)
        """)
        
        return True
    
    def _migrate_add_balance_fields(self, conn: sqlite3.Connection) -> bool:
        """Поля is_running и version в балансах"""
        cursor = conn.cursor()
        if not self._column_exists(conn, "server_balance", "is_running"):
            cursor.execute("ALTER TABLE server_balance ADD COLUMN is_running BOOLEAN")
        if not self._column_exists(conn, "server_balance", "version"):
            cursor.execute("ALTER TABLE server_balance ADD COLUMN version INTEGER")
        return True
    
    def _migrate_add_recurrence_weekdays(self, conn: sqlite3.Connection) -> bool:
        """Повторяющиеся команды"""
        cursor = conn.cursor()
        if not self._column_exists(conn, "scheduled_commands", "recurrence_type"):
            cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN recurrence_type TEXT DEFAULT 'once'")
        if not self._column_exists(conn, "scheduled_commands", "weekdays"):
            cursor.execute("ALTER TABLE scheduled_commands ADD COLUMN weekdays TEXT")
        return True
    
    def _migrate_add_is_localhost(self, conn: sqlite3.Connection) -> bool:
        """Localhost соединения"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE servers ADD COLUMN is_localhost BOOLEAN DEFAULT FALSE")
        return True
    
    def _migrate_add_default_currency(self, conn: sqlite3.Connection) -> bool:
        """Мультивалютность"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE servers ADD COLUMN default_currency TEXT DEFAULT 'USDT'")
        return True
    
    def _migrate_add_moonbot_orders_extended(self, conn: sqlite3.Connection) -> bool:
        """Расширенные поля ордеров"""
        cursor = conn.cursor()
        
        extended_fields = [
            ("created_from_update", "BOOLEAN DEFAULT FALSE"),
            ("bot_name", "TEXT"),
            ("emulator", "INTEGER DEFAULT 0"),
            ("signal_type", "TEXT"),
            ("safety_orders_used", "INTEGER"),
            ("latency", "INTEGER"),
            ("ping", "INTEGER"),
            ("task_id", "INTEGER"),
            ("bought_so", "INTEGER"),
            ("btc_in_delta", "REAL"),
            ("price_blow", "BOOLEAN"),
            ("daily_vol", "TEXT"),
            ("ex_order_id", "TEXT"),
            ("fname", "TEXT"),
            ("deleted", "INTEGER DEFAULT 0"),
            ("imp", "INTEGER DEFAULT 0"),
            ("bought_q", "REAL"),
            ("btc_1h_delta", "REAL"),
            ("btc_24h_delta", "REAL"),
            ("btc_5m_delta", "REAL"),
            ("dbtc_1m", "REAL"),
            ("exchange_1h_delta", "REAL"),
            ("exchange_24h_delta", "REAL"),
            ("pump_1h", "REAL DEFAULT 0"),
            ("dump_1h", "REAL DEFAULT 0"),
            ("d24h", "REAL DEFAULT 0"),
            ("d3h", "REAL DEFAULT 0"),
            ("d1h", "REAL DEFAULT 0"),
            ("d15m", "REAL DEFAULT 0"),
            ("d5m", "REAL DEFAULT 0"),
            ("d1m", "REAL DEFAULT 0"),
            ("price_bug", "REAL DEFAULT 0"),
            ("vd1m", "REAL DEFAULT 0"),
            ("lev", "INTEGER DEFAULT 1"),
            ("bvsv_ratio", "REAL DEFAULT 0"),
            ("is_short", "INTEGER DEFAULT 0"),
            ("hvol", "REAL DEFAULT 0"),
            ("hvolf", "REAL DEFAULT 0"),
            ("dvol", "REAL DEFAULT 0"),
        ]
        
        for field_name, field_def in extended_fields:
            if not self._column_exists(conn, "moonbot_orders", field_name):
                try:
                    cursor.execute(f"ALTER TABLE moonbot_orders ADD COLUMN {field_name} {field_def}")
                except Exception as e:
                    logger.warning(f"Не удалось добавить поле {field_name}: {e}")
        
        return True
    
    def _migrate_add_cleanup_settings_v2(self, conn: sqlite3.Connection) -> bool:
        """Расширенные настройки очистки"""
        cursor = conn.cursor()
        
        fields = [
            ("auto_cleanup_sql_logs", "BOOLEAN DEFAULT TRUE"),
            ("auto_cleanup_command_history", "BOOLEAN DEFAULT TRUE"),
            ("auto_cleanup_backend_logs", "BOOLEAN DEFAULT FALSE"),
            ("backend_logs_max_size_mb", "INTEGER DEFAULT 10"),
        ]
        
        for field_name, field_def in fields:
            if not self._column_exists(conn, "cleanup_settings", field_name):
                try:
                    cursor.execute(f"ALTER TABLE cleanup_settings ADD COLUMN {field_name} {field_def}")
                except Exception as e:
                    logger.warning(f"Не удалось добавить поле {field_name}: {e}")
        
        return True
    
    def _migrate_add_moonbot_charts(self, conn: sqlite3.Connection) -> bool:
        """Таблица графиков MoonBot"""
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS moonbot_charts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                server_id INTEGER NOT NULL,
                order_db_id INTEGER NOT NULL,
                market_name TEXT,
                market_currency TEXT,
                pump_channel TEXT,
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                session_profit REAL,
                chart_data TEXT,
                raw_data TEXT,
                received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (server_id) REFERENCES servers(id)
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_moonbot_charts_server_order 
            ON moonbot_charts(server_id, order_db_id)
        """)
        
        return True
    
    def _migrate_add_last_errors_viewed_at(self, conn: sqlite3.Connection) -> bool:
        """Время просмотра ошибок"""
        cursor = conn.cursor()
        cursor.execute("ALTER TABLE user_settings ADD COLUMN last_errors_viewed_at TIMESTAMP")
        return True


