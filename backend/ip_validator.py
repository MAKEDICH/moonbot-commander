"""
IP адрес валидация для защиты от SSRF (Server-Side Request Forgery)
"""
import ipaddress
import socket
from typing import Tuple

def validate_host(host: str) -> Tuple[bool, str]:
    """
    Валидация хоста для предотвращения SSRF атак
    
    Args:
        host: IP адрес или hostname
        
    Returns:
        (is_valid, error_message)
    """
    # Запрещенные hostname patterns
    forbidden_hosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        'local',
    ]
    
    host_lower = host.lower().strip()
    
    # Проверка на запрещенные hostname
    if host_lower in forbidden_hosts:
        return False, "Локальные адреса запрещены (защита от SSRF)"
    
    # Попытка распарсить как IP адрес
    try:
        ip = ipaddress.ip_address(host)
        
        # Блокируем private/loopback/link-local адреса
        if ip.is_private:
            return False, "Приватные IP адреса запрещены (10.x.x.x, 192.168.x.x, 172.16-31.x.x)"
        
        if ip.is_loopback:
            return False, "Loopback адреса запрещены (127.0.0.1, ::1)"
        
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
            resolved_ip = socket.gethostbyname(host)
            
            # Рекурсивно проверяем resolved IP
            return validate_host(resolved_ip)
            
        except socket.gaierror:
            return False, f"Не удалось разрешить hostname: {host}"
        except Exception as e:
            return False, f"Ошибка валидации hostname: {str(e)}"
    
    except Exception as e:
        return False, f"Ошибка валидации: {str(e)}"


def validate_port(port: int) -> Tuple[bool, str]:
    """
    Валидация UDP порта
    
    Args:
        port: Номер порта
        
    Returns:
        (is_valid, error_message)
    """
    if port < 1 or port > 65535:
        return False, "Порт должен быть в диапазоне 1-65535"
    
    # Опционально: блокируем системные/критичные порты
    # Для UDP обычно используются порты > 1024
    if port < 1024:
        return False, "Системные порты (< 1024) запрещены для безопасности"
    
    return True, ""




