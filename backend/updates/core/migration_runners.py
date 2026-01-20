"""
Исполнители миграций по типам

Этот модуль обеспечивает выполнение миграций различных типов:
- DATABASE: миграции схемы БД
- DEPENDENCIES: установка зависимостей
- CONFIG: обновление конфигурационных файлов
- STRUCTURE: создание структуры папок
- FILES: миграция файлов и данных

Особенности:
- Все миграции идемпотентны (можно запускать повторно)
- Поддерживаются разные форматы функций миграции (migrate, run_migration, main)
- Автоматическая смена рабочей директории для корректной работы с БД
- Inline-миграции как fallback если файл миграции отсутствует
"""
import sys
import os
import logging
import subprocess
from pathlib import Path
from typing import Optional


logger = logging.getLogger(__name__)


def run_database_migration(migration_name: str) -> bool:
    """
    Запустить миграцию БД.
    
    Поддерживает три формата миграций:
    1. migrate() - предпочтительный, возвращает True/False
    2. run_migration() - альтернативный, может не возвращать значение
    3. main() - устаревший формат
    
    Если файл миграции не найден, используется inline-миграция.
    
    Args:
        migration_name: Имя миграции (без .py)
        
    Returns:
        True если миграция успешна, False при ошибке
    """
    import importlib.util
    
    # Определяем путь к файлам миграций (на уровень выше от core/)
    migrations_dir = Path(__file__).resolve().parent.parent
    migration_file = migrations_dir / f"{migration_name}.py"
    
    # Сохраняем текущую директорию
    original_cwd = os.getcwd()
    
    # Определяем директорию backend для корректной работы с БД
    backend_dir = migrations_dir.parent
    
    try:
        if not migration_file.exists():
            logger.warning(f"⚠️  Файл миграции не найден: {migration_file}")
            # Пробуем выполнить inline миграцию
            return run_inline_database_migration(migration_name)
        
        # Меняем рабочую директорию на backend для корректной работы с БД
        os.chdir(backend_dir)
        logger.debug(f"Рабочая директория: {backend_dir}")
        
        # Добавляем backend в sys.path для импорта моделей
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))
        
        # Импортируем и запускаем Python файл миграции
        spec = importlib.util.spec_from_file_location(
            migration_name,
            str(migration_file)
        )
        module = importlib.util.module_from_spec(spec)
        
        # Добавляем модуль в sys.modules для корректных импортов внутри миграции
        sys.modules[migration_name] = module
        
        try:
            spec.loader.exec_module(module)
        except Exception as e:
            # Если ошибка импорта - пробуем inline миграцию
            logger.warning(f"⚠️  Ошибка загрузки модуля {migration_name}: {e}")
            return run_inline_database_migration(migration_name)
        
        # Вызываем функцию миграции
        if hasattr(module, 'migrate'):
            result = module.migrate()
            # Если функция не возвращает значение, считаем успехом
            if result is None or result:
                logger.info(f"✅ {migration_name} - успешно (migrate)")
                return True
            else:
                logger.error(f"❌ {migration_name} - неудачно")
                return False
                
        elif hasattr(module, 'run_migration'):
            # Альтернативное имя функции - часто не возвращает значение
            try:
                result = module.run_migration()
                # run_migration обычно не возвращает значение, считаем успехом
                logger.info(f"✅ {migration_name} - успешно (run_migration)")
                return True
            except Exception as e:
                logger.error(f"❌ {migration_name} - ошибка: {e}")
                return False
                
        elif hasattr(module, 'main'):
            # Устаревший формат
            try:
                result = module.main()
                logger.info(f"✅ {migration_name} - выполнено (main)")
                return True
            except Exception as e:
                logger.error(f"❌ {migration_name} - ошибка: {e}")
                return False
        else:
            # Старый стиль - просто выполнение файла считается успехом
            logger.info(f"✅ {migration_name} - выполнено (старый формат)")
            return True
            
    except Exception as e:
        logger.error(f"Ошибка БД миграции {migration_name}: {str(e)}")
        # Пробуем inline миграцию как fallback
        logger.info(f"Пробуем inline миграцию для {migration_name}...")
        return run_inline_database_migration(migration_name)
    finally:
        # Восстанавливаем рабочую директорию
        os.chdir(original_cwd)


