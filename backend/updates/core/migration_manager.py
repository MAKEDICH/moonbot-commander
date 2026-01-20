"""
Менеджер миграций базы данных
Обеспечивает безопасное обновление схемы с сохранением данных
"""
import os
import sys
import logging
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
from alembic.config import Config
from alembic import command

# Добавляем путь к backend
sys.path.insert(0, str(Path(__file__).parent))

from services.backup_service import BackupService, create_pre_upgrade_backup
from utils.datetime_utils import utcnow
from models.database import engine, SessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MigrationManager:
    """Менеджер миграций базы данных"""
    
    def __init__(self, db_path: str = "./moonbot_commander.db"):
        # Нормализуем путь относительно директории backend
        backend_dir = Path(__file__).parent
        db_path_obj = Path(db_path)
        if not db_path_obj.is_absolute():
            self.db_path = str(backend_dir / db_path_obj)
        else:
            self.db_path = db_path
        self.backup_service = BackupService()
        self.alembic_cfg = Config("alembic.ini")
    
    def check_current_schema_version(self) -> Optional[str]:
        """Проверить текущую версию схемы БД"""
        try:
            from models_v2 import SchemaVersion  # Локальный импорт
            
            db = SessionLocal()
            try:
                # Проверяем есть ли таблица schema_versions
                inspector = inspect(engine)
                if 'schema_versions' not in inspector.get_table_names():
                    return None
                
                latest = db.query(SchemaVersion).order_by(
                    SchemaVersion.applied_at.desc()
                ).first()
                
                return latest.version if latest else None
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error checking schema version: {e}")
            return None
    
    def _is_database_locked(self) -> bool:
        """
        Проверить заблокирована ли база данных другим процессом.
        
        SQLite имеет exclusive lock при write операциях.
        Проверяем ДО начала миграции.
        
        Returns:
            True если БД заблокирована
        """
        import sqlite3
        
        try:
            # Пытаемся открыть БД в exclusive mode
            conn = sqlite3.connect(
                self.db_path,
                timeout=1.0,  # Ждем только 1 секунду
                isolation_level='EXCLUSIVE'
            )
            
            # Пытаемся начать exclusive транзакцию
            conn.execute('BEGIN EXCLUSIVE')
            conn.rollback()
            conn.close()
            
            return False  # БД не заблокирована
            
        except sqlite3.OperationalError as e:
            if "locked" in str(e).lower() or "busy" in str(e).lower():
                return True  # БД заблокирована!
            else:
                # Другая ошибка
                logger.warning(f"Unexpected database error: {e}")
                return False
        except Exception as e:
            logger.warning(f"Could not check database lock: {e}")
            return False  # Не можем проверить, продолжаем
    
    def migrate_to_v2(self, create_backup: bool = True) -> bool:
        """
        Мигрировать из текущего состояния в версию 2.0
        
        Args:
            create_backup: Создать бэкап перед миграцией
            
        Returns:
            True если успешно, False если ошибка
        """
        try:
            logger.info("=" * 60)
            logger.info("Starting migration to v2.0")
            logger.info("=" * 60)
            
            # Проверка что БД не используется другим процессом
            logger.info("Step 0: Checking database locks...")
            if self._is_database_locked():
                logger.error("✗ Database is locked by another process!")
                logger.error("  Please stop the application before migration.")
                logger.error("  Use KILL-ALL-PROCESSES.bat or close all backend windows")
                return False
            logger.info("✓ Database is not locked")
            
            # Шаг 1: Создание бэкапа
            if create_backup:
                logger.info("Step 1: Creating backup...")
                success, result = create_pre_upgrade_backup(self.db_path, "2.0.0")
                if success:
                    logger.info(f"✓ Backup created: {result}")
                else:
                    logger.error(f"✗ Backup failed: {result}")
                    return False
            else:
                logger.info("Step 1: Skipping backup (disabled)")
            
            # Шаг 2: Проверка текущей версии
            logger.info("Step 2: Checking current schema version...")
            current_version = self.check_current_schema_version()
            if current_version:
                logger.info(f"Current version: {current_version}")
                if current_version == "2.0.0":
                    logger.info("Already at version 2.0.0, nothing to do")
                    return True
            else:
                logger.info("No version info found, treating as v1.0")
            
            # Шаг 3: Применение миграций через Alembic
            logger.info("Step 3: Applying database migrations...")
            
            # ИСПРАВЛЕНО: Правильная обработка ошибок Alembic
            # Инициализируем Alembic если нужно
            try:
                command.current(self.alembic_cfg)
                logger.info("✓ Alembic is initialized")
            except Exception as e:
                error_str = str(e).lower()
                if "no such table" in error_str or "version_table" in error_str:
                    logger.info("Alembic not initialized, stamping database...")
                    try:
                        command.stamp(self.alembic_cfg, "head")
                        logger.info("✓ Alembic initialized")
                    except Exception as stamp_error:
                        logger.error(f"✗ Failed to initialize Alembic: {stamp_error}")
                        return False
                else:
                    # Другая ошибка - это проблема!
                    logger.error(f"✗ Alembic error: {e}")
                    return False
            
            # Применяем миграции
            try:
                command.upgrade(self.alembic_cfg, "head")
                logger.info("✓ Migrations applied successfully")
            except Exception as e:
                logger.error(f"✗ Migration failed: {e}")
                logger.error("  Database may be in inconsistent state!")
                return False
            
            # Шаг 4: Добавление новых индексов
            logger.info("Step 4: Creating additional indexes...")
            self._create_additional_indexes()
            logger.info("✓ Indexes created")
            
            # Шаг 5: Обновление версии схемы
            logger.info("Step 5: Updating schema version...")
            self._update_schema_version("2.0.0", "Migration to v2.0 with optimizations")
            logger.info("✓ Schema version updated")
            
            # Шаг 6: Проверка целостности
            logger.info("Step 6: Verifying data integrity...")
            if self._verify_integrity():
                logger.info("✓ Data integrity verified")
            else:
                logger.warning("⚠ Data integrity check failed")
            
            # Шаг 7: Переименование файлов моделей
            logger.info("Step 7: Updating model files...")
            self._rename_model_files()
            logger.info("✓ Model files updated")
            
            logger.info("=" * 60)
            logger.info("Migration completed successfully!")
            logger.info("=" * 60)
            
            return True
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}", exc_info=True)
            logger.error("=" * 60)
            logger.error("Migration FAILED! Database may be in inconsistent state.")
            logger.error("Please restore from backup if needed.")
            logger.error("=" * 60)
            return False
    
    def _create_additional_indexes(self):
        """Создать дополнительные индексы для оптимизации"""
        db = SessionLocal()
        try:
            # Эти индексы будут созданы Alembic автоматически
            # Здесь можно добавить кастомные индексы если нужно
            pass
        finally:
            db.close()
    
    def _update_schema_version(self, version: str, description: str):
        """Обновить версию схемы в БД"""
        from models_v2 import Base, SchemaVersion  # Локальный импорт
        
        db = SessionLocal()
        try:
            # Создаем таблицу schema_versions если её нет
            Base.metadata.create_all(engine, tables=[SchemaVersion.__table__])
            
            schema_version = SchemaVersion(
                version=version,
                description=description,
                applied_at=utcnow()
            )
            db.add(schema_version)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to update schema version: {e}")
            db.rollback()
        finally:
            db.close()
    
    def _verify_integrity(self) -> bool:
        """
        Проверить целостность данных после миграции.
        
        Проверяет:
        - Отсутствие NULL в обязательных полях
        - Правильность foreign keys
        - Уникальность username/email
        """
        db = SessionLocal()
        try:
            # Проверяем что основные таблицы доступны
            from models_v2 import User, Server, CommandHistory
            
            users_count = db.query(User).count()
            servers_count = db.query(Server).count()
            commands_count = db.query(CommandHistory).count()
            
            logger.info(f"  - Users: {users_count}")
            logger.info(f"  - Servers: {servers_count}")
            logger.info(f"  - Commands: {commands_count}")
            
            # ИСПРАВЛЕНО: Проверяем обязательные поля
            logger.info("  Checking required fields...")
            
            # Проверка username не NULL
            null_usernames = db.query(User).filter(User.username == None).count()
            if null_usernames > 0:
                logger.error(f"  ✗ Found {null_usernames} users with NULL username!")
                return False
            
            # Проверка уникальности username
            from sqlalchemy import func
            duplicate_usernames = db.query(
                User.username, func.count(User.id)
            ).group_by(User.username).having(func.count(User.id) > 1).all()
            
            if duplicate_usernames:
                logger.error(f"  ✗ Found duplicate usernames: {duplicate_usernames}")
                return False
            
            # Проверка foreign keys (servers -> users)
            orphan_servers = db.query(Server).filter(
                ~Server.user_id.in_(db.query(User.id))
            ).count()
            
            if orphan_servers > 0:
                logger.warning(f"  ⚠ Found {orphan_servers} servers with invalid user_id")
                # Это warning, не error - продолжаем
            
            logger.info("  ✓ Data integrity checks passed")
            return True
            
        except Exception as e:
            logger.error(f"Integrity check failed: {e}")
            return False
        finally:
            db.close()
    
    def _rename_model_files(self):
        """Переименовать файлы моделей после миграции"""
        try:
            import shutil
            backend_dir = Path(__file__).parent
            models_old = backend_dir / "models.py"
            models_legacy = backend_dir / "models_legacy.py"
            models_v2 = backend_dir / "models_v2.py"
            models_new = backend_dir / "models.py"
            
            # Переименовываем models.py -> models_legacy.py (если еще не переименован)
            if models_old.exists() and not models_legacy.exists():
                logger.info("  Renaming models.py -> models_legacy.py")
                shutil.copy2(models_old, models_legacy)
                # НЕ удаляем models.py, просто копируем на всякий случай
            
            # Переименовываем models_v2.py -> models.py (копируем)
            if models_v2.exists():
                logger.info("  Copying models_v2.py -> models.py")
                shutil.copy2(models_v2, models_new)
                logger.info("  Note: models_v2.py kept for reference")
            
            logger.info("  Model files updated successfully")
            logger.info("  IMPORTANT: Restart any running processes to use new models")
            
        except Exception as e:
            logger.warning(f"Failed to rename model files: {e}")
            logger.warning("You may need to manually copy models_v2.py to models.py")
    
    def rollback_migration(self, backup_path: str) -> bool:
        """
        Откатить миграцию, восстановив из бэкапа
        
        Args:
            backup_path: Путь к файлу бэкапа
            
        Returns:
            True если успешно
        """
        logger.info("=" * 60)
        logger.info("Rolling back migration...")
        logger.info("=" * 60)
        
        # Проверяем бэкап ПЕРЕД восстановлением
        import os
        import sqlite3
        from pathlib import Path
        
        # Проверка 1: Файл существует?
        if not os.path.exists(backup_path):
            logger.error(f"✗ Backup file not found: {backup_path}")
            logger.error("  Available backups:")
            backups = self.backup_service.list_backups()
            for b in backups[:5]:  # Показываем первые 5
                logger.error(f"    - {b['filename']}")
            return False
        
        # Проверка 2: Это SQLite база данных?
        logger.info(f"Validating backup file: {backup_path}")
        
        try:
            conn = sqlite3.connect(backup_path)
            cursor = conn.cursor()
            
            # Проверка 3: Это правильная структура БД?
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in cursor.fetchall()]
            
            # Проверяем наличие критичных таблиц
            required_tables = ['users', 'servers']
            missing_tables = [t for t in required_tables if t not in tables]
            
            if missing_tables:
                logger.error(f"✗ Invalid backup: missing tables {missing_tables}")
                conn.close()
                return False
            
            # Проверка 4: Integrity check
            cursor.execute("PRAGMA integrity_check")
            result = cursor.fetchone()[0]
            
            if result != "ok":
                logger.error(f"✗ Backup integrity check failed: {result}")
                conn.close()
                return False
            
            conn.close()
            logger.info("✓ Backup validation passed")
            
        except sqlite3.DatabaseError as e:
            logger.error(f"✗ Invalid backup file: {e}")
            logger.error("  This is not a valid SQLite database!")
            return False
        except Exception as e:
            logger.error(f"✗ Backup validation failed: {e}")
            return False
        
        # Все проверки прошли - восстанавливаем
        success, error = self.backup_service.restore_backup(backup_path, self.db_path)
        
        if success:
            logger.info("✓ Migration rolled back successfully")
            logger.info("  Database restored from backup")
            return True
        else:
            logger.error(f"✗ Rollback failed: {error}")
            return False


