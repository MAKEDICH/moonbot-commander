"""
Модуль импорта данных пользователя.

Безопасно импортирует данные из зашифрованного файла экспорта,
обрабатывая конфликты и миграции схемы.
"""

import json
import gzip
import logging
import sqlite3
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Any

from .crypto import DataCrypto
from .importer_base import ImporterBaseMixin

logger = logging.getLogger(__name__)


class DataImporter(ImporterBaseMixin):
    """
    Импортёр данных пользователя.
    
    Безопасно импортирует данные из зашифрованного файла,
    создавая бэкап перед импортом и обрабатывая конфликты.
    """
    
    # Поддерживаемые версии формата экспорта
    SUPPORTED_VERSIONS = ["1.0", "1.1"]
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Инициализация импортёра.
        
        Args:
            db_path: Путь к БД (если не указан, определяется автоматически)
        """
        if db_path is None:
            db_path = self._find_db_path()
        self.db_path = db_path
        self.crypto = DataCrypto()
    
    def validate_file(self, encrypted_data: bytes, password: str) -> Dict[str, Any]:
        """
        Валидировать файл экспорта без импорта.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль для расшифровки
            
        Returns:
            {
                "valid": bool,
                "version": str,
                "created_at": str,
                "app_version": str,
                "tables": dict,
                "error": str или None
            }
        """
        try:
            # Расшифровываем
            success, decrypted_data, error = self.crypto.decrypt(encrypted_data, password)
            
            if not success:
                return {
                    "valid": False,
                    "error": error
                }
            
            # Распаковываем
            json_data = gzip.decompress(decrypted_data).decode('utf-8')
            export_data = json.loads(json_data)
            
            # Проверяем версию
            version = export_data.get("version", "unknown")
            if version not in self.SUPPORTED_VERSIONS:
                return {
                    "valid": False,
                    "error": f"Версия формата '{version}' не поддерживается"
                }
            
            # Собираем статистику
            tables_stats = {}
            for table_name, table_data in export_data.get("tables", {}).items():
                tables_stats[table_name] = len(table_data)
            
            return {
                "valid": True,
                "version": version,
                "created_at": export_data.get("created_at"),
                "app_version": export_data.get("app_version"),
                "tables": tables_stats,
                "error": None
            }
            
        except json.JSONDecodeError:
            return {
                "valid": False,
                "error": "Файл повреждён: невалидный JSON"
            }
        except gzip.BadGzipFile:
            return {
                "valid": False,
                "error": "Файл повреждён: ошибка распаковки"
            }
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }
    
    def import_data(
        self,
        encrypted_data: bytes,
        password: str,
        mode: str = "merge",
        tables_to_import: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Импортировать данные из зашифрованного файла.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль для расшифровки
            mode: Режим импорта:
                - "merge": Объединить с существующими данными (по умолчанию)
                - "replace": Заменить существующие данные
                - "skip": Пропустить существующие записи
            tables_to_import: Список таблиц для импорта (None = все)
            
        Returns:
            {
                "success": bool,
                "backup_path": str,
                "imported": dict,
                "skipped": dict,
                "errors": list,
                "error": str или None
            }
        """
        try:
            # Расшифровываем
            success, decrypted_data, error = self.crypto.decrypt(encrypted_data, password)
            
            if not success:
                return {
                    "success": False,
                    "backup_path": None,
                    "imported": {},
                    "skipped": {},
                    "errors": [],
                    "error": error
                }
            
            # Распаковываем
            json_data = gzip.decompress(decrypted_data).decode('utf-8')
            export_data = json.loads(json_data)
            
            # Проверяем версию
            version = export_data.get("version", "unknown")
            if version not in self.SUPPORTED_VERSIONS:
                return {
                    "success": False,
                    "backup_path": None,
                    "imported": {},
                    "skipped": {},
                    "errors": [],
                    "error": f"Версия формата '{version}' не поддерживается"
                }
            
            # Создаём бэкап
            backup_path = self._create_backup()
            
            # Открываем соединение с БД
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA foreign_keys = OFF")
            
            imported = {}
            skipped = {}
            errors = []
            
            tables = export_data.get("tables", {})
            
            for table_name, table_data in tables.items():
                # Пропускаем если таблица не в списке для импорта
                if tables_to_import and table_name not in tables_to_import:
                    continue
                
                # Пропускаем если таблица не существует
                if not self._table_exists(conn, table_name):
                    errors.append(f"Таблица {table_name} не существует в БД")
                    continue
                
                try:
                    result = self._import_table(
                        conn, table_name, table_data, mode
                    )
                    imported[table_name] = result["imported"]
                    skipped[table_name] = result["skipped"]
                    
                    if result.get("errors"):
                        errors.extend(result["errors"])
                        
                except Exception as e:
                    errors.append(f"Ошибка импорта таблицы {table_name}: {e}")
            
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()
            conn.close()
            
            logger.info(f"Импорт завершён. Импортировано: {imported}, Пропущено: {skipped}")
            
            return {
                "success": True,
                "backup_path": str(backup_path) if backup_path else None,
                "imported": imported,
                "skipped": skipped,
                "errors": errors,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Ошибка импорта: {e}")
            return {
                "success": False,
                "backup_path": None,
                "imported": {},
                "skipped": {},
                "errors": [],
                "error": str(e)
            }
    
    def restore_backup(self, backup_path: str) -> Dict[str, Any]:
        """
        Восстановить БД из бэкапа.
        
        Args:
            backup_path: Путь к файлу бэкапа
            
        Returns:
            {"success": bool, "error": str или None}
        """
        try:
            backup_file = Path(backup_path)
            
            if not backup_file.exists():
                return {
                    "success": False,
                    "error": "Файл бэкапа не найден"
                }
            
            # Восстанавливаем
            shutil.copy2(backup_file, self.db_path)
            
            logger.info(f"БД восстановлена из бэкапа: {backup_path}")
            
            return {
                "success": True,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Ошибка восстановления: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def full_restore(
        self,
        encrypted_data: bytes,
        password: str
    ) -> Dict[str, Any]:
        """
        Полное восстановление из зашифрованного файла.
        
        Используется для восстановления на чистую установку.
        Полностью заменяет БД данными из файла.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль для расшифровки
            
        Returns:
            {
                "success": bool,
                "user": dict (данные пользователя для авторизации),
                "stats": dict,
                "error": str или None
            }
        """
        try:
            # Расшифровываем
            success, decrypted_data, error = self.crypto.decrypt(encrypted_data, password)
            
            if not success:
                return {
                    "success": False,
                    "user": None,
                    "stats": {},
                    "error": error
                }
            
            # Распаковываем
            json_data = gzip.decompress(decrypted_data).decode('utf-8')
            export_data = json.loads(json_data)
            
            # Проверяем версию
            version = export_data.get("version", "unknown")
            if version not in self.SUPPORTED_VERSIONS:
                return {
                    "success": False,
                    "user": None,
                    "stats": {},
                    "error": f"Версия формата '{version}' не поддерживается"
                }
            
            # Проверяем наличие пользователя
            users_data = export_data.get("tables", {}).get("users", [])
            if not users_data:
                return {
                    "success": False,
                    "user": None,
                    "stats": {},
                    "error": "В файле нет данных пользователя"
                }
            
            # Создаём бэкап если БД существует
            backup_path = self._create_backup()
            
            # Открываем соединение с БД
            conn = sqlite3.connect(self.db_path)
            conn.execute("PRAGMA foreign_keys = OFF")
            
            stats = {}
            errors = []
            
            tables = export_data.get("tables", {})
            
            # Сначала очищаем таблицы которые будем импортировать
            for table_name in tables.keys():
                if self._table_exists(conn, table_name):
                    try:
                        conn.execute(f"DELETE FROM {table_name}")
                    except Exception as e:
                        logger.warning(f"Не удалось очистить {table_name}: {e}")
            
            # Импортируем все таблицы
            for table_name, table_data in tables.items():
                if not self._table_exists(conn, table_name):
                    errors.append(f"Таблица {table_name} не существует")
                    continue
                
                try:
                    result = self._import_table(conn, table_name, table_data, "replace")
                    stats[table_name] = result["imported"]
                except Exception as e:
                    errors.append(f"Ошибка {table_name}: {e}")
            
            conn.execute("PRAGMA foreign_keys = ON")
            conn.commit()
            conn.close()
            
            # Получаем данные первого пользователя для авторизации
            user_data = users_data[0]
            
            logger.info(f"Полное восстановление завершено. Таблиц: {len(stats)}")
            
            return {
                "success": True,
                "user": {
                    "id": user_data.get("id"),
                    "username": user_data.get("username"),
                    "hashed_password": user_data.get("hashed_password"),
                    "is_2fa_enabled": user_data.get("is_2fa_enabled", False)
                },
                "stats": stats,
                "errors": errors,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Ошибка полного восстановления: {e}")
            return {
                "success": False,
                "user": None,
                "stats": {},
                "error": str(e)
            }
    
    def get_user_from_export(
        self,
        encrypted_data: bytes,
        password: str
    ) -> Dict[str, Any]:
        """
        Получить данные пользователя из файла экспорта без импорта.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль для расшифровки
            
        Returns:
            {
                "success": bool,
                "user": dict или None,
                "error": str или None
            }
        """
        try:
            # Расшифровываем
            success, decrypted_data, error = self.crypto.decrypt(encrypted_data, password)
            
            if not success:
                return {
                    "success": False,
                    "user": None,
                    "error": error
                }
            
            # Распаковываем
            json_data = gzip.decompress(decrypted_data).decode('utf-8')
            export_data = json.loads(json_data)
            
            # Получаем пользователя
            users_data = export_data.get("tables", {}).get("users", [])
            if not users_data:
                return {
                    "success": False,
                    "user": None,
                    "error": "В файле нет данных пользователя"
                }
            
            user_data = users_data[0]
            
            return {
                "success": True,
                "user": {
                    "id": user_data.get("id"),
                    "username": user_data.get("username"),
                    "is_2fa_enabled": user_data.get("is_2fa_enabled", False)
                },
                "error": None
            }
            
        except Exception as e:
            return {
                "success": False,
                "user": None,
                "error": str(e)
            }
