"""
📁 Logger Configuration and Setup
"""

import sys
import logging
from pathlib import Path
from typing import Optional

from .colors import Colors
from .filters import SensitiveDataFilter
from .formatters import ColoredFormatter
from .handlers import DailySizedRotatingFileHandler


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
DEFAULT_LOG_DIR = PROJECT_ROOT / "logs"
DEFAULT_LOG_DIR.mkdir(parents=True, exist_ok=True)


def setup_logging(
    log_dir: Optional[str] = None,
    log_file: str = "moonbot.log",
    console_level: int = logging.INFO,
    file_level: int = logging.DEBUG,
    max_bytes: int = 50 * 1024 * 1024,  # 50MB per file
    backup_count: int = 20,  # 20 files * 50MB = 1GB total
    enable_colors: bool = True
):
    """
    Настройка системы логирования

    Args:
        log_dir: Директория для логов (если None, используется /root/mbcomm/moonbot-commander/logs)
        log_file: Имя файла лога
        console_level: Уровень логирования для консоли
        file_level: Уровень логирования для файла
        max_bytes: Максимальный размер файла лога (байты) - по умолчанию 50MB
        backup_count: Количество backup файлов - по умолчанию 20 (общий размер до 1GB)
        enable_colors: Включить цветной вывод
    """

    log_path = Path(log_dir) if log_dir else DEFAULT_LOG_DIR
    log_path.mkdir(parents=True, exist_ok=True)
    log_name = Path(log_file).stem

    # Получаем root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)  # Минимальный уровень

    # Очищаем существующие handlers
    root_logger.handlers.clear()

    # ==================
    # CONSOLE HANDLER
    # ==================

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(console_level)

    if enable_colors and sys.stdout.isatty():
        # Цветной формат для консоли
        console_format = '%(asctime)s.%(msecs)03d] [%(levelname)s] %(message)s'
        console_formatter = ColoredFormatter(
            console_format,
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    else:
        # Обычный формат (без цветов)
        console_format = '[%(asctime)s.%(msecs)03d] [%(levelname)-8s] %(message)s'
        console_formatter = logging.Formatter(
            console_format,
            datefmt='%Y-%m-%d %H:%M:%S'
        )

    console_handler.setFormatter(console_formatter)
    console_handler.addFilter(SensitiveDataFilter())
    root_logger.addHandler(console_handler)

    # ==================
    # FILE HANDLER (with rotation)
    # ==================

    file_handler = DailySizedRotatingFileHandler(
        log_dir=log_path,
        log_name=log_name,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding='utf-8',
        max_total_bytes=1024 * 1024 * 1024,  # 1GB total limit
        cleanup_bytes=100 * 1024 * 1024      # Clean 100MB when limit reached
    )
    file_handler.setLevel(file_level)

    file_format = '[%(asctime)s.%(msecs)03d] [%(levelname)-8s] [%(name)s] %(message)s'
    file_formatter = logging.Formatter(
        file_format,
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    file_handler.setFormatter(file_formatter)
    file_handler.addFilter(SensitiveDataFilter())
    root_logger.addHandler(file_handler)

    # Логируем успешную инициализацию (без эмодзи для совместимости с Windows)
    logging.info("=" * 60)
    logging.info("MoonBot Commander Logging System Initialized")
    logging.info(f"   Log directory: {log_path.absolute()}")
    logging.info(f"   Daily pattern: YYYY-MM-DD_{log_name}_#.log")
    logging.info(f"   Max file size: {max_bytes / (1024*1024):.1f}MB per file")
    logging.info(f"   Backup count: {backup_count} files")
    logging.info(f"   Total limit: 1GB (auto-cleanup enabled)")
    logging.info(f"   Auto-cleanup: 100MB when limit reached")
    logging.info(f"   Colors: {'enabled' if enable_colors else 'disabled'}")
    logging.info("=" * 60)

    # Отключаем DEBUG логи от внешних библиотек
    noisy_loggers = [
        'selenium',
        'selenium.webdriver',
        'selenium.webdriver.remote',
        'selenium.webdriver.remote.remote_connection',
        'urllib3',
        'urllib3.connectionpool',
        'urllib3.poolmanager',
        'chardet',
        'requests',
        'httpx',
        'httpcore',
        'watchfiles',
        'asyncio',
        'aiosqlite',
    ]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

    # Check and manage all logs on startup
    from .helpers import check_and_manage_all_logs
    check_and_manage_all_logs(str(log_path))


# Auto-initialization
try:
    setup_logging()
except Exception as e:
    # Fallback: если не удалось настроить, используем базовую конфигурацию
    logging.basicConfig(
        level=logging.INFO,
        format='[%(asctime)s.%(msecs)03d] [%(levelname)-8s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    logging.warning(f"Failed to setup advanced logging: {e}")
    logging.warning("Using basic logging configuration")
