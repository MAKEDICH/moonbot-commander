"""
HMAC Helper - утилиты для работы с HMAC-SHA256

Этот модуль устраняет дублирование кода генерации HMAC
во всех UDP компонентах проекта
"""
import hmac
import hashlib
from typing import Optional


def generate_hmac(command: str, password: str) -> str:
    """
    Генерация HMAC-SHA256 хэша для команды
    
    Args:
        command: Команда для отправки
        password: Пароль для HMAC
        
    Returns:
        str: HMAC-SHA256 хэш (64 символа hex)
    """
    if not password:
        return ""
    
    hash_obj = hmac.new(
        password.encode('utf-8'),
        command.encode('utf-8'),
        hashlib.sha256
    )
    return hash_obj.hexdigest()


def build_message_with_hmac(command: str, password: Optional[str]) -> str:
    """
    Построить сообщение с HMAC префиксом
    
    Args:
        command: Команда
        password: Пароль (если None - без HMAC)
        
    Returns:
        str: "HMAC command" или просто "command"
    """
    if password:
        hmac_hash = generate_hmac(command, password)
        return f"{hmac_hash} {command}"
    return command


def decode_udp_message(data: bytes, errors: str = 'replace') -> str:
    """
    Декодировать UDP сообщение с обработкой ошибок
    
    Args:
        data: Байты сообщения
        errors: Режим обработки ошибок ('replace', 'ignore', 'strict')
        
    Returns:
        str: Декодированная строка
    """
    return data.decode('utf-8', errors=errors)


def mask_password(password: str, visible_chars: int = 4) -> str:
    """
    Замаскировать пароль для логирования
    
    Args:
        password: Пароль
        visible_chars: Количество видимых символов в начале и конце
        
    Returns:
        str: Замаскированный пароль "****" или "pass****word"
    """
    if not password:
        return "None"
    
    if len(password) <= visible_chars * 2:
        return "****"
    
    return f"{password[:visible_chars]}****{password[-visible_chars:]}"



