"""
Базовые методы для импортёра данных.

Содержит вспомогательные методы для работы с БД:
- Поиск пути к БД
- Создание бэкапов
- Работа с таблицами и колонками
- Вставка и обновление строк
"""

import sqlite3
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Set

logger = logging.getLogger(__name__)


class ImporterBaseMixin:
    """
    Mixin с базовыми методами для импортёра.
    
    Предоставляет методы для работы с БД на низком уровне.
    """
    
    def _find_db_path(self) -> Path:
        """Найти путь к БД"""
        current_file = Path(__file__).resolve()
        backend_dir = current_file.parent.parent.parent
        
        db_path = backend_dir / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        
        project_root = backend_dir.parent
        db_path = project_root / "moonbot_commander.db"
        if db_path.exists():
            return db_path
        
        return backend_dir / "moonbot_commander.db"
    
    def _create_backup(self) -> Optional[Path]:
        """Создать бэкап БД перед импортом"""
        if not self.db_path.exists():
            return None
        
        backup_dir = self.db_path.parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"pre_import_{timestamp}.db"
        
        shutil.copy2(self.db_path, backup_path)
        logger.info(f"Создан бэкап БД: {backup_path}")
        
        return backup_path
    
    def _get_existing_columns(self, conn: sqlite3.Connection, table: str) -> Set[str]:
        """Получить список колонок таблицы"""
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cursor.fetchall()}
    
    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        """Проверить существование таблицы"""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        return cursor.fetchone() is not None
    
    def _get_primary_key(self, conn: sqlite3.Connection, table: str) -> Optional[str]:
        """Получить имя первичного ключа таблицы"""
        cursor = conn.cursor()
        cursor.execute(f"PRAGMA table_info({table})")
        for row in cursor.fetchall():
            if row[5] == 1:  # pk column
                return row[1]
        return None
    
    def _insert_row(self, cursor, table_name: str, row: Dict):
        """Вставить строку в таблицу"""
        columns = list(row.keys())
        placeholders = ", ".join(["?" for _ in columns])
        columns_str = ", ".join(columns)
        
        cursor.execute(
            f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})",
            list(row.values())
        )
    
    def _update_row(self, cursor, table_name: str, row: Dict, pk_column: str):
        """Обновить строку в таблице"""
        pk_value = row[pk_column]
        update_columns = {k: v for k, v in row.items() if k != pk_column}
        
        if not update_columns:
            return
        
        set_clause = ", ".join([f"{k} = ?" for k in update_columns.keys()])
        values = list(update_columns.values()) + [pk_value]
        
        cursor.execute(
            f"UPDATE {table_name} SET {set_clause} WHERE {pk_column} = ?",
            values
        )
    
    def _import_table(
        self,
        conn: sqlite3.Connection,
        table_name: str,
        data: List[Dict],
        mode: str
    ) -> Dict[str, Any]:
        """
        Импортировать данные в таблицу.
        
        Args:
            conn: Соединение с БД
            table_name: Имя таблицы
            data: Данные для импорта
            mode: Режим импорта
            
        Returns:
            {"imported": int, "skipped": int, "errors": list}
        """
        existing_columns = self._get_existing_columns(conn, table_name)
        pk_column = self._get_primary_key(conn, table_name)
        
        imported_count = 0
        skipped_count = 0
        errors = []
        
        cursor = conn.cursor()
        
        for row in data:
            # Фильтруем только существующие колонки
            filtered_row = {k: v for k, v in row.items() if k in existing_columns}
            
            if not filtered_row:
                skipped_count += 1
                continue
            
            try:
                if mode == "replace":
                    # Удаляем существующую запись и вставляем новую
                    if pk_column and pk_column in filtered_row:
                        cursor.execute(
                            f"DELETE FROM {table_name} WHERE {pk_column} = ?",
                            (filtered_row[pk_column],)
                        )
                    
                    self._insert_row(cursor, table_name, filtered_row)
                    imported_count += 1
                    
                elif mode == "skip":
                    # Пропускаем если запись существует
                    if pk_column and pk_column in filtered_row:
                        cursor.execute(
                            f"SELECT 1 FROM {table_name} WHERE {pk_column} = ?",
                            (filtered_row[pk_column],)
                        )
                        if cursor.fetchone():
                            skipped_count += 1
                            continue
                    
                    self._insert_row(cursor, table_name, filtered_row)
                    imported_count += 1
                    
                else:  # merge
                    # Обновляем если существует, иначе вставляем
                    if pk_column and pk_column in filtered_row:
                        cursor.execute(
                            f"SELECT 1 FROM {table_name} WHERE {pk_column} = ?",
                            (filtered_row[pk_column],)
                        )
                        if cursor.fetchone():
                            # Обновляем
                            self._update_row(cursor, table_name, filtered_row, pk_column)
                        else:
                            # Вставляем
                            self._insert_row(cursor, table_name, filtered_row)
                    else:
                        self._insert_row(cursor, table_name, filtered_row)
                    
                    imported_count += 1
                    
            except sqlite3.IntegrityError as e:
                skipped_count += 1
                errors.append(f"{table_name}: {e}")
            except Exception as e:
                errors.append(f"{table_name}: {e}")
        
        return {
            "imported": imported_count,
            "skipped": skipped_count,
            "errors": errors
        }


