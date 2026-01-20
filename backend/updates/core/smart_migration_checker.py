"""
Умная система проверки миграций
Проверяет РЕАЛЬНОЕ состояние БД, а не записи в реестре
Автоматически исправляет статусы
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

class SmartMigrationChecker:
    """Умная проверка миграций на основе реального состояния БД"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = self._find_db_path()
        self.db_path = db_path
    
    def _find_db_path(self) -> Path:
        """Найти путь к БД moonbot_commander.db"""
        # backend/updates/core/smart_migration_checker.py -> backend/
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent.parent.parent
        
        # Проверяем backend/moonbot_commander.db
        db_path = backend_dir / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        
        # Проверяем корень проекта
        project_root = backend_dir.parent
        db_path = project_root / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        
        # Проверяем текущую рабочую директорию
        cwd_db = Path.cwd() / "moonbot_commander.db"
        if cwd_db.exists():
            return cwd_db
        
        # По умолчанию возвращаем путь в backend
        return backend_dir / "moonbot_commander.db"
        
        # Определение всех миграций и что они должны создать
        self.migrations_spec = {
            'migrate_001_recurrence_weekdays': {
                'desc': 'Поддержка повторяющихся команд и дней недели',
                'checks': [
                    ('column', 'scheduled_commands', 'recurrence_type'),
                    ('column', 'scheduled_commands', 'weekdays'),
                ]
            },
            'migrate_002_add_is_localhost': {
                'desc': 'Разрешение localhost/127.0.0.1 для серверов',
                'checks': [
                    ('column', 'servers', 'is_localhost'),
                ]
            },
            'migrate_add_password': {
                'desc': 'Пароли для серверов (HMAC-SHA256)',
                'checks': [
                    ('column', 'servers', 'password'),
                ]
            },
            'migrate_add_keepalive': {
                'desc': 'Постоянное подключение к серверам',
                'checks': [
                    ('column', 'servers', 'keepalive_enabled'),
                ]
            },
            'migrate_add_2fa': {
                'desc': 'Двухфакторная аутентификация (2FA)',
                'checks': [
                    ('column', 'users', 'totp_secret'),
                    ('column', 'users', 'totp_enabled'),
                ]
            },
            'migrate_add_recovery_codes': {
                'desc': 'Коды восстановления для 2FA',
                'checks': [
                    ('table', 'recovery_codes', None),
                ]
            },
            'migrate_add_balance_and_strategies': {
                'desc': 'Балансы серверов и кэш стратегий (Moonbot)',
                'checks': [
                    ('table', 'server_balance', None),
                    ('table', 'strategy_cache', None),
                ]
            },
            'migrate_add_balance_fields': {
                'desc': 'Поля is_running и version в балансах (обновление формата MoonBot)',
                'checks': [
                    ('column', 'server_balance', 'is_running'),
                    ('column', 'server_balance', 'version'),
                ]
            },
            'migrate_add_cleanup_settings': {
                'desc': 'Настройки автоочистки БД',
                'checks': [
                    ('table', 'cleanup_settings', None),
                ]
            },
            'migrate_cleanup_settings_v2': {
                'desc': 'Расширенные настройки очистки',
                'checks': [
                    ('column', 'cleanup_settings', 'auto_cleanup_sql_logs'),
                    ('column', 'cleanup_settings', 'auto_cleanup_moonbot_orders'),
                ]
            },
            'migrate_add_udp_listener': {
                'desc': 'UDP Listener для приёма данных от серверов',
                'checks': [
                    ('table', 'sql_command_log', None),
                    ('table', 'moonbot_orders', None),
                    ('table', 'udp_listener_status', None),
                ]
            },
            'migrate_add_created_from_update': {
                'desc': 'Исправление проблемы UNKNOWN ордеров',
                'checks': [
                    ('column', 'moonbot_orders', 'created_from_update'),
                ]
            },
            'migrate_add_display_time': {
                'desc': 'Время отображения для отложенных команд',
                'checks': [
                    ('column', 'scheduled_commands', 'display_time'),
                ]
            },
            'migrate_add_timezone': {
                'desc': 'Часовой пояс для отложенных команд',
                'checks': [
                    ('column', 'scheduled_commands', 'timezone'),
                ]
            },
            'migrate_add_scheduler_settings': {
                'desc': 'Настройки планировщика команд',
                'checks': [
                    ('table', 'scheduler_settings', None),
                ]
            },
            'migrate_scheduled_commands_full': {
                'desc': 'Полная поддержка отложенных команд',
                'checks': [
                    ('table', 'scheduled_commands', None),
                    ('column', 'scheduled_commands', 'target_type'),
                ]
            },
            'migrate_moonbot_orders_extended': {
                'desc': 'Расширенные метрики для Moonbot ордеров',
                'checks': [
                    ('column', 'moonbot_orders', 'is_emulator'),
                    ('column', 'moonbot_orders', 'signal_type'),
                ]
            },
        }
    
    def check_table_exists(self, table_name: str) -> bool:
        """Проверить существует ли таблица"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            result = cursor.fetchone() is not None
            conn.close()
            return result
        except sqlite3.Error:
            return False
    
    def check_column_exists(self, table_name: str, column_name: str) -> bool:
        """Проверить существует ли колонка в таблице"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Сначала проверяем существует ли таблица
            if not self.check_table_exists(table_name):
                conn.close()
                return False
            
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = [row[1] for row in cursor.fetchall()]
            conn.close()
            return column_name in columns
        except sqlite3.Error:
            return False
    
    def check_migration_status(self, migration_name: str) -> Tuple[bool, List[str]]:
        """
        Проверить реальный статус миграции
        
        Returns:
            (is_applied, missing_items)
        """
        if migration_name not in self.migrations_spec:
            return (False, ['Unknown migration'])
        
        spec = self.migrations_spec[migration_name]
        missing = []
        
        for check in spec['checks']:
            check_type, target, column = check
            
            if check_type == 'table':
                if not self.check_table_exists(target):
                    missing.append(f"Table '{target}' missing")
            
            elif check_type == 'column':
                if not self.check_column_exists(target, column):
                    missing.append(f"Column '{target}.{column}' missing")
        
        is_applied = len(missing) == 0
        return (is_applied, missing)
    
    def check_all_migrations(self) -> Dict:
        """Проверить все миграции"""
        results = {}
        
        for migration_name, spec in self.migrations_spec.items():
            is_applied, missing = self.check_migration_status(migration_name)
            
            results[migration_name] = {
                'description': spec['desc'],
                'applied': is_applied,
                'missing': missing
            }
        
        return results
    
    def fix_registry_status(self):
        """Исправить статусы в реестре на основе реального состояния"""
        from updates.core.migrations_registry import MigrationsRegistry
        
        registry = MigrationsRegistry(self.db_path)
        results = self.check_all_migrations()
        
        print("=" * 70)
        print("FIXING MIGRATION REGISTRY STATUSES")
        print("=" * 70)
        print()
        
        fixed_count = 0
        
        for migration_name, status in results.items():
            if status['applied']:
                # Миграция применена - помечаем как success
                registry.mark_applied(migration_name, status['description'])
                print(f"[FIXED] {migration_name:45s} -> SUCCESS")
                fixed_count += 1
            else:
                # Миграция не применена - помечаем как failed с причиной
                reason = "; ".join(status['missing'])
                registry.mark_failed(migration_name, reason)
                print(f"[ISSUE] {migration_name:45s} -> FAILED: {reason}")
        
        print()
        print(f"Fixed {fixed_count} migration statuses")
        print()
    
    def print_status_report(self):
        """Вывести красивый отчёт о статусе"""
        results = self.check_all_migrations()
        
        print()
        print("=" * 70)
        print("DATABASE MIGRATIONS STATUS REPORT")
        print("=" * 70)
        print()
        
        applied = []
        missing = []
        
        for migration_name, status in results.items():
            if status['applied']:
                applied.append((migration_name, status['description']))
            else:
                missing.append((migration_name, status['description'], status['missing']))
        
        # Успешные миграции
        print(f"[OK] APPLIED: {len(applied)} migrations")
        print()
        for name, desc in applied:
            print(f"  [OK] {name}")
            print(f"       {desc}")
        
        print()
        
        # Отсутствующие миграции
        if missing:
            print(f"[!] MISSING: {len(missing)} migrations")
            print()
            for name, desc, issues in missing:
                print(f"  [X] {name}")
                print(f"       {desc}")
                for issue in issues:
                    print(f"       - {issue}")
        else:
            print(f"[OK] All migrations are applied!")
        
        print()
        print("=" * 70)
        print()


def main():
    """Главная функция"""
    import sys
    
    checker = SmartMigrationChecker()
    
    if '--fix' in sys.argv:
        # Исправить статусы в реестре
        checker.fix_registry_status()
    else:
        # Просто показать статус
        checker.print_status_report()
        print()
        print("To fix registry statuses, run: python smart_migration_checker.py --fix")
        print()


if __name__ == '__main__':
    main()