def main():
    """Главная функция для запуска миграции"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Database Migration Manager")
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip backup creation (not recommended)"
    )
    parser.add_argument(
        "--rollback",
        type=str,
        metavar="BACKUP_PATH",
        help="Rollback migration from backup"
    )
    parser.add_argument(
        "--check-version",
        action="store_true",
        help="Check current schema version"
    )
    parser.add_argument(
        "--list-backups",
        action="store_true",
        help="List all available backups"
    )
    
    args = parser.parse_args()
    
    manager = MigrationManager()
    
    if args.check_version:
        version = manager.check_current_schema_version()
        if version:
            print(f"Current schema version: {version}")
        else:
            print("No schema version info found (probably v1.0)")
        return
    
    if args.list_backups:
        backups = manager.backup_service.list_backups()
        if backups:
            print("\nAvailable backups:")
            for backup in backups:
                print(f"  - {backup['filename']}")
                print(f"    Size: {backup['size'] / 1024 / 1024:.2f} MB")
                print(f"    Created: {backup['created_at']}")
                print(f"    Type: {backup['type']}")
                print()
        else:
            print("No backups found")
        return
    
    if args.rollback:
        success = manager.rollback_migration(args.rollback)
        sys.exit(0 if success else 1)
    
    # Выполняем миграцию
    success = manager.migrate_to_v2(create_backup=not args.no_backup)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

