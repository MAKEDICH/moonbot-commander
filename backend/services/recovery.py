"""
Утилиты для работы с recovery кодами

Предоставляет функции для генерации, хеширования
и верификации recovery кодов.
"""
import secrets
import string
from typing import List

from passlib.context import CryptContext


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_recovery_codes(count: int = 10) -> List[str]:
    """
    Генерирует указанное количество recovery кодов.
    
    Args:
        count: Количество кодов (по умолчанию 10)
        
    Returns:
        List[str]: Список сгенерированных кодов (без хеширования)
    """
    codes: List[str] = []
    for _ in range(count):
        # Генерируем код формата: XXXX-XXXX-XXXX (12 символов без дефисов)
        code_part1 = ''.join(
            secrets.choice(string.ascii_uppercase + string.digits) 
            for _ in range(4)
        )
        code_part2 = ''.join(
            secrets.choice(string.ascii_uppercase + string.digits) 
            for _ in range(4)
        )
        code_part3 = ''.join(
            secrets.choice(string.ascii_uppercase + string.digits) 
            for _ in range(4)
        )
        code = f"{code_part1}-{code_part2}-{code_part3}"
        codes.append(code)
    
    return codes


def hash_recovery_code(code: str) -> str:
    """
    Хеширует recovery код для безопасного хранения.
    
    Args:
        code: Recovery код
        
    Returns:
        str: Хешированный код
    """
    # Удаляем дефисы и приводим к верхнему регистру для единообразия
    normalized_code = code.replace('-', '').upper()
    return pwd_context.hash(normalized_code)


def verify_recovery_code(code: str, code_hash: str) -> bool:
    """
    Проверяет recovery код.
    
    Args:
        code: Введенный пользователем код
        code_hash: Хеш из БД
        
    Returns:
        bool: True если код верный
    """
    # Нормализуем введенный код
    normalized_code = code.replace('-', '').replace(' ', '').upper()
    return pwd_context.verify(normalized_code, code_hash)
