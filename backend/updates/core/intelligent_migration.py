"""
Интеллектуальная система миграции
Обрабатывает все типы миграций: БД, файлы, конфигурации, структуру проекта
"""
import sqlite3
import shutil
import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
import logging
import platform

from .migration_types import MigrationType, table_exists, column_exists
from .migration_detector import detect_applied_by_structure
from .migration_runners import (
    run_database_migration,
    run_dependencies_migration,
    run_config_migration,
    run_structure_migration,
    run_files_migration
)


# Настройка логирования
BASE_UPDATES_DIR = Path(__file__).resolve().parents[1]
LOG_DIR = BASE_UPDATES_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "migration.log"

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(str(LOG_FILE), encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Определяем ОС
IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'


class IntelligentMigrationSystem:
    """
    Интеллектуальная система миграции с поддержкой всех типов изменений.
    
    Особенности:
    - Автоматическое определение пути к БД
    - Поддержка всех типов миграций (БД, конфиг, файлы, структура, зависимости)
    - Идемпотентность - можно запускать повторно без ошибок
    - Полный бэкап перед миграцией
    - Возможность отката
    - Детальное логирование
    """
    
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
    
    def __init__(self, db_path: str = None):
        # Автоматическое определение пути к БД
        if db_path is None:
            self.db_path = self._find_db_path()
        else:
            self.db_path = Path(db_path)
        
        # Директория для бэкапов рядом с БД
        self.backup_dir = self.db_path.parent / "migration_backups"
        self.backup_dir.mkdir(exist_ok=True)
        
        logger.info(f"📁 Путь к БД: {self.db_path}")
        logger.info(f"📁 Директория бэкапов: {self.backup_dir}")
    
    def _find_db_path(self) -> Path:
        """Найти путь к БД moonbot_commander.db"""
        # Определяем директорию этого файла
        current_file = Path(__file__).resolve()
        
        # backend/updates/core/intelligent_migration.py -> backend/
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
        version = "3.0.0"  # По умолчанию текущая версия
        
        if cursor.fetchone():
            # Есть реестр - читаем из него
            cursor.execute("""
                SELECT migration_name FROM _migrations_registry 
                WHERE status = 'success'
            """)
            applied = [row[0] for row in cursor.fetchall()]
            logger.info(f"Найден реестр миграций: {len(applied)} применено")
            
            # Если реестр пуст, определяем версию по структуре
            if not applied:
                applied = detect_applied_by_structure(conn, self.db_path)
        else:
            # Нет реестра - определяем по структуре БД
            logger.info("Реестр миграций не найден, анализируем структуру БД...")
            
            # Проверяем ключевые признаки версий
            if table_exists(conn, 'schema_versions'):
                version = "2.0.0+"
            elif column_exists(conn, 'moonbot_orders', 'base_currency'):
                version = "2.1.0+"
                applied = detect_applied_by_structure(conn, self.db_path)
            elif table_exists(conn, 'moonbot_orders'):
                version = "1.5.0+"
                applied = detect_applied_by_structure(conn, self.db_path)
            elif column_exists(conn, 'servers', 'password'):
                version = "1.2.0+"
                applied = detect_applied_by_structure(conn, self.db_path)
            else:
                version = "1.0.0"
        
        conn.close()
        
        # Определяем версию по последним миграциям
        if 'migrate_add_default_currency' in applied:
            version = "2.1.2+"
        elif 'migrate_moonbot_orders_extended' in applied:
            version = "2.0.0+"
        
        return version, applied
    
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
                return run_database_migration(migration_name)
            elif migration_type == MigrationType.DEPENDENCIES:
                return run_dependencies_migration(custom_func)
            elif migration_type == MigrationType.CONFIG:
                return run_config_migration(custom_func, self.db_path)
            elif migration_type == MigrationType.STRUCTURE:
                return run_structure_migration(custom_func, self.db_path)
            elif migration_type == MigrationType.FILES:
                return run_files_migration(custom_func, self.db_path)
            else:
                logger.error(f"❌ Неизвестный тип миграции: {migration_type}")
                return False
                
        except Exception as e:
            logger.error(f"❌ {migration_name} - ошибка: {str(e)}")
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
        # Определяем директорию backend
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent.parent.parent
        
        # Меняем рабочую директорию на backend для корректной работы с БД
        original_cwd = os.getcwd()
        os.chdir(backend_dir)
        
        logger.info(f"Рабочая директория: {backend_dir}")
        
        # Добавляем backend в sys.path
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        
        migrator = IntelligentMigrationSystem()
        success = migrator.migrate()
        
        if success:
            print("\n✨ Миграция завершена успешно!")
            print("Теперь вы можете запустить приложение.")
        else:
            print("\n⚠️  Миграция завершена с ошибками.")
            print("Проверьте файл backend/updates/logs/migration.log для деталей.")
            os.chdir(original_cwd)
            sys.exit(1)
        
        os.chdir(original_cwd)
            
    except Exception as e:
        logger.error(f"💥 Критическая ошибка: {str(e)}", exc_info=True)
        print(f"\n💥 Критическая ошибка: {str(e)}")
        print("Проверьте файл backend/updates/logs/migration.log для деталей.")
        sys.exit(1)


if __name__ == "__main__":
    main()

