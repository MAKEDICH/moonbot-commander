"""
Интеллектуальная система миграции
Обрабатывает все типы миграций: БД, файлы, конфигурации, структуру проекта
"""
import sqlite3
import shutil
import os
import sys
import json
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Callable
import logging
import subprocess
import platform

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log', encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Определяем ОС
IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'

class MigrationType:
    """Типы миграций"""
    DATABASE = "database"
    CONFIG = "config"
    FILES = "files"
    DEPENDENCIES = "dependencies"
    STRUCTURE = "structure"
    CUSTOM = "custom"

class IntelligentMigrationSystem:
    """Интеллектуальная система миграции с поддержкой всех типов изменений"""
    
    # Порядок миграций КРИТИЧЕСКИ ВАЖЕН!
    # Формат: (название, описание, тип, функция_миграции)
    MIGRATION_ORDER = [
        # === ЗАВИСИМОСТИ ===
        ('add_websockets_dependency', 'Добавление WebSocket поддержки', MigrationType.DEPENDENCIES, 'check_websockets'),
        ('add_aiohttp_packaging', 'Добавление aiohttp и packaging', MigrationType.DEPENDENCIES, 'check_aiohttp'),
        
        # === КОНФИГУРАЦИИ ===
        ('update_env_cors_origins', 'Обновление CORS_ORIGINS в .env', MigrationType.CONFIG, 'update_cors_origins'),
        ('add_env_moonbot_mode', 'Добавление MOONBOT_MODE переменной', MigrationType.CONFIG, 'add_moonbot_mode'),
        
        # === СТРУКТУРА ПРОЕКТА ===
        ('create_logs_directory', 'Создание папки logs', MigrationType.STRUCTURE, 'ensure_logs_directory'),
        ('create_backups_directory', 'Создание папки backups', MigrationType.STRUCTURE, 'ensure_backups_directory'),
        ('create_api_directory', 'Создание папки api в backend', MigrationType.STRUCTURE, 'ensure_api_directory'),
        
        # === МИГРАЦИИ БД ===
        ('migrate_add_password', 'Добавление поддержки паролей HMAC', MigrationType.DATABASE, None),
        ('migrate_add_keepalive', 'Добавление keep-alive для серверов', MigrationType.DATABASE, None),
        ('migrate_add_2fa', 'Двухфакторная аутентификация', MigrationType.DATABASE, None),
        ('migrate_add_recovery_codes', 'Коды восстановления 2FA', MigrationType.DATABASE, None),
        
        # UDP и мониторинг
        ('migrate_add_udp_listener', 'UDP Listener для приёма данных', MigrationType.DATABASE, None),
        ('migrate_add_balance_and_strategies', 'Балансы и стратегии', MigrationType.DATABASE, None),
        ('migrate_add_balance_fields', 'Поля is_running и version в балансах', MigrationType.DATABASE, None),
        
        # Планировщик
        ('migrate_scheduled_commands_full', 'Расширенный планировщик команд', MigrationType.DATABASE, None),
        ('migrate_add_display_time', 'Время отображения для команд', MigrationType.DATABASE, None),
        ('migrate_add_timezone', 'Поддержка часовых поясов', MigrationType.DATABASE, None),
        ('migrate_add_scheduler_settings', 'Настройки планировщика', MigrationType.DATABASE, None),
        
        # Расширенные функции
        ('migrate_001_recurrence_weekdays', 'Повторяющиеся команды по дням недели', MigrationType.DATABASE, None),
        ('migrate_002_add_is_localhost', 'Поддержка localhost соединений', MigrationType.DATABASE, None),
        
        # Очистка и оптимизация
        ('migrate_add_cleanup_settings', 'Настройки автоочистки', MigrationType.DATABASE, None),
        ('migrate_cleanup_settings_v2', 'Расширенные настройки очистки', MigrationType.DATABASE, None),
        
        # Исправления
        ('migrate_add_created_from_update', 'Исправление UNKNOWN ордеров', MigrationType.DATABASE, None),
        ('migrate_moonbot_orders_extended', 'Расширенная информация об ордерах', MigrationType.DATABASE, None),
        ('migrate_add_default_currency', 'Мультивалютная поддержка', MigrationType.DATABASE, None),
        
        # === ФАЙЛЫ И ДАННЫЕ ===
        ('migrate_scheduler_enabled_file', 'Создание scheduler_enabled.txt', MigrationType.FILES, 'ensure_scheduler_enabled'),
    ]
    
    def __init__(self, db_path: str = "moonbot_commander.db"):
        self.db_path = Path(db_path)
        self.backup_dir = Path("migration_backups")
        self.backup_dir.mkdir(exist_ok=True)
        
    def detect_current_version(self) -> Tuple[str, List[str]]:
        """
        Определить текущую версию БД и список примененных миграций
        
        Returns:
            (version, applied_migrations)
        """
        if not self.db_path.exists():
            return "0.0.0", []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Проверяем наличие таблицы реестра миграций
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='_migrations_registry'
        """)
        
        applied = []
        
        if cursor.fetchone():
            # Есть реестр - читаем из него
            cursor.execute("""
                SELECT migration_name FROM _migrations_registry 
                WHERE status = 'success'
            """)
            applied = [row[0] for row in cursor.fetchall()]
            logger.info(f"Найден реестр миграций: {len(applied)} применено")
        else:
            # Нет реестра - определяем по структуре БД
            logger.info("Реестр миграций не найден, анализируем структуру БД...")
            
            # Проверяем ключевые признаки версий
            if self._table_exists(conn, 'schema_versions'):
                version = "2.0.0+"
            elif self._column_exists(conn, 'moonbot_orders', 'base_currency'):
                version = "2.1.0+"
                applied = self._detect_applied_by_structure(conn)
            elif self._table_exists(conn, 'moonbot_orders'):
                version = "1.5.0+"
                applied = self._detect_applied_by_structure(conn)
            elif self._column_exists(conn, 'servers', 'password'):
                version = "1.2.0+"
                applied = self._detect_applied_by_structure(conn)
            else:
                version = "1.0.0"
        
        conn.close()
        
        # Определяем версию по последним миграциям
        if 'migrate_add_default_currency' in applied:
            version = "2.1.2+"
        elif 'migrate_moonbot_orders_extended' in applied:
            version = "2.0.0+"
        
        return version, applied
    
    def _detect_applied_by_structure(self, conn: sqlite3.Connection) -> List[str]:
        """Определить примененные миграции по структуре БД и файловой системе"""
        applied = []
        
        # БД миграции
        db_checks = {
            'migrate_add_password': lambda: self._column_exists(conn, 'servers', 'password'),
            'migrate_add_keepalive': lambda: self._column_exists(conn, 'servers', 'keepalive_enabled'),
            'migrate_add_2fa': lambda: self._column_exists(conn, 'users', 'totp_secret'),
            'migrate_add_recovery_codes': lambda: self._table_exists(conn, 'recovery_codes'),
            'migrate_add_udp_listener': lambda: self._table_exists(conn, 'moonbot_orders'),
            'migrate_add_balance_and_strategies': lambda: self._table_exists(conn, 'server_balance'),
            'migrate_add_balance_fields': lambda: self._column_exists(conn, 'server_balance', 'is_running') and self._column_exists(conn, 'server_balance', 'version'),
            'migrate_add_cleanup_settings': lambda: self._table_exists(conn, 'cleanup_settings'),
            'migrate_001_recurrence_weekdays': lambda: self._column_exists(conn, 'scheduled_commands', 'weekdays'),
            'migrate_002_add_is_localhost': lambda: self._column_exists(conn, 'servers', 'is_localhost'),
            'migrate_add_created_from_update': lambda: self._column_exists(conn, 'moonbot_orders', 'created_from_update'),
            'migrate_add_display_time': lambda: self._column_exists(conn, 'scheduled_commands', 'display_time'),
            'migrate_add_timezone': lambda: self._column_exists(conn, 'scheduled_commands', 'timezone'),
            'migrate_add_default_currency': lambda: self._column_exists(conn, 'moonbot_orders', 'base_currency'),
            'migrate_scheduled_commands_full': lambda: self._column_exists(conn, 'scheduled_commands', 'recurrence_type'),
            'migrate_add_scheduler_settings': lambda: self._table_exists(conn, 'scheduler_settings'),
            'migrate_cleanup_settings_v2': lambda: self._column_exists(conn, 'cleanup_settings', 'auto_cleanup_sql_logs'),
            'migrate_moonbot_orders_extended': lambda: self._column_exists(conn, 'moonbot_orders', 'exchange'),
        }
        
        # Проверка зависимостей
        dependencies_checks = {
            'add_websockets_dependency': lambda: self._check_package_installed('websockets'),
            'add_aiohttp_packaging': lambda: self._check_package_installed('aiohttp') and self._check_package_installed('packaging'),
        }
        
        # Проверка конфигураций
        config_checks = {
            'update_env_cors_origins': lambda: self._check_env_contains('CORS_ORIGINS', 'localhost:3000'),
            'add_env_moonbot_mode': lambda: self._check_env_contains('MOONBOT_MODE'),
        }
        
        # Проверка структуры
        structure_checks = {
            'create_logs_directory': lambda: (self.db_path.parent / 'logs').exists(),
            'create_backups_directory': lambda: (self.db_path.parent / 'backups').exists(),
            'create_api_directory': lambda: (self.db_path.parent / 'api').exists(),
        }
        
        # Проверка файлов
        files_checks = {
            'migrate_scheduler_enabled_file': lambda: (self.db_path.parent / 'scheduler_enabled.txt').exists(),
        }
        
        # Выполняем все проверки
        all_checks = {**db_checks, **dependencies_checks, **config_checks, **structure_checks, **files_checks}
        
        for migration, check in all_checks.items():
            try:
                if check():
                    applied.append(migration)
            except:
                pass
        
        return applied
    
    def _check_package_installed(self, package_name: str) -> bool:
        """Проверить установлен ли Python пакет"""
        try:
            __import__(package_name)
            return True
        except ImportError:
            return False
    
    def _check_env_contains(self, key: str, value: Optional[str] = None) -> bool:
        """Проверить есть ли ключ (и значение) в .env файле"""
        try:
            env_path = self.db_path.parent / '.env'
            if not env_path.exists():
                return False
            
            content = env_path.read_text(encoding='utf-8')
            if value:
                return f'{key}=' in content and value in content
            else:
                return f'{key}=' in content
        except:
            return False
    
    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        """Проверить существование таблицы"""
        cursor = conn.cursor()
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        """, (table_name,))
        return cursor.fetchone() is not None
    
    def _column_exists(self, conn: sqlite3.Connection, table: str, column: str) -> bool:
        """Проверить существование колонки"""
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        return column in columns
    
    def create_backup(self) -> str:
        """Создать полный бэкап перед миграцией"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Бэкап БД
        db_backup = self.backup_dir / f"moonbot_commander_{timestamp}.db"
        if self.db_path.exists():
            shutil.copy2(self.db_path, db_backup)
            logger.info(f"✅ Создан бэкап БД: {db_backup}")
        
        # Бэкап .env
        env_path = self.db_path.parent / ".env"
        if env_path.exists():
            env_backup = self.backup_dir / f"env_{timestamp}.txt"
            shutil.copy2(env_path, env_backup)
            logger.info(f"✅ Создан бэкап .env: {env_backup}")
        
        # Сохраняем информацию о версии
        info = {
            "timestamp": timestamp,
            "db_backup": str(db_backup),
            "env_backup": str(env_backup) if env_path.exists() else None,
            "original_version": self.detect_current_version()[0]
        }
        
        info_file = self.backup_dir / f"backup_info_{timestamp}.json"
        with open(info_file, 'w', encoding='utf-8') as f:
            json.dump(info, f, indent=2, ensure_ascii=False)
        
        return timestamp
    
    def run_migration(self, migration_name: str, migration_type: str, custom_func: Optional[str] = None) -> bool:
        """
        Запустить миграцию любого типа
        
        Args:
            migration_name: Имя миграции
            migration_type: Тип миграции (DATABASE, CONFIG, FILES и т.д.)
            custom_func: Имя кастомной функции для не-БД миграций
        """
        try:
            logger.info(f"▶️  Запуск миграции: {migration_name} [тип: {migration_type}]")
            
            # Выбираем метод обработки в зависимости от типа
            if migration_type == MigrationType.DATABASE:
                return self._run_database_migration(migration_name)
            elif migration_type == MigrationType.DEPENDENCIES:
                return self._run_dependencies_migration(custom_func)
            elif migration_type == MigrationType.CONFIG:
                return self._run_config_migration(custom_func)
            elif migration_type == MigrationType.STRUCTURE:
                return self._run_structure_migration(custom_func)
            elif migration_type == MigrationType.FILES:
                return self._run_files_migration(custom_func)
            else:
                logger.error(f"❌ Неизвестный тип миграции: {migration_type}")
                return False
                
        except Exception as e:
            logger.error(f"❌ {migration_name} - ошибка: {str(e)}")
            return False
    
    def _run_database_migration(self, migration_name: str) -> bool:
        """Запустить миграцию БД"""
        try:
            # Импортируем и запускаем Python файл миграции
            import importlib.util
            spec = importlib.util.spec_from_file_location(
                migration_name,
                f"{migration_name}.py"
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Вызываем функцию миграции
            if hasattr(module, 'migrate'):
                result = module.migrate()
                if result:
                    logger.info(f"✅ {migration_name} - успешно")
                    return True
                else:
                    logger.error(f"❌ {migration_name} - неудачно")
                    return False
            elif hasattr(module, 'run_migration'):
                # Альтернативное имя функции
                result = module.run_migration()
                if result:
                    logger.info(f"✅ {migration_name} - успешно")
                    return True
                else:
                    logger.error(f"❌ {migration_name} - неудачно")
                    return False
            else:
                # Старый стиль - просто выполнение файла
                logger.info(f"✅ {migration_name} - выполнено (старый формат)")
                return True
                
        except Exception as e:
            logger.error(f"Ошибка БД миграции: {str(e)}")
            return False
    
    def _run_dependencies_migration(self, func_name: str) -> bool:
        """Проверить и установить зависимости"""
        try:
            if func_name == 'check_websockets':
                # Проверяем websockets
                try:
                    import websockets
                    logger.info("✅ WebSocket уже установлен")
                except ImportError:
                    logger.info("📦 Устанавливаем websockets...")
                    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "--quiet"])
                    logger.info("✅ WebSocket установлен")
                return True
                
            elif func_name == 'check_aiohttp':
                # Проверяем aiohttp и packaging
                missing = []
                try:
                    import aiohttp
                except ImportError:
                    missing.append('aiohttp')
                try:
                    import packaging
                except ImportError:
                    missing.append('packaging')
                    
                if missing:
                    logger.info(f"📦 Устанавливаем: {', '.join(missing)}...")
                    subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing + ["--quiet"])
                    logger.info(f"✅ Установлено: {', '.join(missing)}")
                else:
                    logger.info("✅ aiohttp и packaging уже установлены")
                return True
                
        except Exception as e:
            logger.error(f"Ошибка установки зависимостей: {str(e)}")
            return False
    
    def _run_config_migration(self, func_name: str) -> bool:
        """Обновить конфигурационные файлы"""
        try:
            env_path = self.db_path.parent / ".env"
            
            if func_name == 'update_cors_origins':
                if env_path.exists():
                    content = env_path.read_text(encoding='utf-8')
                    # Проверяем есть ли уже обновленные CORS_ORIGINS
                    if 'CORS_ORIGINS=' in content and 'http://localhost:3000,http://127.0.0.1:3000' not in content:
                        # Добавляем новые origins если их нет
                        lines = content.splitlines()
                        for i, line in enumerate(lines):
                            if line.startswith('CORS_ORIGINS='):
                                current_origins = line.split('=', 1)[1].strip('"\'')
                                if 'localhost:5173' in current_origins:
                                    # Добавляем порт 3000
                                    new_origins = current_origins.replace(',http://localhost:5173', 
                                        ',http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000')
                                    lines[i] = f'CORS_ORIGINS={new_origins}'
                                    env_path.write_text('\n'.join(lines), encoding='utf-8')
                                    logger.info("✅ Обновлены CORS_ORIGINS")
                                break
                return True
                
            elif func_name == 'add_moonbot_mode':
                if env_path.exists():
                    content = env_path.read_text(encoding='utf-8')
                    if 'MOONBOT_MODE=' not in content:
                        # Добавляем переменную если её нет
                        with open(env_path, 'a', encoding='utf-8') as f:
                            f.write('\n# Режим работы: local или server\n')
                            f.write('# MOONBOT_MODE=local\n')
                        logger.info("✅ Добавлена переменная MOONBOT_MODE")
                return True
                
        except Exception as e:
            logger.error(f"Ошибка обновления конфигурации: {str(e)}")
            return False
    
    def _run_structure_migration(self, func_name: str) -> bool:
        """Создать/обновить структуру папок"""
        try:
            if func_name == 'ensure_logs_directory':
                logs_dir = self.db_path.parent / "logs"
                logs_dir.mkdir(exist_ok=True)
                logger.info(f"✅ Создана папка: {logs_dir}")
                return True
                
            elif func_name == 'ensure_backups_directory':
                backups_dir = self.db_path.parent / "backups"
                backups_dir.mkdir(exist_ok=True)
                logger.info(f"✅ Создана папка: {backups_dir}")
                return True
                
            elif func_name == 'ensure_api_directory':
                api_dir = self.db_path.parent / "api"
                api_dir.mkdir(exist_ok=True)
                # Создаем __init__.py
                init_file = api_dir / "__init__.py"
                if not init_file.exists():
                    init_file.touch()
                logger.info(f"✅ Создана папка: {api_dir}")
                return True
                
        except Exception as e:
            logger.error(f"Ошибка создания структуры: {str(e)}")
            return False
    
    def _run_files_migration(self, func_name: str) -> bool:
        """Миграция файлов и данных"""
        try:
            if func_name == 'ensure_scheduler_enabled':
                scheduler_file = self.db_path.parent / "scheduler_enabled.txt"
                if not scheduler_file.exists():
                    scheduler_file.write_text("1")
                    logger.info(f"✅ Создан файл: {scheduler_file}")
                return True
                
        except Exception as e:
            logger.error(f"Ошибка миграции файлов: {str(e)}")
            return False
    
    def ensure_migrations_registry(self):
        """Создать таблицу реестра миграций если её нет"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS _migrations_registry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name VARCHAR(255) UNIQUE NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                description TEXT,
                status VARCHAR(20) DEFAULT 'success'
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("✅ Реестр миграций готов")
    
    def mark_migration_applied(self, migration_name: str, description: str = ""):
        """Отметить миграцию как примененную"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO _migrations_registry 
            (migration_name, applied_at, description, status)
            VALUES (?, ?, ?, 'success')
        """, (migration_name, datetime.now().isoformat(), description))
        
        conn.commit()
        conn.close()
    
    def migrate(self) -> bool:
        """
        Выполнить интеллектуальную миграцию
        
        Returns:
            True если успешно, False если были ошибки
        """
        logger.info("=" * 60)
        logger.info("🚀 ИНТЕЛЛЕКТУАЛЬНАЯ МИГРАЦИЯ MOONBOT COMMANDER")
        logger.info("=" * 60)
        
        # 1. Определяем текущее состояние
        current_version, applied = self.detect_current_version()
        logger.info(f"📊 Текущая версия: {current_version}")
        logger.info(f"📋 Применено миграций: {len(applied)}")
        
        # 2. Определяем какие миграции нужны
        pending = []
        for migration_name, desc, mtype, func in self.MIGRATION_ORDER:
            if migration_name not in applied:
                pending.append((migration_name, desc, mtype, func))
        
        if not pending:
            logger.info("✅ Система актуальна! Миграции не требуются.")
            return True
        
        logger.info(f"📝 Необходимо применить {len(pending)} миграций:")
        
        # Группируем по типам для красивого вывода
        by_type = {}
        for mname, desc, mtype, _ in pending:
            if mtype not in by_type:
                by_type[mtype] = []
            by_type[mtype].append(f"   - {mname}: {desc}")
        
        for mtype, items in by_type.items():
            logger.info(f"\n{mtype.upper()}:")
            for item in items:
                logger.info(item)
        
        # 3. Создаем бэкап
        logger.info("\n📦 Создание резервной копии...")
        backup_id = self.create_backup()
        
        # 4. Создаем реестр миграций
        self.ensure_migrations_registry()
        
        # 5. Применяем миграции
        logger.info("\n🔧 Применение миграций...")
        success_count = 0
        failed = []
        
        for migration_name, desc, mtype, func in pending:
            if self.run_migration(migration_name, mtype, func):
                self.mark_migration_applied(migration_name, desc)
                success_count += 1
            else:
                failed.append(migration_name)
                logger.error(f"⚠️  Остановка миграции из-за ошибки в {migration_name}")
                break
        
        # 6. Результат
        logger.info("\n" + "=" * 60)
        if failed:
            logger.error("❌ МИГРАЦИЯ ЗАВЕРШЕНА С ОШИБКАМИ")
            logger.error(f"Успешно: {success_count}, Неудачно: {len(failed)}")
            logger.error(f"Бэкап сохранен: {backup_id}")
            if IS_WINDOWS:
                logger.error("Используйте ROLLBACK.bat для отката при необходимости")
            else:
                logger.error("Используйте ./linux/rollback.sh для отката при необходимости")
            return False
        else:
            logger.info("✅ МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА!")
            logger.info(f"Применено миграций: {success_count}")
            logger.info(f"Бэкап сохранен: {backup_id}")
            return True


def main():
    """Точка входа"""
    try:
        # Меняем рабочую директорию на папку со скриптом
        os.chdir(os.path.dirname(os.path.abspath(__file__)))
        
        migrator = IntelligentMigrationSystem()
        success = migrator.migrate()
        
        if success:
            print("\n✨ Миграция завершена успешно!")
            print("Теперь вы можете запустить приложение.")
        else:
            print("\n⚠️  Миграция завершена с ошибками.")
            print("Проверьте файл migration.log для деталей.")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"💥 Критическая ошибка: {str(e)}", exc_info=True)
        print(f"\n💥 Критическая ошибка: {str(e)}")
        print("Проверьте файл migration.log для деталей.")
        sys.exit(1)


if __name__ == "__main__":
    main()
