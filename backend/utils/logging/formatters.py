"""
🎨 Colored Formatter for Console Output
"""

import logging
from .colors import Colors


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



