"""
SafeUpdateExecutor - Безопасный исполнитель обновлений

Этот модуль отвечает за:
1. Подготовку к обновлению (бэкапы, проверки)
2. Запуск внешнего скрипта-обновлятора
3. Корректное завершение приложения для обновления
4. Откат при необходимости

Ключевая особенность: приложение не может обновить само себя.
Поэтому мы запускаем внешний процесс (auto-updater), который:
- Ждёт завершения текущего приложения
- Скачивает и устанавливает обновление
- Запускает приложение заново
"""

import os
import json
import shutil
import subprocess
import platform
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Tuple, List, Any, Callable
import logging

from .update_status import UpdateStatus
from .updater_scripts import WINDOWS_UPDATER_SCRIPT, LINUX_UPDATER_SCRIPT
from .backup_utils import (
    create_full_backup, 
    get_available_backups, 
    cleanup_old_backups,
    rollback_from_backup
)

logger = logging.getLogger(__name__)


class SafeUpdateExecutor:
    """
    Безопасный исполнитель обновлений.
    
    Гарантирует:
    - Полный бэкап данных перед обновлением
    - Возможность отката при любой ошибке
    - Корректный перезапуск приложения
    - Сохранность пользовательских данных
    """
    
    # Файлы, которые НИКОГДА не перезаписываются
    PROTECTED_FILES = [
        ".env",
        "moonbot_commander.db",
        "scheduler_enabled.txt",
    ]
    
    # Директории с пользовательскими данными
    PROTECTED_DIRS = [
        "backups",
        "logs", 
        "data",
        "migration_backups",
    ]
    
    def __init__(self):
        self.project_root = self._detect_project_root()
        self.backend_dir = self.project_root / "backend"
        self.is_windows = platform.system() == 'Windows'
        self.is_linux = platform.system() == 'Linux'
        
        # Директория для временных файлов обновления
        self.update_temp_dir = self.backend_dir / ".update_temp"
        
        # Файл статуса обновления
        self.status_file = self.backend_dir / ".update_status.json"
        
        # Файл-сигнал для auto-updater
        self.signal_file = self.project_root / ".update_signal"
        
        self._status = UpdateStatus.IDLE
        self._progress = 0
        self._message = ""
        self._callbacks: List[Callable] = []
    
    def _detect_project_root(self) -> Path:
        """Определить корневую директорию проекта"""
        current = Path(__file__).resolve()
        
        for parent in current.parents:
            if (parent / "VERSION.txt").exists():
                logger.info(f"SafeExecutor: Project root found: {parent}")
                return parent
            if (parent / "backend" / "main.py").exists():
                return parent
        
        return current.parent.parent.parent.parent
    
    def get_current_version(self) -> str:
        """Получить текущую версию"""
        version_file = self.project_root / "VERSION.txt"
        if version_file.exists():
            try:
                content = version_file.read_text(encoding='utf-8').strip()
                if content.startswith('\ufeff'):
                    content = content[1:]
                return content
            except UnicodeDecodeError:
                try:
                    content = version_file.read_text(encoding='utf-16').strip()
                    return content
                except Exception:
                    pass
            except Exception as e:
                logger.warning(f"Ошибка чтения VERSION.txt: {e}")
        return "0.0.0"
    
    @property
    def status(self) -> Dict[str, Any]:
        """Получить текущий статус обновления"""
        return {
            "status": self._status,
            "progress": self._progress,
            "message": self._message,
            "current_version": self.get_current_version(),
        }
    
    def _update_status(self, status: str, progress: int = 0, message: str = ""):
        """Обновить статус и уведомить слушателей"""
        self._status = status
        self._progress = progress
        self._message = message
        
        self._save_status_file()
        
        for callback in self._callbacks:
            try:
                callback(self.status)
            except Exception as e:
                logger.warning(f"Ошибка в callback: {e}")
    
    def _save_status_file(self):
        """Сохранить статус в файл"""
        try:
            status_data = {
                "status": self._status,
                "progress": self._progress,
                "message": self._message,
                "timestamp": datetime.now().isoformat(),
                "current_version": self.get_current_version(),
            }
            self.status_file.write_text(
                json.dumps(status_data, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
        except Exception as e:
            logger.warning(f"Не удалось сохранить статус: {e}")
    
    def add_status_callback(self, callback: Callable):
        """Добавить callback для отслеживания статуса"""
        self._callbacks.append(callback)
    
    def remove_status_callback(self, callback: Callable):
        """Удалить callback"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    async def prepare_update(
        self, 
        target_version: str,
        download_url: str
    ) -> Tuple[bool, str]:
        """
        Подготовить обновление.
        
        1. Скачивает новую версию
        2. Распаковывает во временную директорию
        3. Проверяет целостность
        4. Создаёт полный бэкап
        """
        import aiohttp
        import zipfile
        
        try:
            self._update_status(UpdateStatus.PREPARING, 0, "Подготовка к обновлению...")
            
            # Очищаем временную директорию
            if self.update_temp_dir.exists():
                shutil.rmtree(self.update_temp_dir)
            self.update_temp_dir.mkdir(parents=True)
            
            # Скачиваем
            self._update_status(UpdateStatus.DOWNLOADING, 10, "Скачивание обновления...")
            
            zip_path = self.update_temp_dir / f"update_{target_version}.zip"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(download_url, timeout=aiohttp.ClientTimeout(total=600)) as response:
                    if response.status != 200:
                        return False, f"Ошибка скачивания: HTTP {response.status}"
                    
                    total_size = int(response.headers.get('content-length', 0))
                    downloaded = 0
                    
                    with open(zip_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if total_size > 0:
                                progress = 10 + int((downloaded / total_size) * 40)
                                self._update_status(
                                    UpdateStatus.DOWNLOADING, 
                                    progress,
                                    f"Скачивание: {downloaded // 1024 // 1024} MB"
                                )
            
            # Распаковываем
            self._update_status(UpdateStatus.PREPARING, 50, "Распаковка архива...")
            
            extract_dir = self.update_temp_dir / "extracted"
            with zipfile.ZipFile(zip_path, 'r') as zf:
                zf.extractall(extract_dir)
            
            # Находим корневую папку
            subdirs = list(extract_dir.iterdir())
            if len(subdirs) == 1 and subdirs[0].is_dir():
                source_dir = subdirs[0]
            else:
                source_dir = extract_dir
            
            # Проверяем структуру
            if not (source_dir / "backend" / "main.py").exists():
                return False, "Неверная структура архива"
            
            # Создаём бэкап
            self._update_status(UpdateStatus.BACKING_UP, 60, "Создание резервной копии...")
            
            backup_success, backup_result = await create_full_backup(
                self.backend_dir,
                self.project_root,
                target_version,
                self.get_current_version
            )
            if not backup_success:
                return False, f"Ошибка бэкапа: {backup_result}"
            
            # Сохраняем информацию для auto-updater
            self._update_status(UpdateStatus.READY_TO_UPDATE, 80, "Готово к обновлению")
            
            update_info = {
                "target_version": target_version,
                "source_dir": str(source_dir),
                "backup_path": backup_result,
                "current_version": self.get_current_version(),
                "prepared_at": datetime.now().isoformat(),
                "protected_files": self.PROTECTED_FILES,
                "protected_dirs": self.PROTECTED_DIRS,
            }
            
            info_file = self.update_temp_dir / "update_info.json"
            info_file.write_text(
                json.dumps(update_info, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
            
            return True, f"Готово к обновлению на версию {target_version}"
            
        except Exception as e:
            self._update_status(UpdateStatus.FAILED, 0, str(e))
            logger.error(f"Ошибка подготовки обновления: {e}")
            return False, str(e)
    
    async def execute_update(self) -> Tuple[bool, str]:
        """
        Запустить процесс обновления.
        
        Создаёт файл-сигнал и запускает auto-updater скрипт.
        """
        try:
            info_file = self.update_temp_dir / "update_info.json"
            if not info_file.exists():
                return False, "Обновление не подготовлено. Сначала вызовите prepare_update()"
            
            update_info = json.loads(info_file.read_text(encoding='utf-8'))
            
            self._update_status(UpdateStatus.UPDATING, 90, "Запуск обновления...")
            
            # Создаём файл-сигнал для auto-updater
            signal_data = {
                "action": "update",
                "target_version": update_info["target_version"],
                "source_dir": update_info["source_dir"],
                "backup_path": update_info["backup_path"],
                "project_root": str(self.project_root),
                "backend_dir": str(self.backend_dir),
                "protected_files": update_info["protected_files"],
                "protected_dirs": update_info["protected_dirs"],
                "created_at": datetime.now().isoformat(),
                "restart_command": self._get_restart_command(),
            }
            
            self.signal_file.write_text(
                json.dumps(signal_data, ensure_ascii=False, indent=2),
                encoding='utf-8'
            )
            
            # Запускаем auto-updater
            updater_script = self._get_updater_script_path()
            
            if not updater_script.exists():
                self._create_updater_script(updater_script)
            
            # Запускаем скрипт в фоне
            if self.is_windows:
                subprocess.Popen(
                    f'start /b "" "{updater_script}"',
                    shell=True,
                    cwd=str(self.project_root),
                    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
                )
            else:
                subprocess.Popen(
                    f'nohup "{updater_script}" > /dev/null 2>&1 &',
                    shell=True,
                    cwd=str(self.project_root),
                    start_new_session=True
                )
            
            self._update_status(UpdateStatus.RESTARTING, 95, "Перезапуск приложения...")
            
            logger.info("✅ Auto-updater запущен, приложение будет перезапущено")
            
            return True, "Обновление запущено. Приложение будет перезапущено."
            
        except Exception as e:
            self._update_status(UpdateStatus.FAILED, 0, str(e))
            logger.error(f"Ошибка запуска обновления: {e}")
            return False, str(e)
    
    def _get_restart_command(self) -> str:
        """Получить команду для перезапуска приложения"""
        if self.is_windows:
            for bat_name in ["LOCAL-START.bat", "SERVER-START.bat", "start.bat"]:
                bat_path = self.project_root / bat_name
                if bat_path.exists():
                    return str(bat_path)
            return f'cd /d "{self.backend_dir}" && python main.py'
        else:
            for script_name in ["linux/local-start.sh", "linux/server-start.sh", "start.sh"]:
                script_path = self.project_root / script_name
                if script_path.exists():
                    return str(script_path)
            return f'cd "{self.backend_dir}" && python3 main.py'
    
    def _get_updater_script_path(self) -> Path:
        """Получить путь к скрипту auto-updater"""
        if self.is_windows:
            return self.project_root / "auto-updater.bat"
        else:
            return self.project_root / "auto-updater.sh"
    
    def _create_updater_script(self, script_path: Path):
        """Создать скрипт auto-updater"""
        if self.is_windows:
            script_path.write_text(WINDOWS_UPDATER_SCRIPT, encoding='utf-8')
            logger.info(f"✅ Создан Windows auto-updater: {script_path}")
        else:
            script_path.write_text(LINUX_UPDATER_SCRIPT, encoding='utf-8')
            script_path.chmod(0o755)
            logger.info(f"✅ Создан Linux auto-updater: {script_path}")
    
    async def rollback_update(self, backup_path: str) -> Tuple[bool, str]:
        """Откатить обновление из бэкапа"""
        success, message = await rollback_from_backup(
            backup_path,
            self.backend_dir,
            self.project_root
        )
        
        if success:
            self._update_status(UpdateStatus.ROLLED_BACK, 100, "Откат выполнен успешно")
        
        return success, message
    
    def get_available_backups(self) -> List[Dict]:
        """Получить список доступных бэкапов для отката"""
        return get_available_backups(self.backend_dir)
    
    def cleanup_old_backups(self, keep_count: int = 5):
        """Удалить старые бэкапы, оставив последние N"""
        cleanup_old_backups(self.backend_dir, keep_count)


# Глобальный экземпляр
safe_executor = SafeUpdateExecutor()
