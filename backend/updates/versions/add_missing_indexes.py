"""
Миграция: Добавление недостающих индексов для ForeignKey полей

Многие ForeignKey поля не имели индексов, что критично для производительности
при JOIN операциях и фильтрации.
"""
import sqlite3
import os
from utils.logging import log


def get_db_path() -> str:
    """Получить путь к БД."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    return os.path.join(backend_dir, 'moonbot_commander.db')


def check_migration_needed() -> bool:
    """Проверить нужна ли миграция."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Проверяем наличие индекса для recovery_codes.user_id
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name='ix_recovery_codes_user_id'
        """)
        result = cursor.fetchone()
        conn.close()
        
        return result is None
        
    except Exception as e:
        log(f"[MIGRATION] Error checking missing indexes: {e}", level="ERROR")
        return False


def run_migration() -> bool:
    """Выполнить миграцию."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        log("[MIGRATION] Database not found, skipping missing indexes migration")
        return True
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Список индексов для создания
        # Формат: (index_name, table_name, column_name)
        indexes_to_create = [
            # recovery_codes
            ('ix_recovery_codes_user_id', 'recovery_codes', 'user_id'),
            
            # servers
            ('ix_servers_user_id', 'servers', 'user_id'),
            ('ix_servers_is_active', 'servers', 'is_active'),
            ('ix_servers_group_name', 'servers', 'group_name'),
            
            # server_status
            ('ix_server_status_server_id', 'server_status', 'server_id'),
            ('ix_server_status_is_online', 'server_status', 'is_online'),
            
            # command_history
            ('ix_command_history_user_id', 'command_history', 'user_id'),
            ('ix_command_history_server_id', 'command_history', 'server_id'),
            ('ix_command_history_execution_time', 'command_history', 'execution_time'),
            
            # quick_commands
            ('ix_quick_commands_user_id', 'quick_commands', 'user_id'),
            
            # command_presets
            ('ix_command_presets_user_id', 'command_presets', 'user_id'),
            
            # scheduled_commands
            ('ix_scheduled_commands_user_id', 'scheduled_commands', 'user_id'),
            ('ix_scheduled_commands_status', 'scheduled_commands', 'status'),
            
            # scheduled_command_servers
            ('ix_scheduled_command_servers_cmd_id', 'scheduled_command_servers', 'scheduled_command_id'),
            ('ix_scheduled_command_servers_server_id', 'scheduled_command_servers', 'server_id'),
            
            # sql_command_log
            ('ix_sql_command_log_server_id', 'sql_command_log', 'server_id'),
            
            # moonbot_orders
            ('ix_moonbot_orders_server_id', 'moonbot_orders', 'server_id'),
            ('ix_moonbot_orders_opened_at', 'moonbot_orders', 'opened_at'),
            ('ix_moonbot_orders_closed_at', 'moonbot_orders', 'closed_at'),
            
            # udp_listener_status
            ('ix_udp_listener_status_server_id', 'udp_listener_status', 'server_id'),
            ('ix_udp_listener_status_is_running', 'udp_listener_status', 'is_running'),
            
            # cleanup_settings
            ('ix_cleanup_settings_user_id', 'cleanup_settings', 'user_id'),
            
            # server_balance
            ('ix_server_balance_server_id', 'server_balance', 'server_id'),
            
            # strategy_cache
            ('ix_strategy_cache_server_id', 'strategy_cache', 'server_id'),
            
            # moonbot_api_errors
            ('ix_moonbot_api_errors_server_id', 'moonbot_api_errors', 'server_id'),
            
            # moonbot_charts
            ('ix_moonbot_charts_server_id', 'moonbot_charts', 'server_id'),
        ]
        
        created_count = 0
        for index_name, table_name, column_name in indexes_to_create:
            try:
                # Проверяем существует ли таблица
                cursor.execute(f"""
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='{table_name}'
                """)
                if not cursor.fetchone():
                    continue
                
                # Проверяем существует ли индекс
                cursor.execute(f"""
                    SELECT name FROM sqlite_master 
                    WHERE type='index' AND name='{index_name}'
                """)
                if cursor.fetchone():
                    continue
                
                # Создаём индекс
                cursor.execute(f"""
                    CREATE INDEX IF NOT EXISTS {index_name} 
                    ON {table_name} ({column_name})
                """)
                log(f"[MIGRATION] Created index: {index_name}")
                created_count += 1
                
            except sqlite3.OperationalError as e:
                if "already exists" in str(e).lower():
                    continue
                log(f"[MIGRATION] Error creating index {index_name}: {e}", level="WARNING")
        
        conn.commit()
        conn.close()
        
        log(f"[MIGRATION] Missing indexes migration complete: {created_count} indexes created")
        return True
        
    except Exception as e:
        log(f"[MIGRATION] Error in missing indexes migration: {e}", level="ERROR")
        return False


if __name__ == "__main__":
    if check_migration_needed():
        print("Migration needed, running...")
        success = run_migration()
        print(f"Migration {'successful' if success else 'failed'}")
    else:
        print("Migration not needed")


