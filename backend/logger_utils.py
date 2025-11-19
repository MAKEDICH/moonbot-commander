"""
🎨 Modern Logging System for MoonBot Commander
==============================================

Features:
- ✅ Millisecond precision timestamps
- ✅ Colored console output (level-based)
- ✅ Automatic password/token filtering
- ✅ File rotation (10MB per file, 30 days retention)
- ✅ Dual output: console + file
- ✅ Simple API: log(message, level="INFO")
- ✅ Context-aware: automatically detects caller module

Usage:
    from logger_utils import log, get_logger
    
    # Simple API:
    log("Server started successfully")
    log("Failed to connect", level="ERROR")
    
    # Advanced API:
    logger = get_logger(__name__)
    logger.info("Processing data...")
"""

import logging
import sys
import re
import os
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from datetime import datetime
from pathlib import Path


# =============================
# 🎨 COLOR CODES (ANSI)
# =============================

class Colors:
    """ANSI color codes for terminal output"""
    RESET = '\033[0m'
    BOLD = '\033[1m'
    
    # Level colors
    DEBUG = '\033[36m'      # Cyan
    INFO = '\033[32m'       # Green
    WARNING = '\033[33m'    # Yellow
    ERROR = '\033[31m'      # Red
    CRITICAL = '\033[35m'   # Magenta
    
    # Component colors
    TIMESTAMP = '\033[90m'  # Dark gray
    MODULE = '\033[94m'     # Light blue


# =============================
# 🔒 SENSITIVE DATA FILTER
# =============================

class SensitiveDataFilter(logging.Filter):
    """Автоматически скрывает пароли, токены и другие чувствительные данные"""
    
    PATTERNS = [
        # Passwords
        (r'password["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)', r'password=***HIDDEN***'),
        (r'Password:\s*([^\s]+)', r'Password: ***HIDDEN***'),
        (r'Real password:\s*([^\s]+)', r'Real password: ***HIDDEN***'),
        
        # Tokens
        (r'token["\']?\s*[:=]\s*["\']?([^"\'\s,}]{20,})', r'token=***HIDDEN***'),
        (r'Bearer\s+([A-Za-z0-9\-._~+/]+)', r'Bearer ***HIDDEN***'),
        
        # API Keys
        (r'api[_-]?key["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)', r'api_key=***HIDDEN***'),
        
        # Secret keys
        (r'secret[_-]?key["\']?\s*[:=]\s*["\']?([^"\'\s,}]+)', r'secret_key=***HIDDEN***'),
        
        # HMAC
        (r'hmac["\']?\s*[:=]\s*["\']?([A-Fa-f0-9]{16,})', r'hmac=***HIDDEN***'),
        
        # Encryption keys (Fernet format)
        (r'(gAAAAA[A-Za-z0-9+/=]{20,})', r'***ENCRYPTED***'),
    ]
    
    def filter(self, record):
        """Фильтрует чувствительные данные из лог-сообщений"""
        if isinstance(record.msg, str):
            for pattern, replacement in self.PATTERNS:
                record.msg = re.sub(pattern, replacement, record.msg, flags=re.IGNORECASE)
        return True


# =============================
# 🎨 COLORED FORMATTER
# =============================

class ColoredFormatter(logging.Formatter):
    """Форматтер с цветным выводом для консоли"""
    
    LEVEL_COLORS = {
        logging.DEBUG: Colors.DEBUG,
        logging.INFO: Colors.INFO,
        logging.WARNING: Colors.WARNING,
        logging.ERROR: Colors.ERROR,
        logging.CRITICAL: Colors.CRITICAL,
    }
    
    def format(self, record):
        # Сохраняем оригинальное имя уровня
        levelname_original = record.levelname
        
        # Добавляем цвет к уровню
        level_color = self.LEVEL_COLORS.get(record.levelno, Colors.RESET)
        record.levelname = f"{level_color}{record.levelname:<8}{Colors.RESET}"
        
        # Форматируем сообщение
        formatted = super().format(record)
        
        # Восстанавливаем оригинальное имя (для других handlers)
        record.levelname = levelname_original
        
        # Добавляем цвета к timestamp и модулю
        parts = formatted.split(']', 2)
        if len(parts) >= 3:
            timestamp_part = parts[0] + ']'
            level_part = parts[1] + ']'
            message_part = parts[2]
            
            formatted = (
                f"{Colors.TIMESTAMP}{timestamp_part}{Colors.RESET}"
                f"{level_part}"
                f"{message_part}"
            )
        
        return formatted


