"""
Реестр миграций - гениальная система отслеживания примененных миграций
Хранит информацию о том, какие миграции уже применены, чтобы не применять их повторно
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional

class MigrationsRegistry:
    """Реестр примененных миграций"""
    
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = self._find_db_path()
        self.db_path = db_path
        self._ensure_registry_table()
    
    def _find_db_path(self) -> Path:
        """Найти путь к БД moonbot_commander.db"""
        # backend/updates/core/migrations_registry.py -> backend/
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
    
    def _ensure_registry_table(self):
        """Создать таблицу для отслеживания миграций если её нет"""
        try:
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
            
        except Exception as e:
            print(f"[ERROR] Failed to create migrations registry: {e}")
    
    def is_applied(self, migration_name: str) -> bool:
        """Проверить применена ли миграция"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT COUNT(*) FROM _migrations_registry WHERE migration_name = ? AND status = 'success'",
                (migration_name,)
            )
            count = cursor.fetchone()[0]
            conn.close()
            
            return count > 0
            
        except Exception as e:
            print(f"[ERROR] Failed to check migration status: {e}")
            return False
    
    def mark_applied(self, migration_name: str, description: str = ""):
        """Отметить миграцию как примененную"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO _migrations_registry (migration_name, applied_at, description, status)
                VALUES (?, ?, ?, 'success')
            """, (migration_name, datetime.now().isoformat(), description))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"[ERROR] Failed to mark migration as applied: {e}")
    
    def mark_failed(self, migration_name: str, error: str = ""):
        """Отметить миграцию как неудачную"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                INSERT OR REPLACE INTO _migrations_registry (migration_name, applied_at, description, status)
                VALUES (?, ?, ?, 'failed')
            """, (migration_name, datetime.now().isoformat(), error))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            print(f"[ERROR] Failed to mark migration as failed: {e}")
    
    def get_applied_migrations(self) -> List[Dict]:
        """Получить список всех примененных миграций"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT migration_name, applied_at, description, status
                FROM _migrations_registry
                ORDER BY applied_at DESC
            """)
            
            migrations = []
            for row in cursor.fetchall():
                migrations.append({
                    'name': row[0],
                    'applied_at': row[1],
                    'description': row[2],
                    'status': row[3]
                })
            
            conn.close()
            return migrations
            
        except Exception as e:
            print(f"[ERROR] Failed to get applied migrations: {e}")
            return []
    
    def get_pending_migrations(self) -> List[str]:
        """Получить список неприменённых миграций"""
        import glob
        
        # Находим все файлы миграций
        migrations_dir = Path(__file__).parent
        migration_files = sorted(glob.glob(str(migrations_dir / "migrate_*.py")))
        
        pending = []
        for file_path in migration_files:
            migration_name = Path(file_path).stem
            if not self.is_applied(migration_name):
                pending.append(migration_name)
        
        return pending


def run_all_pending_migrations():
    """Запустить все неприменённые миграции"""
    import importlib
    import sys
    
    registry = MigrationsRegistry()
    pending = registry.get_pending_migrations()
    
    if not pending:
        print("[INFO] No pending migrations")
        return True
    
    print(f"[INFO] Found {len(pending)} pending migrations")
    
    all_success = True
    for migration_name in pending:
        print(f"\n[RUNNING] {migration_name}...")
        
        try:
            # Импортируем модуль миграции
            module = importlib.import_module(migration_name)
            
            # Запускаем функцию migrate()
            if hasattr(module, 'migrate'):
                success = module.migrate()
                
                if success:
                    # Получаем описание из docstring
                    description = module.__doc__ or ""
                    description = description.strip().split('\n')[0]  # Первая строка
                    
                    registry.mark_applied(migration_name, description)
                    print(f"[SUCCESS] {migration_name} applied")
                else:
                    registry.mark_failed(migration_name, "Migration function returned False")
                    print(f"[FAILED] {migration_name} failed")
                    all_success = False
            else:
                print(f"[ERROR] {migration_name} has no migrate() function")
                registry.mark_failed(migration_name, "No migrate() function")
                all_success = False
                
        except Exception as e:
            print(f"[ERROR] {migration_name} crashed: {e}")
            registry.mark_failed(migration_name, str(e))
            all_success = False
    
    return all_success


if __name__ == '__main__':
    success = run_all_pending_migrations()
    exit(0 if success else 1)


