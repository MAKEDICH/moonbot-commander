"""
Утилиты для работы с 2FA (Google Authenticator / TOTP)

Предоставляет функции для генерации TOTP секретов,
создания QR-кодов и верификации кодов.
"""
import io
import base64
from typing import Optional

import pyotp
import qrcode


def generate_totp_secret() -> str:
    """
    Генерирует случайный TOTP секрет.
    
    Returns:
        str: Base32-кодированный секрет
    """
    return pyotp.random_base32()


def get_totp_uri(username: str, secret: str, issuer: str = "MoonBot Commander") -> str:
    """
    Создает provisioning URI для Google Authenticator.
    
    Args:
        username: Имя пользователя
        secret: TOTP секрет
        issuer: Название приложения
        
    Returns:
        str: URI для QR-кода
    """
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=issuer
    )


def generate_qr_code(
    username_or_data: str, 
    secret: Optional[str] = None, 
    issuer: str = "MoonBot Commander"
) -> str:
    """
    Генерирует QR-код в формате base64.
    
    Args:
        username_or_data: Имя пользователя (если указан secret) или URI напрямую
        secret: TOTP секрет (опционально)
        issuer: Название приложения
        
    Returns:
        str: base64 закодированное изображение в формате data URI
    """
    # Если передан secret, значит username_or_data это username
    if secret:
        data = get_totp_uri(username_or_data, secret, issuer)
    else:
        # Иначе username_or_data это уже готовый URI
        data = username_or_data
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Конвертируем в base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode()
    
    return f"data:image/png;base64,{img_base64}"


def verify_totp_code(secret: str, code: str) -> bool:
    """
    Проверяет TOTP код.
    
    Args:
        secret: TOTP секрет пользователя
        code: 6-значный код из приложения
        
    Returns:
        bool: True если код верный
    """
    if not secret or not code:
        return False
    
    totp = pyotp.TOTP(secret)
    # Проверяем текущий код + 1 предыдущий/следующий (для компенсации расхождения времени)
    return totp.verify(code, valid_window=1)
