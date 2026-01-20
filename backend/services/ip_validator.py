"""
IP адрес валидация для защиты от SSRF (Server-Side Request Forgery)

Предоставляет функции для валидации IP адресов и портов
с учётом безопасности.
"""
import ipaddress
import socket
from typing import Tuple


def validate_host(
    host: str, 
    allow_private: bool = True, 
    allow_localhost: bool = False
) -> Tuple[bool, str]:
    """
    Валидация хоста для предотвращения SSRF атак.
    
    Args:
        host: IP адрес или hostname
        allow_private: Разрешить приватные IP (192.168.x.x, 10.x.x.x) - для локальных серверов
        allow_localhost: Разрешить localhost/127.0.0.1 - только если явно указано is_localhost=True
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    # Запрещенные hostname patterns (всегда блокируем если не allow_localhost)
    forbidden_hosts: list = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
    ]
    
    host_lower: str = host.lower().strip()
    
    # Проверка на запрещенные hostname (ЕСЛИ НЕ allow_localhost)
    if not allow_localhost and host_lower in forbidden_hosts:
        return False, "Локальные loopback адреса запрещены. Установите флаг 'Разрешить localhost' для этого сервера."
    
    # Попытка распарсить как IP адрес
    try:
        ip = ipaddress.ip_address(host)
        
        # Блокируем loopback (127.0.0.1) ЕСЛИ НЕ allow_localhost
        if ip.is_loopback and not allow_localhost:
            return False, "Loopback адреса запрещены (127.0.0.1, ::1). Установите флаг 'Разрешить localhost'."
        
        # Приватные IP (192.168.x.x, 10.x.x.x) - разрешаем по умолчанию для локальных серверов
        if ip.is_private and not allow_private:
            return False, "Приватные IP адреса запрещены (10.x.x.x, 192.168.x.x, 172.16-31.x.x)"
        
        if ip.is_link_local:
            return False, "Link-local адреса запрещены (169.254.x.x)"
        
        if ip.is_multicast:
            return False, "Multicast адреса запрещены"
        
        if ip.is_reserved:
            return False, "Зарезервированные адреса запрещены"
        
        # Дополнительная проверка для IPv4
        if isinstance(ip, ipaddress.IPv4Address):
            # Блокируем 0.0.0.0/8
            if ip.packed[0] == 0:
                return False, "Недопустимый IP адрес (0.x.x.x)"
            
            # Блокируем 240.0.0.0/4 (reserved)
            if ip.packed[0] >= 240:
                return False, "Зарезервированный IP адрес"
        
        return True, ""
        
    except ValueError:
        # Не IP адрес, возможно hostname
        # Проверяем через DNS
        try:
            resolved_ip: str = socket.gethostbyname(host)
            
            # Рекурсивно проверяем resolved IP
            return validate_host(resolved_ip, allow_private, allow_localhost)
            
        except socket.gaierror:
            return False, f"Не удалось разрешить hostname: {host}"
        except Exception as e:
            return False, f"Ошибка валидации hostname: {str(e)}"
    
    except Exception as e:
        return False, f"Ошибка валидации: {str(e)}"


def validate_port(port: int) -> Tuple[bool, str]:
    """
    Валидация UDP порта.
    
    Args:
        port: Номер порта
        
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    if port < 1 or port > 65535:
        return False, "Порт должен быть в диапазоне 1-65535"
    
    # Блокируем системные/критичные порты для безопасности
    if port < 1024:
        return False, "Системные порты (< 1024) запрещены для безопасности"
    
    return True, ""
