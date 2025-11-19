"""
Автоматический чекер обновлений для Moonbot Commander
Проверяет наличие новых версий на GitHub и уведомляет пользователя
"""
import os
import json
import asyncio
import aiohttp
from typing import Optional, Dict, List
from datetime import datetime, timedelta
from pathlib import Path
import logging
from packaging import version
import platform

logger = logging.getLogger(__name__)

# Определяем ОС
IS_WINDOWS = platform.system() == 'Windows'
IS_LINUX = platform.system() == 'Linux'

class UpdateChecker:
    """Автоматическая проверка обновлений"""
    
    GITHUB_API_URL = "https://api.github.com/repos/MAKEDICH/moonbot-commander/releases"
    CHECK_INTERVAL = 3600 * 6  # Проверять каждые 6 часов
    CACHE_FILE = "update_check_cache.json"
    
    def __init__(self):
        self.current_version = self._get_current_version()
        self.last_check = None
        self.cache_file = Path("update_check_cache.json")
        self.update_available = False
        self.latest_version_info = None
        
    def _get_current_version(self) -> str:
        """Получить текущую версию из файла"""
        try:
            version_file = Path("../VERSION.txt")
            if not version_file.exists():
                version_file = Path("VERSION.txt")
            
            if version_file.exists():
                version = version_file.read_text().strip()
                return version.replace('v', '')
            return "0.0.0"
        except Exception as e:
            logger.warning(f"Не удалось прочитать версию: {e}")
            return "0.0.0"
    
    def _load_cache(self) -> Optional[Dict]:
        """Загрузить кэш последней проверки"""
        try:
            if self.cache_file.exists():
                return json.loads(self.cache_file.read_text())
        except:
            pass
        return None
    
    def _save_cache(self, data: Dict):
        """Сохранить результат проверки в кэш"""
        try:
            self.cache_file.write_text(json.dumps(data, indent=2))
        except Exception as e:
            logger.warning(f"Не удалось сохранить кэш: {e}")
    
    async def check_for_updates(self, force: bool = False) -> Optional[Dict]:
        """
        Проверить наличие обновлений
        
        Args:
            force: Принудительная проверка, игнорируя кэш
            
        Returns:
            Информация об обновлении или None
        """
        try:
            # Проверяем кэш если не принудительно
            if not force:
                cache = self._load_cache()
                if cache:
                    last_check = datetime.fromisoformat(cache.get('last_check', '2000-01-01'))
                    if datetime.now() - last_check < timedelta(seconds=self.CHECK_INTERVAL):
                        # Используем кэш
                        self.update_available = cache.get('update_available', False)
                        self.latest_version_info = cache.get('latest_version_info')
                        return self.latest_version_info if self.update_available else None
            
            # Делаем запрос к GitHub API
            async with aiohttp.ClientSession() as session:
                async with session.get(self.GITHUB_API_URL, timeout=10) as response:
                    if response.status != 200:
                        logger.warning(f"GitHub API вернул статус {response.status}")
                        return None
                    
                    releases = await response.json()
                    
            if not releases:
                return None
            
            # Находим последний стабильный релиз
            latest_release = None
            for release in releases:
                if not release.get('prerelease', False):
                    latest_release = release
                    break
            
            if not latest_release:
                return None
            
            # Сравниваем версии
            latest_version = latest_release['tag_name'].replace('v', '')
            current = version.parse(self.current_version)
            latest = version.parse(latest_version)
            
            self.update_available = latest > current
            
            if self.update_available:
                self.latest_version_info = {
                    'version': latest_version,
                    'name': latest_release.get('name', f'Version {latest_version}'),
                    'body': latest_release.get('body', ''),
                    'published_at': latest_release.get('published_at'),
                    'html_url': latest_release.get('html_url'),
                    'download_url': latest_release.get('zipball_url'),
                }
            
            # Сохраняем в кэш
            self._save_cache({
                'last_check': datetime.now().isoformat(),
                'update_available': self.update_available,
                'latest_version_info': self.latest_version_info,
                'current_version': self.current_version
            })
            
            return self.latest_version_info if self.update_available else None
            
        except asyncio.TimeoutError:
            logger.warning("Таймаут при проверке обновлений")
            return None
        except Exception as e:
            logger.warning(f"Ошибка при проверке обновлений: {e}")
            return None
    
    def get_update_notification(self) -> Optional[Dict]:
        """
        Получить уведомление об обновлении для отправки в UI
        
        Returns:
            Словарь с информацией для уведомления
        """
        if not self.update_available or not self.latest_version_info:
            return None
        
        return {
            'type': 'update_available',
            'current_version': self.current_version,
            'new_version': self.latest_version_info['version'],
            'release_name': self.latest_version_info['name'],
            'release_notes': self._format_release_notes(
                self.latest_version_info.get('body', '')
            ),
            'download_url': self.latest_version_info['html_url'],
            'update_command': 'UPDATE-SAFE.bat' if IS_WINDOWS else './update-safe.sh',
            'severity': 'info'  # или 'critical' для критических обновлений
        }
    
    def _format_release_notes(self, body: str) -> str:
        """Форматировать release notes для отображения"""
        if not body:
            return "Обновление доступно"
        
        # Берем первые несколько строк
        lines = body.split('\n')
        summary = []
        
        for line in lines[:10]:  # Максимум 10 строк
            line = line.strip()
            if line and not line.startswith('#'):
                # Убираем маркеры markdown
                line = line.replace('**', '').replace('*', '').replace('`', '')
                summary.append(line)
            
            if len(summary) >= 3:  # Максимум 3 пункта
                break
        
        if not summary:
            return "Доступно новое обновление с улучшениями и исправлениями"
        
        return '\n'.join(summary)
    
    async def start_background_checker(self):
        """Запустить фоновую проверку обновлений"""
        while True:
            try:
                await self.check_for_updates()
                
                if self.update_available:
                    logger.info(
                        f"Доступно обновление: {self.current_version} → "
                        f"{self.latest_version_info['version']}"
                    )
                
            except Exception as e:
                logger.error(f"Ошибка в фоновой проверке обновлений: {e}")
            
            # Ждем до следующей проверки
            await asyncio.sleep(self.CHECK_INTERVAL)


# Глобальный экземпляр чекера
update_checker = UpdateChecker()


async def check_update_on_startup():
    """Проверить обновления при запуске приложения"""
    try:
        update_info = await update_checker.check_for_updates()
        if update_info:
            logger.info(f"🆕 Доступна новая версия: {update_info['version']}")
            return update_checker.get_update_notification()
    except Exception as e:
        logger.error(f"Ошибка проверки обновлений при запуске: {e}")
    
    return None
