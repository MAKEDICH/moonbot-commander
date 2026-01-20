"""
Функции для работы с GitHub API.

Содержит методы для:
- Получения списка релизов
- Скачивания релизов
- Получения информации о версиях
"""

import asyncio
import aiohttp
import tempfile
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Callable
from packaging import version as pkg_version

logger = logging.getLogger(__name__)


class GitHubAPIMixin:
    """
    Mixin с методами для работы с GitHub API.
    
    Используется классом UpdateManager.
    """
    
    # Конфигурация GitHub (должна быть определена в классе)
    GITHUB_OWNER = "MAKEDICH"
    GITHUB_REPO = "moonbot-commander"
    GITHUB_API_BASE = "https://api.github.com"
    
    async def _fetch_releases(self, per_page: int = 100) -> List[Dict]:
        """Получить список всех релизов с GitHub"""
        url = f"{self.GITHUB_API_BASE}/repos/{self.GITHUB_OWNER}/{self.GITHUB_REPO}/releases"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params={"per_page": per_page},
                    timeout=aiohttp.ClientTimeout(total=30),
                    headers={"Accept": "application/vnd.github.v3+json"}
                ) as response:
                    if response.status != 200:
                        text = await response.text()
                        logger.warning(f"GitHub API вернул статус {response.status}: {text[:200]}")
                        return []
                    data = await response.json()
                    logger.info(f"Получено {len(data)} релизов с GitHub")
                    return data
        except aiohttp.ClientError as e:
            logger.error(f"Ошибка подключения к GitHub API: {e}")
            return []
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении релизов: {e}")
            return []
    
    async def _get_intermediate_versions(
        self, 
        current: str, 
        latest: str, 
        releases: List[Dict]
    ) -> List[Dict]:
        """Получить список всех версий между текущей и последней"""
        intermediate = []
        
        try:
            current_ver = pkg_version.parse(current)
            latest_ver = pkg_version.parse(latest)
            
            for release in releases:
                tag = release['tag_name'].lstrip('v')
                try:
                    release_ver = pkg_version.parse(tag)
                    if current_ver < release_ver <= latest_ver:
                        intermediate.append({
                            "version": tag,
                            "name": release.get('name', f'v{tag}'),
                            "published_at": release.get('published_at'),
                            "body": release.get('body', ''),
                            "has_migrations": self._release_has_migrations(release),
                        })
                except Exception:
                    continue
                    
        except Exception as e:
            logger.warning(f"Ошибка при получении промежуточных версий: {e}")
        
        # Сортируем от старых к новым
        intermediate.sort(key=lambda x: pkg_version.parse(x['version']))
        return intermediate
    
    def _release_has_migrations(self, release: Dict) -> bool:
        """Проверить, содержит ли релиз миграции БД"""
        body = release.get('body', '').lower()
        indicators = [
            'migration', 'миграци', 'database', 'базу данных',
            'schema', 'схем', 'alter table', 'add column'
        ]
        return any(ind in body for ind in indicators)
    
    def _check_breaking_changes(self, versions: List[Dict]) -> bool:
        """Проверить наличие критических изменений в версиях"""
        for v in versions:
            body = v.get('body', '').lower()
            if 'breaking' in body or 'критическ' in body:
                return True
        return False
    
    def _check_requires_migration(self, versions: List[Dict]) -> bool:
        """Проверить, требуется ли миграция БД"""
        return any(v.get('has_migrations', False) for v in versions)
    
    async def download_release(
        self, 
        version_tag: str,
        progress_callback: Optional[Callable] = None
    ) -> Tuple[bool, str]:
        """
        Скачать релиз с GitHub.
        
        Args:
            version_tag: Тег версии (например, "2.1.9" или "v2.1.9")
            progress_callback: Callback для отслеживания прогресса
            
        Returns:
            (success, path_or_error)
        """
        try:
            # Нормализуем тег
            if not version_tag.startswith('v'):
                version_tag = f'v{version_tag}'
            
            # Получаем URL для скачивания
            url = f"{self.GITHUB_API_BASE}/repos/{self.GITHUB_OWNER}/{self.GITHUB_REPO}/releases/tags/{version_tag}"
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status != 200:
                        return False, f"Релиз {version_tag} не найден (статус {response.status})"
                    
                    release_info = await response.json()
                    download_url = release_info.get('zipball_url')
                    
                    if not download_url:
                        return False, "URL для скачивания не найден"
                
                # Скачиваем архив
                temp_dir = Path(tempfile.mkdtemp())
                zip_path = temp_dir / f"moonbot_{version_tag}.zip"
                
                async with session.get(
                    download_url, 
                    timeout=aiohttp.ClientTimeout(total=300)
                ) as response:
                    if response.status != 200:
                        return False, f"Ошибка скачивания: статус {response.status}"
                    
                    total_size = int(response.headers.get('content-length', 0))
                    downloaded = 0
                    
                    with open(zip_path, 'wb') as f:
                        async for chunk in response.content.iter_chunked(8192):
                            f.write(chunk)
                            downloaded += len(chunk)
                            
                            if progress_callback and total_size > 0:
                                progress = (downloaded / total_size) * 100
                                progress_callback(progress)
                
                logger.info(f"Релиз {version_tag} скачан: {zip_path}")
                return True, str(zip_path)
                
        except Exception as e:
            logger.error(f"Ошибка скачивания релиза: {e}")
            return False, str(e)


