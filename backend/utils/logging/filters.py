"""
🔒 Sensitive Data Filter for Logging
"""

import logging
import re


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
