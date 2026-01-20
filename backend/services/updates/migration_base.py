"""
Базовые классы и типы для системы миграций.

Содержит:
- MigrationStatus - перечисление статусов миграции
- Migration - dataclass описания одной миграции
"""

import sqlite3
from typing import List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum


class MigrationStatus(Enum):
    """Статус миграции"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"
    ROLLED_BACK = "rolled_back"


@dataclass
class Migration:
    """
    Описание одной миграции.
    
    Attributes:
        version: Версия приложения, к которой относится миграция
        name: Уникальное имя миграции
        description: Описание что делает миграция
        up: Функция применения миграции
        down: Функция отката миграции (опционально)
        check: Функция проверки нужна ли миграция (опционально)
        dependencies: Список миграций, которые должны быть применены до этой
    """
    version: str
    name: str
    description: str
    up: Callable[[sqlite3.Connection], bool]
    down: Optional[Callable[[sqlite3.Connection], bool]] = None
    check: Optional[Callable[[sqlite3.Connection], bool]] = None
    dependencies: List[str] = field(default_factory=list)
    
    def needs_migration(self, conn: sqlite3.Connection) -> bool:
        """Проверить, нужно ли применять эту миграцию"""
        if self.check:
            return self.check(conn)
        return True


