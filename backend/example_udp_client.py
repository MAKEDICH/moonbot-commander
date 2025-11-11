"""
Пример использования UDP клиента для отправки команд в MoonBot

Этот скрипт демонстрирует базовое использование UDP протокола
для взаимодействия с MoonBot терминалом.
"""

import socket
import sys


def send_udp_command(host: str, port: int, command: str, timeout: int = 5) -> tuple:
    """
    Отправить команду через UDP и получить ответ
    
    Args:
        host: IP адрес или хост
        port: UDP порт
        command: Команда для отправки
        timeout: Таймаут ожидания в секундах
        
    Returns:
        tuple: (успешность: bool, ответ: str)
    """
    try:
        # Создаем UDP сокет
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(timeout)
        
        # Кодируем команду в UTF-8
        message = command.encode('utf-8')
        
        print(f"Отправка команды: {command}")
        print(f"Адрес: {host}:{port}")
        
        # Отправляем команду
        sock.sendto(message, (host, port))
        
        # Получаем ответ
        try:
            data, server_addr = sock.recvfrom(4096)  # Буфер 4KB
            response = data.decode('utf-8')
            sock.close()
            
            print(f"✓ Ответ получен от {server_addr}")
            return True, response
            
        except socket.timeout:
            sock.close()
            print("✗ Timeout: не получен ответ от сервера")
            return False, "Timeout"
            
    except socket.gaierror as e:
        print(f"✗ Ошибка DNS: {e}")
        return False, f"DNS Error: {e}"
        
    except ConnectionRefusedError:
        print("✗ Соединение отклонено")
        return False, "Connection refused"
        
    except Exception as e:
        print(f"✗ Ошибка: {e}")
        return False, str(e)


def main():
    """Главная функция с примерами использования"""
    
    # Настройки подключения
    HOST = '127.0.0.1'  # IP адрес MoonBot сервера
    PORT = 5005         # UDP порт из настроек MoonBot
    
    print("=" * 60)
    print("MoonBot UDP Client - Пример использования")
    print("=" * 60)
    print()
    
    # Пример 1: Получить список активных ордеров
    print("Пример 1: Получение списка ордеров")
    print("-" * 60)
    success, response = send_udp_command(HOST, PORT, "list")
    if success:
        print(f"Ответ:\n{response}")
    print()
    
    # Пример 2: Проверка статуса бота
    print("Пример 2: Команда STOP")
    print("-" * 60)
    success, response = send_udp_command(HOST, PORT, "STOP")
    if success:
        print(f"Ответ:\n{response}")
    print()
    
    # Пример 3: Интерактивный режим
    print("Пример 3: Интерактивный режим")
    print("-" * 60)
    print("Введите команды для отправки (или 'exit' для выхода):")
    print()
    
    while True:
        try:
            command = input("Команда> ").strip()
            
            if command.lower() in ['exit', 'quit', 'q']:
                print("Выход...")
                break
            
            if not command:
                continue
            
            success, response = send_udp_command(HOST, PORT, command)
            if success:
                print(f"\nОтвет:\n{response}\n")
            else:
                print(f"\nОшибка: {response}\n")
                
        except KeyboardInterrupt:
            print("\n\nПрервано пользователем")
            break
        except Exception as e:
            print(f"\nОшибка: {e}\n")


if __name__ == "__main__":
    main()










