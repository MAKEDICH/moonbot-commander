"""
VersionedMigrationSystem - Система версионированных миграций

Ключевые принципы:
1. Каждая миграция привязана к версии приложения
2. Миграции применяются последовательно от текущей до целевой версии
3. Каждая миграция идемпотентна (можно применить повторно без последствий)
4. Автоматический откат при ошибке
5. Полное сохранение данных пользователя

Это решает проблему обновления с версий "10 штук назад" - 
система автоматически применит все промежуточные миграции в правильном порядке.
"""

import sqlite3
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Callable
import logging

from .migration_base import Migration, MigrationStatus
from .migration_definitions import MigrationDefinitionsMixin
from .migration_registry import MigrationRegistryMixin

logger = logging.getLogger(__name__)


class VersionedMigrationSystem(MigrationDefinitionsMixin, MigrationRegistryMixin):
    """
    Система версионированных миграций.
    
    Гарантирует безопасное обновление БД с любой версии на любую другую.
    Все миграции выполняются в транзакции с автоматическим откатом при ошибке.
    """
    
    # Реестр всех миграций, упорядоченных по версиям
    # Формат: version -> List[Migration]
    _migrations_registry: Dict[str, List[Migration]] = {}
    
    def __init__(self, db_path: str = "moonbot_commander.db"):
        self.db_path = Path(db_path)
        self.backup_dir = self.db_path.parent / "migration_backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Регистрируем все миграции
        self._register_all_migrations()
    
    def _register_all_migrations(self):
        """Регистрация всех миграций в системе"""
        # Миграции сгруппированы по версиям
        # При обновлении с v1.0.0 до v2.1.9 будут применены все миграции
        # от v1.0.0 до v2.1.9 в правильном порядке
        
        self._register_v1_migrations()
        self._register_v2_0_migrations()
        self._register_v2_1_migrations()
    
    def _register_migration(self, migration: Migration):
        """Зарегистрировать миграцию в реестре"""
        if migration.version not in self._migrations_registry:
            self._migrations_registry[migration.version] = []
        self._migrations_registry[migration.version].append(migration)
    
    # ============================================================
    # Вспомогательные методы для проверки структуры БД
    # ============================================================
    
    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        """Проверить существование таблицы"""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        return cursor.fetchone() is not None
    
    def _column_exists(self, conn: sqlite3.Connection, table_name: str, column_name: str) -> bool:
        """Проверить существование колонки"""
        cursor = conn.cursor()
        try:
            cursor.execute(f"PRAGMA table_info({table_name})")
            columns = {row[1] for row in cursor.fetchall()}
            return column_name in columns
        except Exception:
            return False
    
    # ============================================================
    # Основные методы системы миграций
    # ============================================================
    
    def get_current_version(self) -> str:
        """Получить текущую версию БД"""
        if not self.db_path.exists():
            return "0.0.0"
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Проверяем таблицу версий
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='_schema_version'"
        )
        
        if cursor.fetchone():
            cursor.execute("SELECT version FROM _schema_version ORDER BY applied_at DESC LIMIT 1")
            row = cursor.fetchone()
            if row:
                conn.close()
                return row[0]
        
        conn.close()
        return "0.0.0"
    
    def get_pending_migrations(self, target_version: str) -> List[Migration]:
        """
        Получить список миграций, которые нужно применить.
        
        Args:
            target_version: Целевая версия
            
        Returns:
            Список миграций в порядке применения
        """
        from packaging import version as pkg_version
        
        pending = []
        current = self.get_current_version()
        
        conn = sqlite3.connect(self.db_path)
        
        # Получаем уже примененные миграции
        applied = set()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations_registry'"
            )
            if cursor.fetchone():
                cursor.execute("SELECT migration_name FROM _migrations_registry WHERE status='success'")
                applied = {row[0] for row in cursor.fetchall()}
        except Exception:
            pass
        
        # Собираем все миграции от текущей до целевой версии
        sorted_versions = sorted(
            self._migrations_registry.keys(),
            key=lambda v: pkg_version.parse(v)
        )
        
        for ver in sorted_versions:
            try:
                if pkg_version.parse(ver) > pkg_version.parse(current):
                    if pkg_version.parse(ver) <= pkg_version.parse(target_version):
                        for migration in self._migrations_registry[ver]:
                            if migration.name not in applied:
                                if migration.needs_migration(conn):
                                    pending.append(migration)
            except Exception:
                continue
        
        conn.close()
        return pending
    
    def create_backup(self) -> Tuple[bool, str]:
        """
        Создать полный бэкап перед миграцией.
        
        Returns:
            (success, backup_path_or_error)
        """
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_path = self.backup_dir / f"pre_migration_{timestamp}.db"
            
            if self.db_path.exists():
                shutil.copy2(self.db_path, backup_path)
                logger.info(f"✅ Создан бэкап: {backup_path}")
                return True, str(backup_path)
            else:
                return False, "База данных не найдена"
                
        except Exception as e:
            logger.error(f"Ошибка создания бэкапа: {e}")
            return False, str(e)
    
    def migrate_to_version(
        self, 
        target_version: str,
        progress_callback: Optional[Callable[[str, int, int], None]] = None
    ) -> Tuple[bool, List[str], List[str]]:
        """
        Выполнить миграцию до указанной версии.
        
        Args:
            target_version: Целевая версия
            progress_callback: Callback(migration_name, current, total)
            
        Returns:
            (success, applied_migrations, errors)
        """
        logger.info(f"🚀 Начало миграции до версии {target_version}")
        
        # Получаем список миграций
        pending = self.get_pending_migrations(target_version)
        
        if not pending:
            logger.info("✅ Миграции не требуются")
            return True, [], []
        
        logger.info(f"📋 Найдено {len(pending)} миграций для применения")
        
        # Создаём бэкап
        success, backup_result = self.create_backup()
        if not success:
            return False, [], [f"Не удалось создать бэкап: {backup_result}"]
        
        # Подключаемся к БД
        conn = sqlite3.connect(self.db_path)
        
        # Создаём таблицу реестра миграций
        self._ensure_migrations_registry(conn)
        
        applied = []
        errors = []
        
        for i, migration in enumerate(pending):
            try:
                if progress_callback:
                    progress_callback(migration.name, i + 1, len(pending))
                
                logger.info(f"▶️  [{i+1}/{len(pending)}] {migration.name}: {migration.description}")
                
                # Проверяем зависимости
                for dep in migration.dependencies:
                    if dep not in applied:
                        # Ищем зависимость в уже примененных
                        cursor = conn.cursor()
                        cursor.execute(
                            "SELECT COUNT(*) FROM _migrations_registry WHERE migration_name=? AND status='success'",
                            (dep,)
                        )
                        if cursor.fetchone()[0] == 0:
                            raise Exception(f"Зависимость не выполнена: {dep}")
                
                # Применяем миграцию
                if migration.up(conn):
                    conn.commit()
                    self._mark_migration_applied(conn, migration)
                    applied.append(migration.name)
                    logger.info(f"✅ {migration.name} применена успешно")
                else:
                    raise Exception("Миграция вернула False")
                    
            except Exception as e:
                conn.rollback()
                error_msg = f"{migration.name}: {str(e)}"
                errors.append(error_msg)
                logger.error(f"❌ {error_msg}")
                
                # Отмечаем как неудачную
                self._mark_migration_failed(conn, migration, str(e))
                
                # Прерываем миграцию
                break
        
        # Обновляем версию схемы
        if applied and not errors:
            self._update_schema_version(conn, target_version)
        
        conn.close()
        
        if errors:
            logger.error(f"⚠️  Миграция завершена с ошибками. Бэкап: {backup_result}")
        else:
            logger.info(f"✅ Миграция успешно завершена! Применено: {len(applied)}")
        
        return len(errors) == 0, applied, errors
    
    def _ensure_migrations_registry(self, conn: sqlite3.Connection):
        """Создать таблицу реестра миграций"""
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS _migrations_registry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                migration_name TEXT UNIQUE NOT NULL,
                version TEXT NOT NULL,
                description TEXT,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'success'
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS _schema_version (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        conn.commit()
    
    def _mark_migration_applied(self, conn: sqlite3.Connection, migration: Migration):
        """Отметить миграцию как примененную"""
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO _migrations_registry 
            (migration_name, version, description, applied_at, status)
            VALUES (?, ?, ?, ?, 'success')
        """, (migration.name, migration.version, migration.description, datetime.now().isoformat()))
        conn.commit()
    
    def _mark_migration_failed(self, conn: sqlite3.Connection, migration: Migration, error: str):
        """Отметить миграцию как неудачную"""
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO _migrations_registry 
            (migration_name, version, description, applied_at, status)
            VALUES (?, ?, ?, ?, 'failed')
        """, (migration.name, migration.version, error, datetime.now().isoformat()))
        conn.commit()
    
    def _update_schema_version(self, conn: sqlite3.Connection, version: str):
        """Обновить версию схемы"""
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO _schema_version (version, applied_at) VALUES (?, ?)",
            (version, datetime.now().isoformat())
        )
        conn.commit()
    
    def rollback_to_backup(self, backup_path: str) -> Tuple[bool, str]:
        """
        Откатить БД к бэкапу.
        
        Args:
            backup_path: Путь к файлу бэкапа
            
        Returns:
            (success, message)
        """
        try:
            backup = Path(backup_path)
            if not backup.exists():
                return False, f"Бэкап не найден: {backup_path}"
            
            # Создаём бэкап текущего состояния
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            current_backup = self.backup_dir / f"before_rollback_{timestamp}.db"
            
            if self.db_path.exists():
                shutil.copy2(self.db_path, current_backup)
            
            # Восстанавливаем из бэкапа
            shutil.copy2(backup, self.db_path)
            
            logger.info(f"✅ БД восстановлена из {backup_path}")
            return True, f"Восстановлено из {backup.name}"
            
        except Exception as e:
            logger.error(f"Ошибка отката: {e}")
            return False, str(e)
    
    def get_migration_history(self) -> List[Dict]:
        """Получить историю миграций"""
        if not self.db_path.exists():
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT migration_name, version, description, applied_at, status
                FROM _migrations_registry
                ORDER BY applied_at DESC
            """)
            
            history = []
            for row in cursor.fetchall():
                history.append({
                    "name": row[0],
                    "version": row[1],
                    "description": row[2],
                    "applied_at": row[3],
                    "status": row[4],
                })
            
            conn.close()
            return history
            
        except Exception:
            conn.close()
            return []


# Глобальный экземпляр
versioned_migration = VersionedMigrationSystem()
