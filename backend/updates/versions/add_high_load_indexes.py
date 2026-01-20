"""
Миграция: Добавление индексов для высоких нагрузок

Оптимизирует запросы для работы с 3000+ серверами.
"""
import sqlite3
from typing import List, Tuple
from updates.migration_utils import (
    get_db_connection,
    safe_create_index,
    run_migration_sql,
    log
)


MIGRATION_ID = "add_high_load_indexes"
MIGRATION_VERSION = "3.1.0"


def get_indexes() -> List[Tuple[str, str, str]]:
    """
    Получить список индексов для создания.
    
    Returns:
        List of (index_name, table_name, columns)
    """
    return [
        # === MOONBOT_ORDERS - основная таблица с ордерами ===
        # Индекс для быстрого поиска открытых ордеров по серверу
        ("idx_orders_server_status", "moonbot_orders", "server_id, status"),
        # Индекс для поиска ордеров по дате закрытия (для статистики)
        ("idx_orders_close_date", "moonbot_orders", "close_date DESC"),
        # Индекс для поиска по боту
        ("idx_orders_bot_name", "moonbot_orders", "bot_name"),
        # Индекс для поиска по символу
        ("idx_orders_symbol", "moonbot_orders", "symbol"),
        # Составной индекс для статистики по серверу и дате
        ("idx_orders_server_close", "moonbot_orders", "server_id, close_date DESC"),
        # Индекс для эмуляторных ордеров
        ("idx_orders_emulator", "moonbot_orders", "is_emulator"),
        # Индекс для быстрого поиска по moonbot_order_id
        ("idx_orders_moonbot_id", "moonbot_orders", "moonbot_order_id"),
        
        # === SQL_COMMAND_LOG - логи SQL команд ===
        # Индекс для поиска по серверу и дате
        ("idx_sql_log_server_date", "sql_command_log", "server_id, received_at DESC"),
        # Индекс для необработанных команд
        ("idx_sql_log_unprocessed", "sql_command_log", "processed, received_at"),
        
        # === SERVER_BALANCE - балансы серверов ===
        # Индекс для быстрого поиска по дате обновления
        ("idx_balance_updated", "server_balance", "updated_at DESC"),
        
        # === MOONBOT_API_ERRORS - ошибки API ===
        # Составной индекс для поиска ошибок по серверу и дате
        ("idx_errors_server_date", "moonbot_api_errors", "server_id, received_at DESC"),
        # Индекс для поиска по коду ошибки
        ("idx_errors_code", "moonbot_api_errors", "error_code"),
        
        # === STRATEGY_CACHE - кэш стратегий ===
        # Индекс для быстрого поиска последних стратегий
        ("idx_strategy_received", "strategy_cache", "received_at DESC"),
        
        # === COMMAND_HISTORY - история команд ===
        # Индекс для поиска по пользователю и дате
        ("idx_history_user_date", "command_history", "user_id, execution_time DESC"),
        # Индекс для поиска по серверу
        ("idx_history_server", "command_history", "server_id, execution_time DESC"),
        
        # === SCHEDULED_COMMANDS - отложенные команды ===
        # Индекс для поиска pending команд
        ("idx_scheduled_pending", "scheduled_commands", "status, scheduled_time"),
        
        # === SERVERS - серверы ===
        # Индекс для активных серверов пользователя
        ("idx_servers_user_active", "servers", "user_id, is_active"),
        # Индекс для поиска по группе
        ("idx_servers_group", "servers", "group_name"),
        
        # === MOONBOT_CHARTS - графики ===
        # Индекс для поиска графиков по серверу и дате
        ("idx_charts_server_date", "moonbot_charts", "server_id, received_at DESC"),
        
        # === SERVER_STATUS - статусы серверов ===
        # Индекс для быстрого поиска онлайн серверов
        ("idx_status_online", "server_status", "is_online, last_ping DESC"),
        # Индекс для поиска по server_id (критично для 3000+ серверов)
        ("idx_status_server_id", "server_status", "server_id"),
        
        # === UDP_LISTENER_STATUS - статусы UDP listeners ===
        # Индекс для быстрого поиска активных listeners
        ("idx_udp_status_running", "udp_listener_status", "is_running"),
        ("idx_udp_status_server", "udp_listener_status", "server_id"),
    ]


def run_migration() -> bool:
    """
    Выполнить миграцию - создать индексы.
    
    Returns:
        True если успешно
    """
    log(f"[MIGRATION] Starting {MIGRATION_ID}...")
    
    with get_db_connection() as conn:
        indexes = get_indexes()
        created = 0
        skipped = 0
        
        for index_name, table_name, columns in indexes:
            try:
                # Проверяем существование таблицы
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    (table_name,)
                )
                if not cursor.fetchone():
                    log(f"[MIGRATION] Table {table_name} not found, skipping index {index_name}")
                    skipped += 1
                    continue
                
                # Создаём индекс
                success = safe_create_index(conn, index_name, table_name, columns)
                if success:
                    created += 1
                else:
                    skipped += 1
                    
            except Exception as e:
                log(f"[MIGRATION] Error creating index {index_name}: {e}", level="WARNING")
                skipped += 1
        
        conn.commit()
        
        log(f"[MIGRATION] {MIGRATION_ID} completed: created={created}, skipped={skipped}")
        return True


def check_migration_needed() -> bool:
    """
    Проверить, нужна ли миграция.
    
    Returns:
        True если нужно выполнить миграцию
    """
    with get_db_connection() as conn:
        # Проверяем наличие хотя бы одного индекса
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND name=?",
            ("idx_orders_server_status",)
        )
        return cursor.fetchone() is None


if __name__ == "__main__":
    if check_migration_needed():
        run_migration()
    else:
        log(f"[MIGRATION] {MIGRATION_ID} already applied")

