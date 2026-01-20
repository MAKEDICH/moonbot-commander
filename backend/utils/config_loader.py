"""
Загрузчик YAML конфигураций

Предоставляет централизованный доступ к YAML конфигурациям приложения.
Поддерживает кэширование и перезагрузку конфигураций.
"""
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Optional

import yaml


class ConfigLoader:
    """
    Класс для загрузки и управления YAML конфигурациями.
    
    Attributes:
        config_dir: Путь к директории с конфигурациями
        _configs: Кэш загруженных конфигураций
    """
    
    def __init__(self, config_dir: str = "config") -> None:
        """
        Инициализация загрузчика конфигураций.
        
        Args:
            config_dir: Путь к директории с конфигурациями (относительно корня приложения)
        """
        # Определяем базовый путь проекта
        base_path: Path = Path(__file__).parent.parent  # backend/utils -> backend
        self.config_dir: Path = base_path / config_dir
        self._configs: Dict[str, Any] = {}
    
    def load(self, config_name: str) -> Dict[str, Any]:
        """
        Загрузить конфигурацию по имени файла (без расширения).
        
        Args:
            config_name: Имя файла конфигурации без расширения (например, 'app', 'logging')
        
        Returns:
            Dict[str, Any]: Словарь с конфигурацией
            
        Raises:
            FileNotFoundError: Если файл конфигурации не найден
        """
        if config_name in self._configs:
            return self._configs[config_name]
        
        config_path: Path = self.config_dir / f"{config_name}.yaml"
        
        if not config_path.exists():
            raise FileNotFoundError(f"Файл конфигурации {config_path} не найден")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            config: Dict[str, Any] = yaml.safe_load(f)
        
        self._configs[config_name] = config
        return config
    
    def get(self, config_name: str, key: str, default: Any = None) -> Any:
        """
        Получить значение из конфигурации по ключу.
        
        Args:
            config_name: Имя конфигурации
            key: Ключ в формате 'section.subsection.key'
            default: Значение по умолчанию
        
        Returns:
            Any: Значение из конфигурации или default
        """
        config: Dict[str, Any] = self.load(config_name)
        
        keys: list = key.split('.')
        value: Any = config
        
        for k in keys:
            if isinstance(value, dict) and k in value:
                value = value[k]
            else:
                return default
        
        return value
    
    def reload(self, config_name: Optional[str] = None) -> None:
        """
        Перезагрузить конфигурацию.
        
        Args:
            config_name: Имя конфигурации для перезагрузки или None для всех
        """
        if config_name:
            if config_name in self._configs:
                del self._configs[config_name]
        else:
            self._configs.clear()


@lru_cache()
def get_config_loader() -> ConfigLoader:
    """
    Получить singleton экземпляр загрузчика конфигураций.
    
    Returns:
        ConfigLoader: Экземпляр загрузчика
    """
    return ConfigLoader()


def load_config(config_name: str) -> Dict[str, Any]:
    """
    Загрузить конфигурацию.
    
    Args:
        config_name: Имя файла конфигурации без расширения
    
    Returns:
        Dict[str, Any]: Словарь с конфигурацией
    """
    loader: ConfigLoader = get_config_loader()
    return loader.load(config_name)


def get_config_value(config_name: str, key: str, default: Any = None) -> Any:
    """
    Получить значение из конфигурации.
    
    Args:
        config_name: Имя конфигурации
        key: Ключ в формате 'section.subsection.key'
        default: Значение по умолчанию
    
    Returns:
        Any: Значение из конфигурации или default
    """
    loader: ConfigLoader = get_config_loader()
    return loader.get(config_name, key, default)
