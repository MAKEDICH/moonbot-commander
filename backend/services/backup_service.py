"""
Сервис для создания и восстановления бэкапов базы данных
"""
import os
import shutil
import gzip
from datetime import timedelta
from pathlib import Path
from typing import Optional, List
import logging
from sqlalchemy.orm import Session
from utils.config_loader import get_config_value
from utils.datetime_utils import utcnow

logger = logging.getLogger(__name__)


class BackupService:
    """Сервис для управления бэкапами"""

    def __init__(self, backup_dir: Optional[str] = None):
        # Определяем директорию backend относительно текущего файла
        backend_dir = Path(__file__).parent.parent

        if backup_dir:
            backup_path = Path(backup_dir)
            if not backup_path.is_absolute():
                backup_path = backend_dir / backup_path
        else:
            # Загружаем из конфигурации
            backup_dir_env = get_config_value('app', 'backup.directory_env', default='BACKUP_DIR')
            default_backup_dir = get_config_value('app', 'backup.directory', default='./backups')
            backup_path_str = os.getenv(backup_dir_env, default_backup_dir)
            
            if os.path.isabs(backup_path_str):
                backup_path = Path(backup_path_str)
            else:
                backup_path = backend_dir / backup_path_str

        self.backup_dir = backup_path
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def create_backup(
        self,
        db_path: str,
        backup_type: str = "manual",
        version: Optional[str] = None
    ) -> tuple[bool, str, Optional[str]]:
        """
        Создать бэкап базы данных

        Args:
            db_path: Путь к файлу базы данных
            backup_type: Тип бэкапа (manual, automatic, pre-upgrade)
            version: Версия приложения

        Returns:
            (success, backup_path, error_message)
        """
        try:
            if not os.path.exists(db_path):
                return False, "", f"Database file not found: {db_path}"

            # Формируем имя бэкапа
            timestamp = utcnow().strftime("%Y%m%d_%H%M%S")
            db_name = Path(db_path).stem
            backup_filename = f"{db_name}_backup_{backup_type}_{timestamp}.db.gz"
            backup_path = self.backup_dir / backup_filename

            # Создаем сжатый бэкап
            with open(db_path, 'rb') as f_in:
                with gzip.open(backup_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            backup_size = backup_path.stat().st_size

            logger.info(
                f"Backup created: {backup_filename} "
                f"(type={backup_type}, size={backup_size} bytes)"
            )

            return True, str(backup_path), None

        except Exception as e:
            error_msg = f"Failed to create backup: {str(e)}"
            logger.error(error_msg)
            return False, "", error_msg

    def restore_backup(self, backup_path: str, target_path: str) -> tuple[bool, Optional[str]]:
        """
        Восстановить базу данных из бэкапа

        Args:
            backup_path: Путь к файлу бэкапа
            target_path: Путь куда восстанавливать

        Returns:
            (success, error_message)
        """
        try:
            if not os.path.exists(backup_path):
                return False, f"Backup file not found: {backup_path}"

            # Создаем бэкап текущей БД перед восстановлением
            if os.path.exists(target_path):
                current_backup_path = f"{target_path}.before_restore.{utcnow().strftime('%Y%m%d_%H%M%S')}"
                shutil.copy2(target_path, current_backup_path)
                logger.info(
                    f"Current database backed up to: {current_backup_path}")

            # Восстанавливаем из бэкапа
            with gzip.open(backup_path, 'rb') as f_in:
                with open(target_path, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)

            logger.info(f"Database restored from: {backup_path}")
            return True, None

        except Exception as e:
            error_msg = f"Failed to restore backup: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    def cleanup_old_backups(self, retention_days: Optional[int] = None) -> int:
        """
        Удалить старые бэкапы

        Args:
            retention_days: Сколько дней хранить бэкапы

        Returns:
            Количество удаленных файлов
        """
        if retention_days is None:
            # Загружаем из конфигурации
            retention_days_env = get_config_value('app', 'backup.retention_days_env', default='BACKUP_RETENTION_DAYS')
            default_retention = get_config_value('app', 'backup.retention_days', default=30)
            retention_days = int(os.getenv(retention_days_env, str(default_retention)))
        
        cutoff_date = utcnow() - timedelta(days=retention_days)

        deleted_count = 0

        for backup_file in self.backup_dir.glob("*.db.gz"):
            try:
                file_time = datetime.fromtimestamp(backup_file.stat().st_mtime)

                if file_time < cutoff_date:
                    backup_file.unlink()
                    deleted_count += 1
                    logger.info(f"Deleted old backup: {backup_file.name}")

            except Exception as e:
                logger.error(f"Error deleting backup {backup_file.name}: {e}")

        return deleted_count

    def list_backups(self) -> List[dict]:
        """
        Получить список всех бэкапов

        Returns:
            Список словарей с информацией о бэкапах
        """
        backups = []

        for backup_file in sorted(
            self.backup_dir.glob("*.db.gz"),
            key=lambda x: x.stat().st_mtime,
            reverse=True
        ):
            try:
                stat = backup_file.stat()
                backups.append({
                    "filename": backup_file.name,
                    "path": str(backup_file),
                    "size": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_mtime),
                    "type": self._extract_backup_type(backup_file.name)
                })
            except Exception as e:
                logger.error(f"Error reading backup {backup_file.name}: {e}")

        return backups

    def _extract_backup_type(self, filename: str) -> str:
        """Извлечь тип бэкапа из имени файла"""
        if "_manual_" in filename:
            return "manual"
        elif "_automatic_" in filename:
            return "automatic"
        elif "_pre-upgrade_" in filename:
            return "pre-upgrade"
        else:
            return "unknown"

    def get_backup_info(self, backup_path: str) -> Optional[dict]:
        """
        Получить информацию о конкретном бэкапе

        Args:
            backup_path: Путь к файлу бэкапа

        Returns:
            Словарь с информацией или None
        """
        try:
            path = Path(backup_path)
            if not path.exists():
                return None

            stat = path.stat()
            return {
                "filename": path.name,
                "path": str(path),
                "size": stat.st_size,
                "created_at": datetime.fromtimestamp(stat.st_mtime),
                "type": self._extract_backup_type(path.name)
            }
        except Exception as e:
            logger.error(f"Error getting backup info: {e}")
            return None


def create_pre_upgrade_backup(db_path: str, version: str) -> tuple[bool, Optional[str]]:
    """
    Создать бэкап перед обновлением

    Args:
        db_path: Путь к базе данных
        version: Версия на которую обновляемся

    Returns:
        (success, backup_path or error_message)
    """
    service = BackupService()
    success, backup_path, error = service.create_backup(
        db_path=db_path,
        backup_type="pre-upgrade",
        version=version
    )

    if success:
        return True, backup_path
    else:
        return False, error

