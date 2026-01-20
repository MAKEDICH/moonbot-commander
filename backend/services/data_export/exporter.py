"""
Модуль экспорта данных пользователя.

Экспортирует ВСЕ данные:
- Пользователи (логин, пароль, 2FA)
- Серверы и их настройки
- Запланированные команды
- Настройки пользователя
- История ордеров
- Графики
- Логи
- Все остальные таблицы
"""

import json
import gzip
import logging
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any

from .crypto import DataCrypto

logger = logging.getLogger(__name__)


class DataExporter:
    """
    Экспортёр данных пользователя.
    
    Создаёт зашифрованный файл со ВСЕМИ данными пользователя,
    который можно импортировать в другой экземпляр MoonBot Commander.
    Включает логин/пароль для полного восстановления аккаунта.
    """
    
    # Версия формата экспорта
    EXPORT_VERSION = "1.1"
    
    def __init__(self, db_path: Optional[Path] = None):
        """
        Инициализация экспортёра.
        
        Args:
            db_path: Путь к БД (если не указан, определяется автоматически)
        """
        if db_path is None:
            db_path = self._find_db_path()
        self.db_path = db_path
        self.crypto = DataCrypto()
    
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
    
    def _get_table_data(self, conn: sqlite3.Connection, table_name: str) -> List[Dict]:
        """Получить все данные из таблицы как список словарей"""
        try:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM {table_name}")
            
            columns = [description[0] for description in cursor.description]
            rows = cursor.fetchall()
            
            return [dict(zip(columns, row)) for row in rows]
        except sqlite3.Error as e:
            logger.warning(f"Не удалось прочитать таблицу {table_name}: {e}")
            return []
    
    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        """Проверить существование таблицы"""
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,)
        )
        return cursor.fetchone() is not None
    
    def _get_all_tables(self, conn: sqlite3.Connection) -> List[str]:
        """Получить список всех таблиц в БД"""
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        return [row[0] for row in cursor.fetchall()]
    
    def export_data(
        self,
        password: str,
        include_orders: bool = True,
        include_charts: bool = True,
        include_logs: bool = True,
        full_export: bool = True,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Экспортировать ВСЕ данные пользователя.
        
        Args:
            password: Пароль для шифрования
            include_orders: Включить историю ордеров
            include_charts: Включить графики
            include_logs: Включить логи команд
            full_export: Экспортировать ВСЕ таблицы (по умолчанию True)
            user_id: ID пользователя (если None - все данные)
            
        Returns:
            {
                "success": bool,
                "data": bytes (зашифрованные данные) или None,
                "filename": str,
                "stats": dict,
                "error": str или None
            }
        """
        try:
            if not self.db_path.exists():
                return {
                    "success": False,
                    "data": None,
                    "filename": None,
                    "stats": {},
                    "error": "База данных не найдена"
                }
            
            conn = sqlite3.connect(self.db_path)
            
            # Собираем данные
            export_data = {
                "version": self.EXPORT_VERSION,
                "created_at": datetime.now().isoformat(),
                "app_version": self._get_app_version(),
                "full_export": full_export,
                "tables": {}
            }
            
            stats = {}
            
            if full_export:
                # Экспортируем ВСЕ таблицы из БД
                all_tables = self._get_all_tables(conn)
                
                for table in all_tables:
                    data = self._get_table_data(conn, table)
                    if data:
                        export_data["tables"][table] = data
                        stats[table] = len(data)
            else:
                # Основные таблицы (всегда экспортируются)
                core_tables = [
                    "servers",
                    "users", 
                    "user_settings",
                    "scheduled_commands",
                    "scheduled_command_servers",
                    "server_balance",
                    "strategy_cache",
                    "recovery_codes",
                    "scheduler_settings",
                    "cleanup_settings",
                ]
                
                for table in core_tables:
                    if self._table_exists(conn, table):
                        data = self._get_table_data(conn, table)
                        
                        # Фильтруем по user_id если указан
                        if user_id and table in ["scheduled_commands", "user_settings"]:
                            data = [row for row in data if row.get("user_id") == user_id]
                        
                        if data:
                            export_data["tables"][table] = data
                            stats[table] = len(data)
                
                # Опциональные таблицы
                if include_orders and self._table_exists(conn, "moonbot_orders"):
                    orders = self._get_table_data(conn, "moonbot_orders")
                    if orders:
                        export_data["tables"]["moonbot_orders"] = orders
                        stats["moonbot_orders"] = len(orders)
                
                if include_charts and self._table_exists(conn, "moonbot_charts"):
                    charts = self._get_table_data(conn, "moonbot_charts")
                    if charts:
                        export_data["tables"]["moonbot_charts"] = charts
                        stats["moonbot_charts"] = len(charts)
                
                if include_logs and self._table_exists(conn, "sql_command_log"):
                    logs = self._get_table_data(conn, "sql_command_log")
                    if logs:
                        export_data["tables"]["sql_command_log"] = logs
                        stats["sql_command_log"] = len(logs)
            
            conn.close()
            
            # Сериализуем в JSON
            json_data = json.dumps(export_data, ensure_ascii=False, default=str)
            
            # Сжимаем
            compressed_data = gzip.compress(json_data.encode('utf-8'))
            
            # Шифруем
            encrypted_data = self.crypto.encrypt(compressed_data, password)
            
            # Генерируем имя файла
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            password_hash = DataCrypto.generate_password_hash(password)
            filename = f"moonbot_export_{timestamp}_{password_hash}.mbc"
            
            logger.info(f"Экспорт завершён: {len(encrypted_data)} байт, таблиц: {len(stats)}")
            
            return {
                "success": True,
                "data": encrypted_data,
                "filename": filename,
                "stats": stats,
                "error": None
            }
            
        except Exception as e:
            logger.error(f"Ошибка экспорта: {e}")
            return {
                "success": False,
                "data": None,
                "filename": None,
                "stats": {},
                "error": str(e)
            }
    
    def _get_app_version(self) -> str:
        """Получить версию приложения"""
        try:
            version_file = self.db_path.parent.parent / "VERSION.txt"
            if version_file.exists():
                return version_file.read_text(encoding='utf-8').strip()
        except Exception:
            pass
        return "unknown"
    
    def get_export_preview(self, user_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Получить превью данных для экспорта (без экспорта).
        
        Returns:
            Статистика по данным которые будут экспортированы
        """
        try:
            if not self.db_path.exists():
                return {"error": "База данных не найдена"}
            
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            preview = {
                "tables": {},
                "total_records": 0
            }
            
            tables_to_check = [
                "servers", "users", "user_settings", 
                "scheduled_commands", "moonbot_orders",
                "moonbot_charts", "sql_command_log"
            ]
            
            for table in tables_to_check:
                if self._table_exists(conn, table):
                    cursor.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cursor.fetchone()[0]
                    preview["tables"][table] = count
                    preview["total_records"] += count
            
            conn.close()
            
            return preview
            
        except Exception as e:
            return {"error": str(e)}

