"""
Криптографический модуль для шифрования данных экспорта.

Использует:
- PBKDF2 для деривации ключа из пароля пользователя
- AES-256-GCM для шифрования данных
- Уникальная соль и nonce для каждого экспорта

Формат зашифрованного файла:
[MAGIC_HEADER][VERSION][SALT][NONCE][ENCRYPTED_DATA][AUTH_TAG]
"""

import os
import struct
import hashlib
import logging
from typing import Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)


class DataCrypto:
    """
    Класс для шифрования/дешифрования данных экспорта.
    
    Особенности:
    - Использует пароль пользователя для генерации ключа
    - AES-256-GCM обеспечивает конфиденциальность и целостность
    - Каждый файл имеет уникальную соль и nonce
    - Файл может быть расшифрован только с правильным паролем
    """
    
    # Магический заголовок для идентификации файла
    MAGIC_HEADER = b'MBCEXP'  # MoonBot Commander EXPort
    
    # Версия формата файла
    FORMAT_VERSION = 1
    
    # Параметры криптографии
    SALT_SIZE = 32  # 256 бит
    NONCE_SIZE = 12  # 96 бит для GCM
    KEY_SIZE = 32  # 256 бит для AES-256
    ITERATIONS = 600000  # Количество итераций PBKDF2 (рекомендовано OWASP 2023)
    
    def __init__(self):
        self.backend = default_backend()
    
    def derive_key(self, password: str, salt: bytes) -> bytes:
        """
        Получить ключ шифрования из пароля пользователя.
        
        Args:
            password: Пароль пользователя
            salt: Уникальная соль
            
        Returns:
            32-байтный ключ для AES-256
        """
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=self.KEY_SIZE,
            salt=salt,
            iterations=self.ITERATIONS,
            backend=self.backend
        )
        return kdf.derive(password.encode('utf-8'))
    
    def encrypt(self, data: bytes, password: str) -> bytes:
        """
        Зашифровать данные с использованием пароля.
        
        Args:
            data: Данные для шифрования
            password: Пароль пользователя
            
        Returns:
            Зашифрованные данные с заголовком
        """
        # Генерируем уникальную соль и nonce
        salt = os.urandom(self.SALT_SIZE)
        nonce = os.urandom(self.NONCE_SIZE)
        
        # Получаем ключ из пароля
        key = self.derive_key(password, salt)
        
        # Шифруем данные с AES-GCM
        aesgcm = AESGCM(key)
        encrypted_data = aesgcm.encrypt(nonce, data, None)
        
        # Формируем файл: HEADER + VERSION + SALT + NONCE + ENCRYPTED_DATA
        result = bytearray()
        result.extend(self.MAGIC_HEADER)
        result.extend(struct.pack('<H', self.FORMAT_VERSION))  # 2 bytes, little-endian
        result.extend(salt)
        result.extend(nonce)
        result.extend(encrypted_data)
        
        logger.info(f"Данные зашифрованы: {len(data)} байт -> {len(result)} байт")
        
        return bytes(result)
    
    def decrypt(self, encrypted_data: bytes, password: str) -> Tuple[bool, Optional[bytes], str]:
        """
        Расшифровать данные с использованием пароля.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль пользователя
            
        Returns:
            (success, data, error_message)
        """
        try:
            # Проверяем минимальный размер
            min_size = len(self.MAGIC_HEADER) + 2 + self.SALT_SIZE + self.NONCE_SIZE + 16
            if len(encrypted_data) < min_size:
                return False, None, "Файл повреждён или имеет неверный формат"
            
            offset = 0
            
            # Проверяем магический заголовок
            header = encrypted_data[offset:offset + len(self.MAGIC_HEADER)]
            offset += len(self.MAGIC_HEADER)
            
            if header != self.MAGIC_HEADER:
                return False, None, "Файл не является экспортом MoonBot Commander"
            
            # Читаем версию
            version = struct.unpack('<H', encrypted_data[offset:offset + 2])[0]
            offset += 2
            
            if version > self.FORMAT_VERSION:
                return False, None, f"Версия файла ({version}) не поддерживается. Обновите приложение."
            
            # Читаем соль
            salt = encrypted_data[offset:offset + self.SALT_SIZE]
            offset += self.SALT_SIZE
            
            # Читаем nonce
            nonce = encrypted_data[offset:offset + self.NONCE_SIZE]
            offset += self.NONCE_SIZE
            
            # Остальное - зашифрованные данные
            ciphertext = encrypted_data[offset:]
            
            # Получаем ключ из пароля
            key = self.derive_key(password, salt)
            
            # Расшифровываем
            aesgcm = AESGCM(key)
            
            try:
                decrypted_data = aesgcm.decrypt(nonce, ciphertext, None)
            except Exception:
                return False, None, "Неверный пароль или файл повреждён"
            
            logger.info(f"Данные расшифрованы: {len(encrypted_data)} байт -> {len(decrypted_data)} байт")
            
            return True, decrypted_data, ""
            
        except Exception as e:
            logger.error(f"Ошибка расшифровки: {e}")
            return False, None, f"Ошибка расшифровки: {str(e)}"
    
    def verify_password(self, encrypted_data: bytes, password: str) -> bool:
        """
        Проверить правильность пароля без полной расшифровки.
        
        Args:
            encrypted_data: Зашифрованные данные
            password: Пароль для проверки
            
        Returns:
            True если пароль верный
        """
        success, _, _ = self.decrypt(encrypted_data, password)
        return success
    
    @staticmethod
    def generate_password_hash(password: str) -> str:
        """
        Генерировать хэш пароля для отображения (не для хранения!).
        Используется только для визуального подтверждения.
        
        Args:
            password: Пароль
            
        Returns:
            Короткий хэш для отображения
        """
        h = hashlib.sha256(password.encode('utf-8')).hexdigest()
        return h[:8].upper()


