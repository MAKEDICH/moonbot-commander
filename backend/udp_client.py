import socket
import asyncio
import hmac
import hashlib
import time
from typing import Optional, Tuple, List
from udp_pool import udp_socket_pool


class UDPClient:
    """UDP клиент для отправки команд и получения ответов"""
    
    def __init__(self, timeout: int = 5):
        self.timeout = timeout
    
    def generate_hmac(self, command: str, password: str) -> str:
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
    
    def send_command_sync(self, host: str, port: int, command: str, timeout: Optional[int] = None, password: Optional[str] = None, bind_port: Optional[int] = None) -> Tuple[bool, str]:
        """
        Синхронная версия отправки команды через UDP (для scheduler)
        Использует connection pool для оптимизации
        
        Args:
            host: IP адрес или хост
            port: UDP порт
            command: Команда для отправки
            timeout: Таймаут ожидания ответа в секундах
            password: Пароль для HMAC-SHA256 (если установлен в MoonBot)
            bind_port: Локальный порт для привязки (для совместимости с listener)
            
        Returns:
            Tuple[bool, str]: (успешность, ответ или сообщение об ошибке)
        """
        if timeout is None:
            timeout = self.timeout
        
        sock = None
        use_pool = bind_port is not None
        
        try:
            # Используем пул если указан bind_port
            if use_pool:
                sock = udp_socket_pool.get_socket(bind_port, timeout)
            else:
                # Для одноразовых запросов создаём временный сокет
                sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                sock.settimeout(timeout)
            
            # Формируем сообщение с HMAC если есть пароль
            if password:
                hmac_hash = self.generate_hmac(command, password)
                message = f"{hmac_hash} {command}"
            else:
                message = command
            
            # Кодируем команду в UTF-8
            encoded_message = message.encode('utf-8')
            
            # Отправляем команду
            sock.sendto(encoded_message, (host, port))
            
            # Получаем ответ
            try:
                data, _ = sock.recvfrom(204800)  # Буфер 200KB
                response = data.decode('utf-8')
                
                # Возвращаем сокет в пул или закрываем
                if use_pool:
                    udp_socket_pool.return_socket(bind_port)
                else:
                    sock.close()
                
                return True, response
            except socket.timeout:
                if use_pool:
                    udp_socket_pool.return_socket(bind_port)
                else:
                    sock.close()
                return False, "Timeout: не получен ответ от сервера"
            
        except socket.gaierror:
            if sock and not use_pool:
                sock.close()
            return False, f"Ошибка: Не удалось разрешить имя хоста '{host}'"
        except ConnectionRefusedError:
            if sock and not use_pool:
                sock.close()
            return False, f"Ошибка: Соединение отклонено {host}:{port}"
        except Exception as e:
            if sock and not use_pool:
                sock.close()
            return False, f"Ошибка: {str(e)}"
    
    async def send_command(self, host: str, port: int, command: str, timeout: Optional[int] = None, password: Optional[str] = None, bind_port: Optional[int] = None) -> Tuple[bool, str]:
        """
        Отправка команды через UDP и получение ответа (ОДИН пакет, быстро)
        
        Args:
            host: IP адрес или хост
            port: UDP порт
            command: Команда для отправки
            timeout: Таймаут ожидания ответа в секундах
            password: Пароль для HMAC-SHA256 (если установлен в MoonBot)
            bind_port: Локальный порт для привязки (для совместимости с listener)
            
        Returns:
            Tuple[bool, str]: (успешность, ответ или сообщение об ошибке)
        """
        if timeout is None:
            timeout = self.timeout
        
        try:
            # Создаем UDP сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(timeout)
            
            # Если указан bind_port, привязываемся к нему
            if bind_port:
                sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                sock.bind(("", bind_port))
            
            # Формируем сообщение с HMAC если есть пароль
            if password:
                hmac_hash = self.generate_hmac(command, password)
                message = f"{hmac_hash} {command}"
            else:
                message = command
            
            # Кодируем команду в UTF-8
            encoded_message = message.encode('utf-8')
            
            # Отправляем команду
            sock.sendto(encoded_message, (host, port))
            
            # Получаем ответ (SQL отчеты от MoonBot могут быть большими)
            try:
                data, _ = sock.recvfrom(204800)  # Буфер 200KB для больших SQL отчетов
                response = data.decode('utf-8')
                sock.close()
                return True, response
            except socket.timeout:
                sock.close()
                return False, "Timeout: не получен ответ от сервера"
            
        except socket.gaierror as e:
            return False, f"Ошибка DNS: {str(e)}"
        except ConnectionRefusedError:
            return False, "Соединение отклонено: проверьте адрес и порт сервера"
        except OSError as e:
            return False, f"Сетевая ошибка: {str(e)}"
        except Exception as e:
            return False, f"Неизвестная ошибка: {str(e)}"
    
    async def send_command_multi_response(
        self, 
        host: str, 
        port: int, 
        command: str, 
        timeout: Optional[int] = None, 
        password: Optional[str] = None,
        packet_timeout: float = 1.0
    ) -> Tuple[bool, str]:
        """
        Отправка команды через UDP и получение ВСЕХ пакетов ответа.
        
        Используется для команд типа:
        - report (большие SQL отчеты)
        - SQLSelect (многопакетные ответы)
        - list (полный список ордеров)
        
        Args:
            host: IP адрес или хост
            port: UDP порт
            command: Команда для отправки
            timeout: Общий таймаут в секундах (по умолчанию self.timeout)
            password: Пароль для HMAC-SHA256
            packet_timeout: Timeout между пакетами в секундах (по умолчанию 1.0)
                           Если пауза между пакетами > packet_timeout, считаем что все получили
            
        Returns:
            Tuple[bool, str]: (успешность, все ответы объединенные через \n)
        """
        if timeout is None:
            timeout = self.timeout
        
        try:
            # Создаем UDP сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(packet_timeout)  # Timeout между пакетами
            
            # Формируем сообщение с HMAC если есть пароль
            if password:
                hmac_hash = self.generate_hmac(command, password)
                message = f"{hmac_hash} {command}"
            else:
                message = command
            
            # Кодируем команду в UTF-8
            encoded_message = message.encode('utf-8')
            
            # Отправляем команду
            sock.sendto(encoded_message, (host, port))
            
            responses = []
            start_time = time.time()
            
            # Собираем все пакеты пока не истечет общий timeout
            while time.time() - start_time < timeout:
                try:
                    data, _ = sock.recvfrom(204800)  # Буфер 200KB
                    response = data.decode('utf-8', errors='replace')
                    responses.append(response)
                    
                except socket.timeout:
                    # Если пауза между пакетами > packet_timeout - считаем что все получили
                    if responses:
                        break
                    # Если еще не получили ни одного пакета - продолжаем ждать
                    if time.time() - start_time >= timeout:
                        break
                    continue
            
            sock.close()
            
            if responses:
                # Объединяем все пакеты через перенос строки
                full_response = "\n".join(responses)
                return True, full_response
            else:
                return False, "Timeout: не получен ответ от сервера"
            
        except socket.gaierror as e:
            return False, f"Ошибка DNS: {str(e)}"
        except ConnectionRefusedError:
            return False, "Соединение отклонено: проверьте адрес и порт сервера"
        except OSError as e:
            return False, f"Сетевая ошибка: {str(e)}"
        except Exception as e:
            return False, f"Неизвестная ошибка: {str(e)}"
    
    def send_command_multi_response_sync(
        self, 
        host: str, 
        port: int, 
        command: str, 
        timeout: Optional[int] = None, 
        password: Optional[str] = None,
        packet_timeout: float = 1.0
    ) -> Tuple[bool, str]:
        """
        Синхронная версия send_command_multi_response (для scheduler и listener)
        
        Args:
            host: IP адрес или хост
            port: UDP порт
            command: Команда для отправки
            timeout: Общий таймаут в секундах
            password: Пароль для HMAC-SHA256
            packet_timeout: Timeout между пакетами в секундах
            
        Returns:
            Tuple[bool, str]: (успешность, все ответы объединенные через \n)
        """
        if timeout is None:
            timeout = self.timeout
        
        try:
            # Создаем UDP сокет
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(packet_timeout)
            
            # Формируем сообщение с HMAC если есть пароль
            if password:
                hmac_hash = self.generate_hmac(command, password)
                message = f"{hmac_hash} {command}"
            else:
                message = command
            
            # Кодируем команду в UTF-8
            encoded_message = message.encode('utf-8')
            
            # Отправляем команду
            sock.sendto(encoded_message, (host, port))
            
            responses = []
            start_time = time.time()
            
            # Собираем все пакеты
            while time.time() - start_time < timeout:
                try:
                    data, _ = sock.recvfrom(204800)
                    response = data.decode('utf-8', errors='replace')
                    responses.append(response)
                    
                except socket.timeout:
                    if responses:
                        break
                    if time.time() - start_time >= timeout:
                        break
                    continue
            
            sock.close()
            
            if responses:
                full_response = "\n".join(responses)
                return True, full_response
            else:
                return False, "Timeout: не получен ответ от сервера"
            
        except socket.gaierror:
            return False, f"Ошибка: Не удалось разрешить имя хоста '{host}'"
        except ConnectionRefusedError:
            return False, f"Ошибка: Соединение отклонено {host}:{port}"
        except Exception as e:
            return False, f"Ошибка: {str(e)}"


async def test_connection(host: str, port: int, password: Optional[str] = None, bind_port: Optional[int] = None) -> bool:
    """
    Тестирование соединения с сервером
    
    Args:
        host: IP адрес или хост
        port: UDP порт
        password: Пароль для HMAC-SHA256
        bind_port: Локальный порт для привязки (для совместимости с listener)
        
    Returns:
        bool: True если сервер доступен
    """
    client = UDPClient(timeout=5)
    success, _ = await client.send_command(host, port, "lst", timeout=5, password=password, bind_port=bind_port)
    return success



