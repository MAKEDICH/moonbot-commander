"""
Система обновлений MoonBot Commander

Обеспечивает безопасное обновление приложения с защитой данных пользователя.
Поддерживает обновление с любой старой версии на актуальную.
"""

from .update_manager import UpdateManager
from .versioned_migration import VersionedMigrationSystem
from .safe_executor import SafeUpdateExecutor

__all__ = [
    'UpdateManager',
    'VersionedMigrationSystem',
    'SafeUpdateExecutor',
]


