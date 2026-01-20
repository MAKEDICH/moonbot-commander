"""
🎨 ANSI Color Codes for Terminal Output
"""


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
