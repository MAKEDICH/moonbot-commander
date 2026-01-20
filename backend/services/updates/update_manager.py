"""
UpdateManager - Центральный модуль управления обновлениями

Отвечает за:
- Проверку доступных версий на GitHub
- Сравнение версий
- Координацию процесса обновления
- Обеспечение безопасности данных пользователя
"""

import sys
import asyncio
import platform
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple, Any
from packaging import version
import logging

from .update_github_api import GitHubAPIMixin

logger = logging.getLogger(__name__)


class UpdateManager(GitHubAPIMixin):
    """
    Центральный менеджер обновлений.
    
    Обеспечивает безопасное обновление приложения с любой версии
    на актуальную с сохранением всех данных пользователя.
    """
    
    # Критические файлы, которые НИКОГДА не перезаписываются
    PROTECTED_FILES = [
        ".env",
        "moonbot_commander.db",
        "scheduler_enabled.txt",
    ]
    
    # Директории с пользовательскими данными
    PROTECTED_DIRS = [
        "backups",
        "logs",
        "data/charts",
    ]
    
    def __init__(self):
        self.project_root = self._detect_project_root()
        self.backend_dir = self.project_root / "backend"
        self.frontend_dir = self.project_root / "frontend"
        self.current_version = self._get_current_version()
        self.is_windows = platform.system() == 'Windows'
        self.is_linux = platform.system() == 'Linux'
        
    def _detect_project_root(self) -> Path:
        """Определить корневую директорию проекта"""
        current = Path(__file__).resolve()
        
        # Поднимаемся вверх пока не найдем VERSION.txt
        for parent in current.parents:
            if (parent / "VERSION.txt").exists():
                logger.info(f"Project root found via VERSION.txt: {parent}")
                return parent
            if (parent / "backend" / "main.py").exists():
                logger.info(f"Project root found via main.py: {parent}")
                return parent
        
        # Fallback - 3 уровня вверх от текущего файла
        fallback = current.parent.parent.parent
        logger.warning(f"Project root fallback: {fallback}")
        return fallback
    
    def _get_current_version(self) -> str:
        """Получить текущую версию из VERSION.txt"""
        version_file = self.project_root / "VERSION.txt"
        
        if version_file.exists():
            try:
                # Пробуем UTF-8
                content = version_file.read_text(encoding='utf-8').strip()
                # Убираем BOM если есть
                if content.startswith('\ufeff'):
                    content = content[1:]
                logger.info(f"Текущая версия из VERSION.txt: {content}")
                return content
            except UnicodeDecodeError:
                try:
                    # Пробуем UTF-16
                    content = version_file.read_text(encoding='utf-16').strip()
                    logger.info(f"Текущая версия из VERSION.txt (UTF-16): {content}")
                    return content
                except Exception as e:
                    logger.warning(f"Не удалось прочитать VERSION.txt как UTF-16: {e}")
            except Exception as e:
                logger.warning(f"Не удалось прочитать VERSION.txt: {e}")
        else:
            logger.warning(f"VERSION.txt не найден: {version_file}")
        
        return "0.0.0"
    
    async def check_for_updates(self, force: bool = False) -> Dict[str, Any]:
        """
        Проверить наличие обновлений на GitHub.
        
        Args:
            force: Игнорировать кэш
            
        Returns:
            Словарь с информацией об обновлении
        """
        # Обновляем текущую версию при каждой проверке
        self.current_version = self._get_current_version()
        
        try:
            releases = await self._fetch_releases()
            
            if not releases:
                return {
                    "update_available": False,
                    "current_version": self.current_version,
                    "error": "Не удалось получить список релизов"
                }
            
            # Находим последний стабильный релиз
            latest_release = None
            for release in releases:
                if not release.get('prerelease', False) and not release.get('draft', False):
                    latest_release = release
                    break
            
            if not latest_release:
                return {
                    "update_available": False,
                    "current_version": self.current_version,
                    "message": "Нет доступных стабильных релизов"
                }
            
            latest_version = latest_release['tag_name'].lstrip('v')
            
            # Сравниваем версии
            try:
                current = version.parse(self.current_version)
                latest = version.parse(latest_version)
                update_available = latest > current
            except Exception:
                update_available = self.current_version != latest_version
            
            # Собираем информацию о всех промежуточных версиях
            intermediate_versions = []
            if update_available:
                intermediate_versions = await self._get_intermediate_versions(
                    self.current_version, 
                    latest_version, 
                    releases
                )
            
            return {
                "update_available": update_available,
                "current_version": self.current_version,
                "latest_version": latest_version,
                "release_name": latest_release.get('name', f'v{latest_version}'),
                "release_notes": latest_release.get('body', ''),
                "published_at": latest_release.get('published_at'),
                "download_url": latest_release.get('zipball_url'),
                "html_url": latest_release.get('html_url'),
                "intermediate_versions": intermediate_versions,
                "versions_behind": len(intermediate_versions),
                "has_breaking_changes": self._check_breaking_changes(intermediate_versions),
                "requires_migration": self._check_requires_migration(intermediate_versions),
            }
            
        except asyncio.TimeoutError:
            logger.error("Таймаут при проверке обновлений")
            return {
                "update_available": False,
                "current_version": self.current_version,
                "error": "Таймаут соединения с GitHub"
            }
        except Exception as e:
            logger.error(f"Ошибка при проверке обновлений: {e}")
            return {
                "update_available": False,
                "current_version": self.current_version,
                "error": str(e)
            }
    
    async def get_available_versions(self) -> List[Dict]:
        """Получить список всех доступных версий для выбора"""
        releases = await self._fetch_releases()
        
        versions = []
        for release in releases:
            if release.get('draft', False):
                continue
                
            tag = release['tag_name'].lstrip('v')
            is_current = tag == self.current_version
            
            try:
                is_newer = version.parse(tag) > version.parse(self.current_version)
            except Exception:
                is_newer = False
            
            versions.append({
                "version": tag,
                "name": release.get('name', f'v{tag}'),
                "published_at": release.get('published_at'),
                "prerelease": release.get('prerelease', False),
                "is_current": is_current,
                "is_newer": is_newer,
                "download_url": release.get('zipball_url'),
            })
        
        return versions
    
    def extract_release(self, zip_path: str) -> Tuple[bool, str]:
        """
        Распаковать скачанный релиз.
        
        Args:
            zip_path: Путь к ZIP архиву
            
        Returns:
            (success, extracted_path_or_error)
        """
        try:
            zip_file = Path(zip_path)
            extract_dir = zip_file.parent / "extracted"
            
            with zipfile.ZipFile(zip_file, 'r') as zf:
                zf.extractall(extract_dir)
            
            # GitHub создает папку с именем owner-repo-hash
            subdirs = list(extract_dir.iterdir())
            if len(subdirs) == 1 and subdirs[0].is_dir():
                actual_dir = subdirs[0]
            else:
                actual_dir = extract_dir
            
            # Проверяем структуру
            if not (actual_dir / "backend" / "main.py").exists():
                return False, "Неверная структура архива: не найден backend/main.py"
            
            logger.info(f"Релиз распакован: {actual_dir}")
            return True, str(actual_dir)
            
        except Exception as e:
            logger.error(f"Ошибка распаковки: {e}")
            return False, str(e)
    
    def get_update_plan(self, source_dir: str) -> Dict[str, Any]:
        """
        Создать план обновления.
        
        Анализирует изменения между текущей версией и новой,
        определяет какие файлы будут обновлены, добавлены, удалены.
        
        Args:
            source_dir: Директория с новой версией
            
        Returns:
            План обновления
        """
        source = Path(source_dir)
        
        plan = {
            "backend_files": [],
            "frontend_files": [],
            "config_files": [],
            "new_migrations": [],
            "protected_files": [],
            "will_backup": [],
        }
        
        # Анализируем backend
        new_backend = source / "backend"
        if new_backend.exists():
            for file_path in new_backend.rglob("*"):
                if file_path.is_file():
                    rel_path = file_path.relative_to(new_backend)
                    
                    # Проверяем защищенные файлы
                    if str(rel_path) in self.PROTECTED_FILES:
                        plan["protected_files"].append(str(rel_path))
                        continue
                    
                    # Проверяем защищенные директории
                    is_protected = False
                    for protected_dir in self.PROTECTED_DIRS:
                        if str(rel_path).startswith(protected_dir):
                            is_protected = True
                            plan["protected_files"].append(str(rel_path))
                            break
                    
                    if not is_protected:
                        current_file = self.backend_dir / rel_path
                        action = "add" if not current_file.exists() else "update"
                        plan["backend_files"].append({
                            "path": str(rel_path),
                            "action": action,
                        })
                        
                        if current_file.exists():
                            plan["will_backup"].append(f"backend/{rel_path}")
        
        # Анализируем frontend
        new_frontend = source / "frontend"
        if new_frontend.exists():
            for file_path in new_frontend.rglob("*"):
                if file_path.is_file():
                    rel_path = file_path.relative_to(new_frontend)
                    
                    # Пропускаем node_modules
                    if "node_modules" in str(rel_path):
                        continue
                    
                    current_file = self.frontend_dir / rel_path
                    action = "add" if not current_file.exists() else "update"
                    
                    plan["frontend_files"].append({
                        "path": str(rel_path),
                        "action": action,
                    })
        
        # Находим новые миграции
        new_updates = source / "backend" / "updates"
        if new_updates.exists():
            for file_path in new_updates.glob("migrate_*.py"):
                current_migration = self.backend_dir / "updates" / file_path.name
                if not current_migration.exists():
                    plan["new_migrations"].append(file_path.name)
        
        return plan
    
    def get_system_info(self) -> Dict[str, Any]:
        """Получить информацию о системе для диагностики"""
        return {
            "os": platform.system(),
            "os_version": platform.version(),
            "python_version": sys.version,
            "current_version": self.current_version,
            "project_root": str(self.project_root),
            "backend_dir": str(self.backend_dir),
            "frontend_dir": str(self.frontend_dir),
            "is_windows": self.is_windows,
            "is_linux": self.is_linux,
        }


# Глобальный экземпляр
update_manager = UpdateManager()
