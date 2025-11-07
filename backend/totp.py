"""
Утилиты для работы с 2FA (Google Authenticator / TOTP)
"""
import pyotp
import qrcode
import io
import base64

def generate_totp_secret():
    """Генерирует случайный TOTP секрет"""
    return pyotp.random_base32()

def get_totp_uri(username, secret, issuer="MoonBot Commander"):
    """
    Создает provisioning URI для Google Authenticator
    
    Args:
        username: имя пользователя
        secret: TOTP секрет
        issuer: название приложения
        
    Returns:
        str: URI для QR-кода
    """
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name=issuer
    )

def generate_qr_code(data):
    """
    Генерирует QR-код в формате base64
    
    Args:
        data: данные для QR-кода (обычно URI)
        
    Returns:
        str: base64 закодированное изображение
    """
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

def verify_totp_code(secret, code):
    """
    Проверяет TOTP код
    
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