# =============================
# 🗄️ SMART SIZE-MANAGED FILE HANDLER
# =============================

class SizeManagedRotatingFileHandler(RotatingFileHandler):
    """
    Enhanced RotatingFileHandler that manages total size of all log files.
    When total size exceeds max_total_bytes, it removes oldest logs
    to free up cleanup_bytes of space.
    """
    
    def __init__(self, filename, mode='a', maxBytes=0, backupCount=0,
                 encoding=None, delay=False, max_total_bytes=1024*1024*1024,  # 1GB
                 cleanup_bytes=100*1024*1024):  # 100MB
        super().__init__(filename, mode, maxBytes, backupCount, encoding, delay)
        self.max_total_bytes = max_total_bytes
        self.cleanup_bytes = cleanup_bytes
        self.base_filename = filename
        
    def doRollover(self):
        """Override to check total size before rotating"""
        super().doRollover()
        self._check_and_cleanup_total_size()
    
    def _check_and_cleanup_total_size(self):
        """Check total size of all log files and cleanup if needed"""
        # Get directory and base name
        log_dir = os.path.dirname(self.baseFilename) or '.'
        base_name = os.path.basename(self.baseFilename)
        
        # Find all related log files
        log_files = []
        total_size = 0
        
        # Add main log file
        if os.path.exists(self.baseFilename):
            size = os.path.getsize(self.baseFilename)
            total_size += size
            log_files.append((self.baseFilename, os.path.getmtime(self.baseFilename), size))
        
        # Add rotated files
        for i in range(1, self.backupCount + 100):  # Check more than backupCount in case of leftovers
            rotated_name = f"{self.baseFilename}.{i}"
            if os.path.exists(rotated_name):
                size = os.path.getsize(rotated_name)
                total_size += size
                log_files.append((rotated_name, os.path.getmtime(rotated_name), size))
        
        # If total size exceeds limit, remove oldest files
        if total_size > self.max_total_bytes:
            # Sort by modification time (oldest first)
            log_files.sort(key=lambda x: x[1])
            
            bytes_to_free = self.cleanup_bytes
            freed_bytes = 0
            
            for filepath, mtime, size in log_files:
                # Skip the main log file
                if filepath == self.baseFilename:
                    continue
                    
                try:
                    os.remove(filepath)
                    freed_bytes += size
                    logging.info(f"Removed old log file: {os.path.basename(filepath)} (freed {size/1024/1024:.1f}MB)")
                    
                    if freed_bytes >= bytes_to_free:
                        break
                except Exception as e:
                    logging.warning(f"Failed to remove log file {filepath}: {e}")
            
            if freed_bytes > 0:
                logging.info(f"Total freed: {freed_bytes/1024/1024:.1f}MB")


def check_and_manage_all_logs(log_dir: str = "logs", 
                             max_total_bytes: int = 1024*1024*1024,  # 1GB
                             cleanup_bytes: int = 100*1024*1024):    # 100MB
    """
    Check total size of ALL log files in directory and cleanup if needed.
    This includes logs not managed by RotatingFileHandler.
    """
    log_path = Path(log_dir)
    if not log_path.exists():
        return
    
    # Find all log files
    log_files = []
    total_size = 0
    
    # Scan both root backend directory and logs subdirectory
    search_dirs = [Path("backend"), log_path]
    
    for search_dir in search_dirs:
        if search_dir.exists():
            for log_file in search_dir.glob("*.log*"):
                if log_file.is_file():
                    size = log_file.stat().st_size
                    total_size += size
                    log_files.append((log_file, log_file.stat().st_mtime, size))
    
    # If total size exceeds limit, remove oldest files
    if total_size > max_total_bytes:
        logging.warning(f"Total log size ({total_size/1024/1024:.1f}MB) exceeds limit ({max_total_bytes/1024/1024:.1f}MB)")
        
        # Sort by modification time (oldest first)
        log_files.sort(key=lambda x: x[1])
        
        bytes_to_free = cleanup_bytes
        freed_bytes = 0
        
        for filepath, mtime, size in log_files:
            # Skip recently modified files (less than 1 hour old)
            if datetime.now().timestamp() - mtime < 3600:
                continue
                
            # Skip the main moonbot.log (it's actively written to)
            if filepath.name == "moonbot.log":
                continue
            
            try:
                filepath.unlink()
                freed_bytes += size
                logging.info(f"Auto-removed old log: {filepath.name} (freed {size/1024/1024:.1f}MB)")
                
                if freed_bytes >= bytes_to_free:
                    break
            except Exception as e:
                logging.warning(f"Failed to remove log file {filepath}: {e}")
        
        if freed_bytes > 0:
            logging.info(f"Auto-cleanup complete: freed {freed_bytes/1024/1024:.1f}MB")
            new_total = total_size - freed_bytes
            logging.info(f"New total log size: {new_total/1024/1024:.1f}MB")