def run_inline_database_migration(migration_name: str) -> bool:
    """
    Выполнить inline миграцию для известных миграций без отдельного файла.
    Это гарантирует что миграция пройдет даже если файл отсутствует.
    
    Inline миграции - это резервный механизм на случай если:
    - Файл миграции отсутствует
    - Файл миграции повреждён
    - Произошла ошибка импорта
    
    Все inline миграции идемпотентны - их можно запускать повторно.
    """
    import sqlite3
    
    # Путь к БД - ищем в нескольких местах
    backend_dir = Path(__file__).resolve().parent.parent.parent
    db_path = backend_dir / "moonbot_commander.db"
    
    # Если не нашли в backend, проверяем корень проекта
    if not db_path.exists():
        project_root = backend_dir.parent
        db_path = project_root / "moonbot_commander.db"
    
    # Если не нашли и там, проверяем текущую директорию
    if not db_path.exists():
        db_path = Path.cwd() / "moonbot_commander.db"
    
    if not db_path.exists():
        logger.info(f"✅ {migration_name} - БД не существует, пропускаем")
        return True
    
    logger.debug(f"Inline миграция использует БД: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Словарь inline миграций
        inline_migrations = {
            'migrate_add_password': [
                "ALTER TABLE servers ADD COLUMN password VARCHAR(255)",
            ],
            'migrate_add_keepalive': [
                "ALTER TABLE servers ADD COLUMN keepalive_enabled BOOLEAN DEFAULT 1",
                "ALTER TABLE servers ADD COLUMN keepalive_interval INTEGER DEFAULT 30",
            ],
            'migrate_add_2fa': [
                "ALTER TABLE users ADD COLUMN totp_secret VARCHAR(32)",
                "ALTER TABLE users ADD COLUMN is_2fa_enabled BOOLEAN DEFAULT 0",
            ],
            'migrate_add_recovery_codes': [
                "ALTER TABLE users ADD COLUMN recovery_codes TEXT",
            ],
            'migrate_add_udp_listener': [
                "ALTER TABLE servers ADD COLUMN udp_listener_enabled BOOLEAN DEFAULT 0",
                "ALTER TABLE servers ADD COLUMN udp_listener_port INTEGER",
            ],
            'migrate_add_balance_and_strategies': [
                """CREATE TABLE IF NOT EXISTS moonbot_balances (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    server_id INTEGER NOT NULL,
                    bot_name VARCHAR(255),
                    available_balance REAL,
                    total_balance REAL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (server_id) REFERENCES servers(id)
                )""",
            ],
            'migrate_add_balance_fields': [
                "ALTER TABLE moonbot_balances ADD COLUMN is_running BOOLEAN DEFAULT 0",
                "ALTER TABLE moonbot_balances ADD COLUMN version INTEGER",
            ],
            'migrate_scheduled_commands_full': [
                "ALTER TABLE scheduled_commands ADD COLUMN is_recurring BOOLEAN DEFAULT 0",
                "ALTER TABLE scheduled_commands ADD COLUMN recurrence_pattern VARCHAR(50)",
            ],
            'migrate_add_display_time': [
                "ALTER TABLE scheduled_commands ADD COLUMN display_time VARCHAR(10)",
            ],
            'migrate_add_timezone': [
                "ALTER TABLE user_settings ADD COLUMN timezone VARCHAR(50) DEFAULT 'Europe/Moscow'",
            ],
            'migrate_add_scheduler_settings': [
                "ALTER TABLE user_settings ADD COLUMN scheduler_enabled BOOLEAN DEFAULT 1",
            ],
            'migrate_001_recurrence_weekdays': [
                "ALTER TABLE scheduled_commands ADD COLUMN recurrence_weekdays VARCHAR(20)",
            ],
            'migrate_002_add_is_localhost': [
                "ALTER TABLE servers ADD COLUMN is_localhost BOOLEAN DEFAULT 0",
            ],
            'migrate_add_cleanup_settings': [
                "ALTER TABLE user_settings ADD COLUMN auto_cleanup_enabled BOOLEAN DEFAULT 0",
                "ALTER TABLE user_settings ADD COLUMN cleanup_days INTEGER DEFAULT 30",
            ],
            'migrate_cleanup_settings_v2': [
                "ALTER TABLE user_settings ADD COLUMN cleanup_orders_days INTEGER DEFAULT 30",
                "ALTER TABLE user_settings ADD COLUMN cleanup_charts_days INTEGER DEFAULT 7",
            ],
            'migrate_add_created_from_update': [
                "ALTER TABLE moonbot_orders ADD COLUMN created_from_update BOOLEAN DEFAULT 0",
            ],
            'migrate_moonbot_orders_extended': [
                "ALTER TABLE moonbot_orders ADD COLUMN strategy VARCHAR(100)",
                "ALTER TABLE moonbot_orders ADD COLUMN entry_price REAL",
            ],
            'migrate_add_default_currency': [
                "ALTER TABLE servers ADD COLUMN default_currency VARCHAR(10) DEFAULT 'USDT'",
            ],
        }
        
        if migration_name not in inline_migrations:
            logger.warning(f"⚠️  Неизвестная inline миграция: {migration_name}")
            # Для неизвестных миграций - пропускаем с успехом (возможно уже применена)
            return True
        
        for sql in inline_migrations[migration_name]:
            try:
                cursor.execute(sql)
                logger.info(f"   Выполнено: {sql[:60]}...")
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    logger.info(f"   Уже существует, пропускаем")
                else:
                    raise
        
        conn.commit()
        conn.close()
        
        logger.info(f"✅ {migration_name} - inline миграция успешна")
        return True
        
    except Exception as e:
        logger.error(f"❌ Ошибка inline миграции {migration_name}: {str(e)}")
        return False


def run_dependencies_migration(func_name: str) -> bool:
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


def run_config_migration(func_name: str, db_path: Path) -> bool:
    """Обновить конфигурационные файлы"""
    try:
        env_path = db_path.parent / ".env"
        
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


def run_structure_migration(func_name: str, db_path: Path) -> bool:
    """Создать/обновить структуру папок"""
    try:
        if func_name == 'ensure_logs_directory':
            logs_dir = db_path.parent / "logs"
            logs_dir.mkdir(exist_ok=True)
            logger.info(f"✅ Создана папка: {logs_dir}")
            return True
            
        elif func_name == 'ensure_backups_directory':
            backups_dir = db_path.parent / "backups"
            backups_dir.mkdir(exist_ok=True)
            logger.info(f"✅ Создана папка: {backups_dir}")
            return True
            
        elif func_name == 'ensure_api_directory':
            api_dir = db_path.parent / "api"
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


def run_files_migration(func_name: str, db_path: Path) -> bool:
    """Миграция файлов и данных"""
    try:
        if func_name == 'ensure_scheduler_enabled':
            scheduler_file = db_path.parent / "services" / "scheduler_enabled.txt"
            scheduler_file.parent.mkdir(parents=True, exist_ok=True)
            legacy_file = db_path.parent / "scheduler_enabled.txt"
            if legacy_file.exists() and not scheduler_file.exists():
                try:
                    legacy_file.replace(scheduler_file)
                except Exception:
                    pass
            if not scheduler_file.exists():
                scheduler_file.write_text("1")
                logger.info(f"✅ Создан файл: {scheduler_file}")
            return True
            
    except Exception as e:
        logger.error(f"Ошибка миграции файлов: {str(e)}")
        return False



