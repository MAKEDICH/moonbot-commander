"""
Утилиты для создания и управления бэкапами
"""

import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)


async def create_full_backup(
    backend_dir: Path,
    project_root: Path,
    target_version: str,
    get_current_version_func
) -> Tuple[bool, str]:
    """
    Создать полный бэкап перед обновлением
    
    Args:
        backend_dir: Путь к директории backend
        project_root: Корневая директория проекта
        target_version: Целевая версия
        get_current_version_func: Функция для получения текущей версии
        
    Returns:
        (success, backup_path_or_error)
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        current_version = get_current_version_func()
        
        backup_dir = backend_dir / "backups" / f"pre_update_{current_version}_to_{target_version}_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Бэкап БД
        db_path = backend_dir / "moonbot_commander.db"
        if db_path.exists():
            shutil.copy2(db_path, backup_dir / "moonbot_commander.db")
            logger.info("✅ БД сохранена")
        
        # Бэкап .env
        env_path = backend_dir / ".env"
        if env_path.exists():
            shutil.copy2(env_path, backup_dir / ".env")
            logger.info("✅ .env сохранён")
        
        # Бэкап VERSION.txt
        version_path = project_root / "VERSION.txt"
        if version_path.exists():
            shutil.copy2(version_path, backup_dir / "VERSION.txt")
        
        # Сохраняем информацию о бэкапе
        backup_info = {
            "created_at": datetime.now().isoformat(),
            "current_version": current_version,
            "target_version": target_version,
            "files": list(str(f.name) for f in backup_dir.iterdir()),
        }
        
        (backup_dir / "backup_info.json").write_text(
            json.dumps(backup_info, ensure_ascii=False, indent=2),
            encoding='utf-8'
        )
        
        logger.info(f"✅ Полный бэкап создан: {backup_dir}")
        return True, str(backup_dir)
        
    except Exception as e:
        logger.error(f"Ошибка создания бэкапа: {e}")
        return False, str(e)


def get_available_backups(backend_dir: Path) -> List[Dict]:
    """
    Получить список доступных бэкапов для отката
    
    Args:
        backend_dir: Путь к директории backend
        
    Returns:
        Список бэкапов
    """
    backups = []
    backup_base = backend_dir / "backups"
    
    if not backup_base.exists():
        return backups
    
    for backup_dir in backup_base.iterdir():
        if backup_dir.is_dir() and backup_dir.name.startswith("pre_update_"):
            info_file = backup_dir / "backup_info.json"
            
            if info_file.exists():
                try:
                    info = json.loads(info_file.read_text(encoding='utf-8'))
                    backups.append({
                        "path": str(backup_dir),
                        "name": backup_dir.name,
                        "created_at": info.get("created_at"),
                        "from_version": info.get("current_version"),
                        "to_version": info.get("target_version"),
                    })
                except Exception:
                    pass
    
    # Сортируем по дате (новые первые)
    backups.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
    return backups


def cleanup_old_backups(backend_dir: Path, keep_count: int = 5):
    """
    Удалить старые бэкапы, оставив последние N
    
    Args:
        backend_dir: Путь к директории backend
        keep_count: Количество бэкапов для сохранения
    """
    backups = get_available_backups(backend_dir)
    
    if len(backups) <= keep_count:
        return
    
    for backup in backups[keep_count:]:
        try:
            shutil.rmtree(backup["path"])
            logger.info(f"Удалён старый бэкап: {backup['name']}")
        except Exception as e:
            logger.warning(f"Не удалось удалить бэкап {backup['name']}: {e}")


async def rollback_from_backup(
    backup_path: str,
    backend_dir: Path,
    project_root: Path
) -> Tuple[bool, str]:
    """
    Откатить обновление из бэкапа
    
    Args:
        backup_path: Путь к директории бэкапа
        backend_dir: Путь к директории backend
        project_root: Корневая директория проекта
        
    Returns:
        (success, message)
    """
    try:
        backup_dir = Path(backup_path)
        
        if not backup_dir.exists():
            return False, f"Бэкап не найден: {backup_path}"
        
        # Восстанавливаем БД
        db_backup = backup_dir / "moonbot_commander.db"
        if db_backup.exists():
            db_target = backend_dir / "moonbot_commander.db"
            shutil.copy2(db_backup, db_target)
            logger.info("✅ БД восстановлена")
        
        # Восстанавливаем .env
        env_backup = backup_dir / ".env"
        if env_backup.exists():
            env_target = backend_dir / ".env"
            shutil.copy2(env_backup, env_target)
            logger.info("✅ .env восстановлен")
        
        # Восстанавливаем VERSION.txt
        version_backup = backup_dir / "VERSION.txt"
        if version_backup.exists():
            version_target = project_root / "VERSION.txt"
            shutil.copy2(version_backup, version_target)
            logger.info("✅ VERSION.txt восстановлен")
        
        return True, "Откат выполнен успешно. Перезапустите приложение."
        
    except Exception as e:
        logger.error(f"Ошибка отката: {e}")
        return False, str(e)

