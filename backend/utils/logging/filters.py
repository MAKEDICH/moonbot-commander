"""
🔒 Sensitive Data Filter for Logging
"""

import logging
import re
from typing import List, Optional, Set


# Все доступные категории логов
# spam_level: high (красный) = много логов, medium (желтый) = средне, low (зеленый) = редко
# ВАЖНО: Только реально используемые категории в коде!
LOG_CATEGORIES = [
    # === Основные (только при старте/остановке) ===
    {"id": "MAIN", "name": "Основные события", "spam_level": "low",
     "example": "[2025-01-15 10:30:45.123] [INFO] [MAIN] Application initialized successfully"},
    {"id": "STARTUP", "name": "Запуск", "spam_level": "low",
     "example": "[2025-01-15 10:30:45.456] [INFO] [STARTUP] Found 5 active servers"},
    {"id": "SHUTDOWN", "name": "Остановка", "spam_level": "low",
     "example": "[2025-01-15 18:00:00.789] [INFO] [SHUTDOWN] All components stopped"},
    {"id": "ERROR", "name": "Ошибки", "spam_level": "low",
     "example": "[2025-01-15 10:30:45.999] [ERROR] [ERROR-a1b2c3] Unhandled exception: ..."},
    
    # === Инфраструктура ===
    {"id": "DATABASE", "name": "База данных", "spam_level": "low",
     "example": "[2025-01-15 10:30:46.222] [INFO] [DATABASE] Using SQLite (optimized)"},
    {"id": "HTTP", "name": "HTTP запросы (uvicorn)", "spam_level": "high",
     "example": "10.0.0.1:52000 - \"POST /api/servers/1/ping HTTP/1.1\" 200 OK"},
    {"id": "WS", "name": "WebSocket подключения", "spam_level": "medium",
     "example": "[2025-01-15 10:31:00.333] [INFO] [WS] Client connected, total: 3"},
    {"id": "CORS", "name": "CORS настройки", "spam_level": "low",
     "example": "[2025-01-15 10:30:46.444] [INFO] [CORS] Configured for localhost"},
    
    # === UDP (основной источник логов!) ===
    {"id": "UDP-LISTENER", "name": "UDP обработка данных", "spam_level": "high",
     "example": "[2025-01-15 10:30:47.555] [INFO] [UDP-LISTENER-1] 📥 Response received from queue: Open Sell..."},
    {"id": "UDP-SEND", "name": "UDP отправка команд", "spam_level": "high",
     "example": "[2025-01-15 10:30:47.666] [INFO] [UDP-SEND] Server 1: lst -> 10.0.0.1:12345 (HMAC: a1b2...)"},
    {"id": "UDP-CLIENT", "name": "UDP клиент (ping)", "spam_level": "high",
     "example": "[2025-01-15 10:30:47.777] [INFO] [UDP-CLIENT] Sending: lst -> 10.0.0.1:12345 (HMAC: a1b2...)"},
    {"id": "GLOBAL-UDP", "name": "Глобальный UDP сокет", "spam_level": "medium",
     "example": "[2025-01-15 10:30:47.888] [INFO] [GLOBAL-UDP] Registered listener for 10.0.0.1:12345"},
    {"id": "UDP-HELPER", "name": "UDP Helper (команды)", "spam_level": "medium",
     "example": "[2025-01-15 10:30:48.111] [INFO] [UDP-HELPER] Sending command to server 1 through listener"},
    
    # === Бизнес-логика ===
    {"id": "API", "name": "API операции", "spam_level": "medium",
     "example": "[2025-01-15 10:30:49.111] [INFO] [API] Testing server 1 through listener"},
    {"id": "SCHEDULER", "name": "Планировщик задач", "spam_level": "low",
     "example": "[2025-01-15 09:00:00.222] [INFO] [SCHEDULER] Executing 'DailyTask' scheduled for 09:00"},
    {"id": "MONITOR", "name": "Мониторинг listeners", "spam_level": "low",
     "example": "[2025-01-15 10:30:50.333] [INFO] [MONITOR] Listener for server 1 is down, restarting..."},
    {"id": "SETTINGS", "name": "Изменение настроек", "spam_level": "low",
     "example": "[2025-01-15 10:30:52.555] [INFO] [SETTINGS] Log level changed to: DEBUG"},
    
    # === Внешние сервисы ===
    {"id": "UPBIT", "name": "Upbit данные", "spam_level": "low",
     "example": "[2025-01-15 10:30:58.222] [INFO] [UPBIT] Cache updated with 50 pairs"},
    
    # === Обслуживание ===
    {"id": "CLEANUP", "name": "Автоочистка данных", "spam_level": "low",
     "example": "[2025-01-15 04:00:00.444] [INFO] [CLEANUP] Removed 150 old log entries"},
    {"id": "SYNC", "name": "Синхронизация данных", "spam_level": "low",
     "example": "[2025-01-15 10:30:59.555] [INFO] [SYNC] Synced 25 orders from server"},
    
    # === Пакетная обработка (статистика) ===
    {"id": "BATCH", "name": "Статистика обработки", "spam_level": "medium",
     "example": "[2025-01-15 10:31:00.111] [INFO] [BALANCE-BATCH] Processed 100 balances, DB: 50ms"},
    
    # === Прочее ===
    {"id": "OTHER", "name": "Логи без категории", "spam_level": "medium",
     "example": "[2025-01-15 10:31:00.666] [INFO] Some message without [CATEGORY] tag"},
]

