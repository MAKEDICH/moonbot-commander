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
    from utils.logging import log, get_logger, setup_logging
    
    # Simple API:
    log("Server started successfully")
    log("Failed to connect", level="ERROR")
    
    # Advanced API:
    logger = get_logger(__name__)
    logger.info("Processing data...")
"""

from .api import log, get_logger, log_if_high_load, get_log_counter, reset_log_counters
from .setup import setup_logging
from .helpers import run_command_with_logging, check_and_manage_all_logs
from .colors import Colors
from .filters import SensitiveDataFilter
from .formatters import ColoredFormatter
from .handlers import DailySizedRotatingFileHandler, DailyLogStreamWriter

__all__ = [
    'log',
    'get_logger',
    'log_if_high_load',
    'get_log_counter',
    'reset_log_counters',
    'setup_logging',
    'run_command_with_logging',
    'check_and_manage_all_logs',
    'Colors',
    'SensitiveDataFilter',
    'ColoredFormatter',
    'DailySizedRotatingFileHandler',
    'DailyLogStreamWriter'
]