# =============================
# 📁 LOGGER CONFIGURATION
# =============================

def setup_logging(
    log_dir: str = "logs",
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
        log_dir: Директория для логов
        log_file: Имя файла лога
        console_level: Уровень логирования для консоли
        file_level: Уровень логирования для файла
        max_bytes: Максимальный размер файла лога (байты) - по умолчанию 50MB
        backup_count: Количество backup файлов - по умолчанию 20 (общий размер до 1GB)
        enable_colors: Включить цветной вывод
    """
    
    # Создаём директорию для логов
    log_path = Path(log_dir)
    log_path.mkdir(exist_ok=True)
    
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
    
    file_handler = SizeManagedRotatingFileHandler(
        log_path / log_file,
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
    logging.info(f"   Log file: {log_file}")
    logging.info(f"   Max file size: {max_bytes / (1024*1024):.1f}MB per file")
    logging.info(f"   Backup count: {backup_count} files")
    logging.info(f"   Total limit: 1GB (auto-cleanup enabled)")
    logging.info(f"   Auto-cleanup: 100MB when limit reached")
    logging.info(f"   Colors: {'enabled' if enable_colors else 'disabled'}")
    logging.info("=" * 60)
    
    # Check and manage all logs on startup
    check_and_manage_all_logs(log_dir)


# =============================
# 🎯 SIMPLE API
# =============================

def log(message: str, level: str = "INFO"):
    """
    Простой API для логирования
    
    Args:
        message: Сообщение для логирования
        level: Уровень логирования (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Examples:
        log("Server started")
        log("Connection failed", level="ERROR")
        log("Debugging info", level="DEBUG")
    """
    logger = logging.getLogger("moonbot")
    
    level = level.upper()
    if level == "DEBUG":
        logger.debug(message)
    elif level == "INFO":
        logger.info(message)
    elif level == "WARNING" or level == "WARN":
        logger.warning(message)
    elif level == "ERROR":
        logger.error(message)
    elif level == "CRITICAL":
        logger.critical(message)
    else:
        logger.info(message)


def get_logger(name: str = None) -> logging.Logger:
    """
    Получить logger для модуля (advanced API)
    
    Args:
        name: Имя модуля (обычно __name__)
    
    Returns:
        logging.Logger instance
    
    Example:
        logger = get_logger(__name__)
        logger.info("Processing data...")
        logger.error("Failed to connect")
    """
    if name is None:
        name = "moonbot"
    return logging.getLogger(name)


# =============================
# 🔧 AUTO-INITIALIZATION
# =============================

# Автоматически инициализируем при импорте
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


# =============================
# 🧪 TESTING
# =============================

if __name__ == "__main__":
    """Тестирование системы логирования"""
    
    print("\n" + "=" * 70)
    print("Testing MoonBot Logging System")
    print("=" * 70 + "\n")
    
    # Тест всех уровней
    log("This is a DEBUG message", level="DEBUG")
    log("This is an INFO message", level="INFO")
    log("This is a WARNING message", level="WARNING")
    log("This is an ERROR message", level="ERROR")
    log("This is a CRITICAL message", level="CRITICAL")
    
    print("\n" + "-" * 70)
    print("Testing sensitive data filtering:")
    print("-" * 70 + "\n")
    
    # Тест фильтрации паролей
    log("Server password: MySecretPass123")
    log("Real password: SuperSecret456")
    log('Config: {"password": "leaked_password", "host": "localhost"}')
    log("Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0")
    log("API key: sk_live_51234567890abcdef")
    log("HMAC: a1b2c3d4e5f6789012345678901234567890")
    log("Encrypted data: gAAAAABf3qZ5jK8L9m0n1o2p3q4r5s6t7u8v9w0x1y2z3A4B5C6D7E8F9G0H")
    
    print("\n" + "-" * 70)
    print("Testing advanced API:")
    print("-" * 70 + "\n")
    
    # Тест advanced API
    logger = get_logger("test_module")
    logger.info("Using module-specific logger")
    logger.debug("Debug information with context")
    logger.error("Error with module context")
    
    print("\n" + "=" * 70)
    print("Testing completed! Check logs/ directory for output files")
    print("=" * 70 + "\n")