# Глобальные настройки фильтрации по категориям
_enabled_categories: Optional[Set[str]] = None  # None = все категории включены
_selective_mode: bool = False


def set_log_categories(categories: Optional[List[str]], selective_mode: bool = False):
    """
    Установить активные категории логов.
    
    Args:
        categories: Список категорий для логирования или None для всех
        selective_mode: True если включен выборочный режим (level=4)
    """
    global _enabled_categories, _selective_mode
    _selective_mode = selective_mode
    
    if selective_mode and categories:
        _enabled_categories = set(categories)
    else:
        _enabled_categories = None


def get_enabled_categories() -> Optional[Set[str]]:
    """Получить текущие включенные категории."""
    return _enabled_categories


def is_selective_mode() -> bool:
    """Проверить включен ли выборочный режим."""
    return _selective_mode


class SensitiveDataFilter(logging.Filter):
    """Автоматически скрывает пароли, токены и другие чувствительные данные"""

    PATTERNS = [
        # Passwords
        (r'password["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)',
         r'password=***HIDDEN***'),
        (r'Password:\s*([^\s]+)', r'Password: ***HIDDEN***'),
        (r'Real password:\s*([^\s]+)', r'Real password: ***HIDDEN***'),

        # Tokens
        (r'token["\']?\s*[:=]\s*["\']?([^"\'\s,}]{20,})',
         r'token=***HIDDEN***'),
        (r'Bearer\s+([A-Za-z0-9\-._~+/]+)', r'Bearer ***HIDDEN***'),

        # API Keys
        (r'api[_-]?key["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)',
         r'api_key=***HIDDEN***'),

        # Secret keys
        (r'secret[_-]?key["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)',
         r'secret_key=***HIDDEN***'),

        # HMAC
        (r'hmac["\']?\s*[:=]\s*["\']?([A-Fa-f0-9]{16,})',
         r'hmac=***HIDDEN***'),

        # Encryption keys (Fernet format)
        (r'(gAAAAA[A-Za-z0-9+/=]{20,})', r'***ENCRYPTED***'),
    ]

    def filter(self, record):
        """Фильтрует чувствительные данные из лог-сообщений"""
        if isinstance(record.msg, str):
            for pattern, replacement in self.PATTERNS:
                record.msg = re.sub(pattern, replacement,
                                    record.msg, flags=re.IGNORECASE)
        return True


class CategoryFilter(logging.Filter):
    """
    Фильтр логов по категориям.
    
    Пропускает логи только из выбранных категорий.
    Категория определяется по паттерну [CATEGORY] в начале сообщения.
    """
    
    # Паттерн для извлечения категории: [CATEGORY] или [CATEGORY-123]
    CATEGORY_PATTERN = re.compile(r'^\[([A-Z][A-Z0-9_-]*?)(?:-\d+)?\]')
    
    # Паттерн для HTTP логов uvicorn (формат: IP:PORT - "METHOD PATH PROTOCOL" STATUS)
    HTTP_PATTERN = re.compile(r'^\d+\.\d+\.\d+\.\d+:\d+\s+-\s+"(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)')
    
    def filter(self, record):
        """
        Фильтрует лог по категории.
        
        Returns:
            True если лог должен быть записан, False для пропуска
        """
        # Если выборочный режим не включен - пропускаем всё
        if not _selective_mode:
            return True
        
        # Если категории не заданы - пропускаем всё
        if _enabled_categories is None:
            return True
        
        # Извлекаем категорию из сообщения
        msg = str(record.msg) if record.msg else ""
        match = self.CATEGORY_PATTERN.match(msg)
        
        if match:
            category = match.group(1)
            # Нормализуем категорию
            parts = category.split('-')
            
            # Специальная обработка для *-BATCH категорий
            if parts[-1] == 'BATCH':
                return "BATCH" in _enabled_categories
            
            # UDP-LISTENER-123 -> UDP-LISTENER (убираем числовой суффикс)
            if len(parts) > 1 and parts[-1].isdigit():
                base_category = '-'.join(parts[:-1])
            else:
                base_category = category
            
            # Проверяем полную категорию и базовую
            return category in _enabled_categories or base_category in _enabled_categories
        
        # Проверяем HTTP логи uvicorn
        if self.HTTP_PATTERN.match(msg):
            return "HTTP" in _enabled_categories
        
        # Логи без категории проверяем через OTHER
        return "OTHER" in _enabled_categories
