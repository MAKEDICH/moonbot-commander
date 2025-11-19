"""
UDP Listener Service для постоянного прослушивания MoonBot

Этот модуль запускает отдельные потоки для каждого сервера,
которые непрерывно слушают UDP сообщения от MoonBot.

Основные функции:
- Постоянное прослушивание SQL команд
- Парсинг и сохранение в БД
- Управление жизненным циклом listeners
"""
import socket
import threading
import time
import re
import asyncio
import queue
from datetime import datetime, timedelta
from typing import Optional, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal
import models
import encryption
import udp_protocol
from logger_utils import log

# Глобальный словарь активных listeners
active_listeners: Dict[int, 'UDPListener'] = {}

# Глобальный UDP сокет для SERVER режима (один сокет для всех серверов)
global_udp_socket = None


class UDPListener:
    """
    UDP Listener для постоянного прослушивания одного сервера MoonBot
    
    Запускается в отдельном потоке и непрерывно слушает UDP порт.
    Получает SQL команды, парсит их и сохраняет в БД.
    """
    
    def __init__(
        self,
        server_id: int,
        host: str,
        port: int,
        password: Optional[str] = None,
        local_port: int = 0,
        keepalive_enabled: bool = True,
        global_socket: Optional['GlobalUDPSocket'] = None
    ):
        """
        Args:
            server_id: ID сервера в БД
            host: IP адрес MoonBot сервера
            port: UDP порт MoonBot
            password: Пароль для HMAC (расшифрованный)
            local_port: Локальный порт для привязки (0 = эфемерный)
            keepalive_enabled: Включен ли keep-alive
            global_socket: Глобальный сокет (для SERVER режима)
        """
        self.server_id = server_id
        self.host = host
        self.port = port
        self.password = password
        self.global_socket = global_socket
        
        # АВТООПРЕДЕЛЕНИЕ РЕЖИМА из переменной окружения
        import os
        moonbot_mode = os.environ.get('MOONBOT_MODE', '').lower().strip()
        
        if moonbot_mode == 'local':
            # ЛОКАЛКА: эфемерный порт + keep-alive обязательно
            self.local_port = 0  # Эфемерный порт (система выберет случайный)
            self.keepalive_enabled = True  # Keep-alive ОБЯЗАТЕЛЬНО
            self.use_global_socket = False
            log(f"[UDP-LISTENER-{self.server_id}] MODE: LOCAL (ephemeral port + keep-alive)")
        elif moonbot_mode == 'server':
            # СЕРВЕР: использует глобальный сокет + без keep-alive
            self.local_port = 0  # Не используется (используется глобальный сокет)
            self.keepalive_enabled = False  # Keep-alive ОТКЛЮЧЁН
            self.use_global_socket = True
            log(f"[UDP-LISTENER-{self.server_id}] [MODE]  MODE: SERVER (global socket, no keep-alive)")
        else:
            # АВТОМАТИЧЕСКИЙ РЕЖИМ (по параметрам)
            self.local_port = local_port
            self.keepalive_enabled = keepalive_enabled
            self.use_global_socket = False
            log(f"[UDP-LISTENER-{self.server_id}] MODE: AUTO (local_port={local_port}, keepalive={keepalive_enabled})")
        
        self.running = False
        self.sock = None
        self.thread = None
        self.messages_received = 0
        self.last_error = None
        
        # Queue для ответов на команды (чтобы не конфликтовать с основным циклом)
        self.command_response_queue = queue.Queue()
        self.waiting_for_response = False
        self.keepalive_timer = None  # Таймер для keep-alive
        self._initial_lst_pending = False  # Флаг для отслеживания initial lst
        
        # Буфер для сборки фрагментированных gzip-пакетов
        self.fragment_buffer = bytearray()
        self.last_fragment_time = 0
        self.fragment_timeout_ms = 50  # Если 50ms нет новых фрагментов - обрабатываем пакет
    
    def start(self):
        """Запустить listener в отдельном потоке"""
        if self.running:
            log(f"[UDP-LISTENER-{self.server_id}] Already running")
            return False
        
        self.running = True
        
        # В SERVER режиме не создаем свой поток - используем глобальный сокет
        if self.use_global_socket:
            # Обновляем статус в БД
            self._update_status(is_running=True, started_at=datetime.utcnow())
            
            log(f"[UDP-LISTENER-{self.server_id}] Started (using global socket) for {self.host}:{self.port}")
            return True
        
        # В LOCAL/AUTO режиме - создаем свой поток с собственным сокетом
        self.thread = threading.Thread(
            target=self._listen_loop,
            daemon=True,
            name=f"UDPListener-{self.server_id}"
        )
        self.thread.start()
        
        # Обновляем статус в БД
        self._update_status(is_running=True, started_at=datetime.utcnow())
        
        log(f"[UDP-LISTENER-{self.server_id}] Started for {self.host}:{self.port}")
        
        # Запускаем keep-alive (только если включено)
        # Первая "lst" отправляется из _listen_loop сразу после создания сокета
        if self.keepalive_enabled:
            self._start_keepalive()
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Keep-alive is ENABLED")
        else:
            log(f"[UDP-LISTENER-{self.server_id}] ⏸️  Keep-alive is DISABLED (server mode with fixed port)")
        
        return True
    
    def stop(self):
        """Остановить listener"""
        if not self.running:
            return False
        
        self.running = False
        
        # Закрываем сокет (это прервет recvfrom)
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
        
        # Ждем завершения потока (max 5 секунд)
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        
        # Обновляем статус в БД
        self._update_status(is_running=False)
        
        log(f"[UDP-LISTENER-{self.server_id}] Stopped")
        return True
    
    def send_command(self, command: str):
        """
        Публичный метод для отправки команды через listener socket
        
        Args:
            command: Команда для отправки (например, 'lst', 'report', 'SQLSelect ...')
        """
        self._send_command_from_listener(command)
    
    def _listen_loop(self):
        """Основной цикл прослушивания (выполняется в отдельном потоке)"""
        try:
            # Создаем UDP сокет
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Используем local_port (уже определён в __init__ в зависимости от режима)
            # LOCAL: self.local_port = 0 (эфемерный)
            # SERVER: self.local_port = self.port (фиксированный)
            listen_port = self.local_port if self.local_port > 0 else 0
            
            try:
                self.sock.bind(("", listen_port))
            except OSError as e:
                if e.errno == 10048:  # Address already in use (Windows)
                    log(f"[UDP-LISTENER-{self.server_id}] [WARN]  Port {listen_port} already in use, using ephemeral port")
                    self.sock.bind(("", 0))  # Fallback на эфемерный
                else:
                    raise
            
            self.sock.settimeout(1.0)
            
            local_addr = self.sock.getsockname()
            if listen_port == 0:
                log(f"[UDP-LISTENER-{self.server_id}] [BIND] Listening on EPHEMERAL port {local_addr[1]}")
            else:
                log(f"[UDP-LISTENER-{self.server_id}] [BIND] Listening on FIXED port {local_addr[1]} (same as Moonbot)")
            log(f"[UDP-LISTENER-{self.server_id}] Will send commands to {self.host}:{self.port}")
            log(f"[UDP-LISTENER-{self.server_id}] Moonbot will reply to our port {local_addr[1]}")
            
            # ВАЖНО: Отправляем первую команду "lst" для установки UDP контакта с сервером
            # Это создаёт NAT mapping и позволяет Moonbot отправлять обновления
            try:
                time.sleep(0.5)  # Даём больше времени на инициализацию
                log(f"[UDP-LISTENER-{self.server_id}] 📡 Sending initial 'lst' to establish UDP connection...")
                
                # Устанавливаем флаг что это initial lst
                self._initial_lst_pending = True
                
                # Используем тот же метод, что и при отправке через API
                self._send_command_from_listener("lst")
                log(f"[UDP-LISTENER-{self.server_id}] [OK] Initial 'lst' sent to {self.host}:{self.port}")
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Error sending initial 'lst': {e}")
                import traceback
                traceback.print_exc()
            
            # СЛУШАЕМ НА ЭТОМ ЖЕ СОКЕТЕ
            while self.running:
                try:
                    # Получаем данные (блокирующий вызов с timeout)
                    data, addr_tuple = self.sock.recvfrom(204800)  # Буфер 200KB для больших SQL отчетов
                    addr = addr_tuple[0]  # IP адрес
                    port = addr_tuple[1]  # Порт
                    
                    # Обрабатываем RAW BYTES (без декодирования UTF-8)
                    # _process_message сам разберётся с gzip и декодированием
                    try:
                        self._process_message(data, addr, port)
                    except EOFError as e:
                        # Фрагментированный UDP пакет - игнорируем (Moonbot пришлёт полный пакет отдельно)
                        log(f"[UDP-LISTENER-{self.server_id}] [WARN] Incomplete UDP packet (fragmented), skipped")
                    except Exception as e:
                        log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Message processing error: {e}")
                        # НЕ падаем, продолжаем работу!
                    
                    # Увеличиваем счетчик
                    self.messages_received += 1
                    
                    # Обновляем статус в БД (каждые 10 сообщений)
                    if self.messages_received % 10 == 0:
                        try:
                            self._update_status(
                                messages_received=self.messages_received,
                                last_message_at=datetime.utcnow()
                            )
                        except Exception as e:
                            log(f"[UDP-LISTENER-{self.server_id}] Status update error: {e}")
                    
                except socket.timeout:
                    # Timeout - это нормально, продолжаем цикл
                    continue
                
                except Exception as e:
                    if self.running:  # Логируем только если не останавливаемся
                        log(f"[UDP-LISTENER-{self.server_id}] Receive error: {e}")
                        self.last_error = str(e)
                        time.sleep(1)  # Небольшая пауза перед retry
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Fatal error: {e}")
            self.last_error = str(e)
            self._update_status(is_running=False, last_error=str(e))
        
        finally:
            if self.sock:
                self.sock.close()
            log(f"[UDP-LISTENER-{self.server_id}] Loop ended")
    
    def _send_command_from_listener(self, command: str):
        """
        Отправка команды через сокет listener (как у ребят!)
        
        Args:
            command: Команда для отправки
        """
        try:
            import hmac
            import hashlib
            
            # В SERVER режиме используем глобальный сокет
            if self.use_global_socket and self.global_socket:
                success = self.global_socket.send_command(
                    command=command,
                    target_host=self.host,
                    target_port=self.port,
                    password=self.password
                )
                if success:
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] Command sent via global socket")
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Failed to send via global socket")
                return
            
            # В LOCAL/AUTO режиме используем свой сокет
            # Вычисляем HMAC если есть пароль
            if self.password:
                h = hmac.new(
                    self.password.encode('utf-8'),
                    command.encode('utf-8'),
                    hashlib.sha256
                )
                hmac_hex = h.hexdigest()
                payload = f"{hmac_hex} {command}"
                
                # ДИАГНОСТИКА: Логируем отправку (пароль замаскирован!)
                password_masked = f"{self.password[:4]}****{self.password[-4:]}" if len(self.password) > 8 else "****"
                log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending command from listener:")
                log(f"  Command: {command}")
                log(f"  Target: {self.host}:{self.port}")
                log(f"  Password: {password_masked}")
                log(f"  HMAC: {hmac_hex[:16]}...")
            else:
                payload = command
                log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending command (no password):")
                log(f"  Command: {command}")
                log(f"  Target: {self.host}:{self.port}")
            
            # Отправляем через listener сокет
            if self.sock:
                self.sock.sendto(
                    payload.encode('utf-8'),
                    (self.host, self.port)
                )
                log(f"[UDP-LISTENER-{self.server_id}] [OK] Command sent successfully")
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Failed to send command: {e}")
    
    def _send_follow_up_lst(self):
        """Отправляет follow-up lst для получения информации о валюте"""
        try:
            time.sleep(0.5)  # Небольшая задержка
            log(f"[UDP-LISTENER-{self.server_id}] 📊 Sending follow-up 'lst' to get currency info...")
            
            # Отправляем lst и ждём ответ
            success, response = self.send_command_with_response("lst", timeout=3.0)
            
            if success and response:
                log(f"[UDP-LISTENER-{self.server_id}] [OK] Follow-up response received: {response[:100]}...")
                # Обрабатываем ответ для извлечения валюты
                if "Open Sell Orders:" in response or "Open Buy Orders:" in response:
                    self._process_lst_response(response)
            else:
                log(f"[UDP-LISTENER-{self.server_id}] [WARN] No response to follow-up lst")
                
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Error in follow-up lst: {e}")
    
    def send_command(self, command: str):
        """
        Публичный метод для отправки команды через listener
        (для использования из API)
        """
        self._send_command_from_listener(command)
    
    def send_command_with_response(self, command: str, timeout: float = 3.0) -> tuple[bool, str]:
        """
        Отправка команды через listener socket и ожидание ответа через queue
        
        Args:
            command: Команда для отправки
            timeout: Таймаут ожидания ответа в секундах
            
        Returns:
            tuple[bool, str]: (успех, ответ от MoonBot)
        """
        try:
            import hmac
            import hashlib
            
            # Проверка сокета - в SERVER режиме проверяем глобальный, в LOCAL - свой
            if self.use_global_socket:
                if not self.global_socket:
                    return False, "Global socket не инициализирован"
                if not self.global_socket.running:
                    return False, "Global socket не запущен"
                if not self.global_socket.sock:
                    return False, "Global socket не создан"
            else:
                if not self.sock:
                    return False, "Listener socket не создан"
            
            # Очищаем старые ответы
            while not self.command_response_queue.empty():
                try:
                    self.command_response_queue.get_nowait()
                except queue.Empty:
                    break
            
            # Устанавливаем флаг что ждём ответ
            self.waiting_for_response = True
            
            # Вычисляем HMAC если есть пароль
            if self.password:
                h = hmac.new(
                    self.password.encode('utf-8'),
                    command.encode('utf-8'),
                    hashlib.sha256
                )
                hmac_hex = h.hexdigest()
                payload = f"{hmac_hex} {command}"
                
                password_masked = f"{self.password[:4]}****{self.password[-4:]}" if len(self.password) > 8 else "****"
                log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending command with response:")
                log(f"  Command: {command}")
                log(f"  Target: {self.host}:{self.port}")
                log(f"  Password: {password_masked}")
                log(f"  HMAC: {hmac_hex[:16]}...")
            else:
                payload = command
                log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending command with response (no password):")
                log(f"  Command: {command}")
                log(f"  Target: {self.host}:{self.port}")
            
            # Отправляем команду - через глобальный или свой сокет
            if self.use_global_socket and self.global_socket:
                self.global_socket.sock.sendto(
                    payload.encode('utf-8'),
                    (self.host, self.port)
                )
            else:
                self.sock.sendto(
                    payload.encode('utf-8'),
                    (self.host, self.port)
                )
            
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Command sent, waiting for response in queue...")
            
            # Ждём ответ из queue (listener положит его туда)
            try:
                response = self.command_response_queue.get(timeout=timeout)
                log(f"[UDP-LISTENER-{self.server_id}] 📥 Response received from queue: {response[:100]}...")
                
                # Проверяем на ошибки MoonBot
                if response.startswith('ERR'):
                    return False, response
                
                return True, response
                
            except queue.Empty:
                log(f"[UDP-LISTENER-{self.server_id}] ⏱️ Timeout waiting for response in queue")
                return False, "Timeout: не получен ответ от сервера"
            finally:
                self.waiting_for_response = False
                
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Failed to send command with response: {e}")
            self.waiting_for_response = False
            return False, f"Ошибка: {str(e)}"
    
    def _try_decompress_buffer(self, addr: str, port: int):
        """Попытка декомпрессировать собранные фрагменты"""
        import udp_protocol
        import gzip
        
        if not self.fragment_buffer:
            return False
        
        # МЕТОД 1: Пробуем декомпрессировать весь буфер целиком
        try:
            decompressed = gzip.decompress(bytes(self.fragment_buffer))
            decompressed_text = decompressed.decode('utf-8', errors='replace')
            
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Method 1: Successfully decompressed {len(self.fragment_buffer)} bytes -> {len(decompressed)} bytes")
            log(f"[UDP-LISTENER-{self.server_id}] 📄 First 200 chars: {decompressed_text[:200]}")
            
            # Пробуем распарсить как JSON
            import json
            try:
                payload = json.loads(decompressed_text)
                log(f"[UDP-LISTENER-{self.server_id}] 📋 JSON parsed, cmd={payload.get('cmd', 'unknown')}")
                
                # Обрабатываем как обычный пакет
                cmd = payload.get('cmd', '').lower()
                
                if cmd == "strats":
                    self._process_strategies_response(payload)
                elif cmd == "order":
                    self._process_order_update(payload)
                elif cmd == "acc":
                    self._process_balance_update(payload)
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] [WARN] Unknown command in reassembled packet: {cmd}")
                
                return True  # Успешно обработано!
                    
            except json.JSONDecodeError as e:
                log(f"[UDP-LISTENER-{self.server_id}] [WARN] Decompressed data is not JSON: {e}")
                log(f"[UDP-LISTENER-{self.server_id}] First 200 chars: {decompressed_text[:200]}")
                return False
                
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] [WARN] Method 1 failed: {e}")
        
        # МЕТОД 2: Ищем все GZIP-заголовки и декомпрессируем каждый блок
        log(f"[UDP-LISTENER-{self.server_id}] 🔍 Trying Method 2: Find GZIP headers...")
        gzip_starts = []
        for i in range(len(self.fragment_buffer) - 1):
            if self.fragment_buffer[i:i+2] == b'\x1f\x8b':
                gzip_starts.append(i)
        
        log(f"[UDP-LISTENER-{self.server_id}] [INFO] Found {len(gzip_starts)} GZIP headers at positions: {gzip_starts[:10]}...")
        
        # МЕТОД 4: Попробуем декомпрессировать ТОЛЬКО ПЕРВЫЙ блок для диагностики
        if len(gzip_starts) >= 1:
            log(f"[UDP-LISTENER-{self.server_id}] 🔍 Trying Method 4: Decompress FIRST block only (diagnostic)...")
            first_block = self.fragment_buffer[0:2048]
            
            # Попробуем zlib decompress (без GZIP wrapper)
            import zlib
            
            # Попытка 1: Стандартный GZIP
            try:
                decompressed = gzip.decompress(bytes(first_block))
                decompressed_text = decompressed.decode('utf-8', errors='replace')
                log(f"[UDP-LISTENER-{self.server_id}] [OK] GZIP: First block decompressed: {len(decompressed)} bytes")
                log(f"[UDP-LISTENER-{self.server_id}] 📄 Content: {decompressed_text[:200]}")
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] [ERROR] GZIP failed: {e}")
                
                # Попытка 2: Raw DEFLATE (без headers)
                try:
                    decompressed = zlib.decompress(bytes(first_block), -zlib.MAX_WBITS)
                    decompressed_text = decompressed.decode('utf-8', errors='replace')
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] DEFLATE: First block decompressed: {len(decompressed)} bytes")
                    log(f"[UDP-LISTENER-{self.server_id}] 📄 Content: {decompressed_text[:200]}")
                except Exception as e2:
                    log(f"[UDP-LISTENER-{self.server_id}] [ERROR] DEFLATE failed: {e2}")
                    
                    # Попытка 3: Raw data (без декомпрессии)
                    raw_text = first_block.decode('utf-8', errors='replace')
                    log(f"[UDP-LISTENER-{self.server_id}] 📄 RAW (first 200 bytes): {raw_text[:200]}")
        
        return False
    
    
    def _process_message(self, data: bytes, addr: str, port: int):
        """Обработка полученного сообщения с новым форматом"""
        import udp_protocol
        import time
        
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        
        # Проверяем источник
        if addr != self.host:
            log(f"[UDP-LISTENER-{self.server_id}] [WARN] WARNING: Wrong host {addr}")
            return
        
        # Декодируем пакет (поддержка gzip + JSON) - передаём RAW BYTES!
        packet = udp_protocol.decode_udp_packet(data)
        
        # СБОРКА ФРАГМЕНТОВ: Если ошибка декомпрессии (EOFError) - это фрагмент большого gzip
        if packet.decompress_error:
            current_time_ms = time.time() * 1000
            
            # ВАЖНО: Проверяем таймаут между пакетами (N=1, N=2, N=3...)
            # Если прошло >2 секунды с последнего фрагмента - это НОВЫЙ пакет (N+1)!
            if self.fragment_buffer and (current_time_ms - self.last_fragment_time) > 2000:
                log(f"[UDP-LISTENER-{self.server_id}] ⏱️ 2 second gap detected - processing previous pack...")
                success = self._try_decompress_buffer(addr, port)
                if success:
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] Pack N processed successfully!")
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Failed to process pack N")
                self.fragment_buffer = bytearray()
            
            # Добавляем RAW DATA (не декодированные байты) в буфер
            self.fragment_buffer.extend(data)
            self.last_fragment_time = current_time_ms
            
            log(f"[UDP-LISTENER-{self.server_id}] 🧩 Fragment #{len(self.fragment_buffer) // 2048}: {len(data)} bytes (buffer: {len(self.fragment_buffer)} bytes)")
            
            return  # Ждём следующих фрагментов или обычного пакета
        
        # Если есть накопленные фрагменты и пришёл обычный пакет - обрабатываем их!
        if self.fragment_buffer:
            log(f"[UDP-LISTENER-{self.server_id}] [BIND] End of fragment stream detected (got complete packet)")
            log(f"[UDP-LISTENER-{self.server_id}] 🔍 Attempting decompression of {len(self.fragment_buffer)} bytes...")
            success = self._try_decompress_buffer(addr, port)
            if not success:
                log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Failed to decompress buffer")
            else:
                log(f"[UDP-LISTENER-{self.server_id}] [OK] Strategy pack processed!")
            self.fragment_buffer = bytearray()
        
        if not packet.payload:
            # Старый формат без JSON - используем декодированный текст
            self._process_legacy_message(packet.raw_text, addr, port)
            return
        
        # Новый формат - JSON
        cmd = udp_protocol.get_packet_command(packet)
        
        log(f"[UDP-LISTENER-{self.server_id}] [OK] {timestamp} [{addr}:{port}] cmd={cmd}")
        
        if cmd == "order":
            self._process_order_update(packet.payload)
        elif cmd == "acc":
            self._process_balance_update(packet.payload)
        elif cmd == "strats":
            self._process_strategies_response(packet.payload)
        elif cmd == "replay":
            # Ответ на первую "lst" - просто логируем
            log(f"[UDP-LISTENER-{self.server_id}] 📡 Moonbot acknowledged connection (replay)")
            
            # Если это ответ на initial lst, нужно отправить ещё один lst для получения валюты
            is_initial_response = hasattr(self, '_initial_lst_pending') and self._initial_lst_pending
            if is_initial_response:
                self._initial_lst_pending = False
                # Отправляем второй lst для получения информации о валюте
                threading.Thread(
                    target=self._send_follow_up_lst,
                    daemon=True,
                    name=f"FollowUpLst-{self.server_id}"
                ).start()
            
            # Если кто-то ждёт ответ - отдаём
            if self.waiting_for_response:
                preferred_text = udp_protocol.extract_preferred_text(packet)
                self.command_response_queue.put(preferred_text)
        elif "sql" in packet.payload:
            self._process_sql_command(packet.payload.get("sql", ""))
        else:
            # Обычный ответ на команду
            if self.waiting_for_response:
                # Извлекаем только нужный текст (data поле) без служебной инфы
                preferred_text = udp_protocol.extract_preferred_text(packet)
                self.command_response_queue.put(preferred_text)
    
    def _process_legacy_message(self, message: str, addr: str, port: int):
        """Обработка сообщения в старом формате"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        
        # Проверяем источник сообщения - только IP
        if addr != self.host:
            log(f"[UDP-LISTENER-{self.server_id}] [WARN] WARNING: Received message from WRONG HOST!")
            log(f"[UDP-LISTENER-{self.server_id}]   Expected: {self.host}:{self.port}")
            log(f"[UDP-LISTENER-{self.server_id}]   Got from: {addr}:{port}")
            return
        
        # Если это бинарный мусор (фрагментированный gzip), не логируем подробно
        message_clean = message.strip()
        if not message_clean or (len(message_clean) > 0 and ord(message_clean[0]) < 32 and message_clean[0] not in '\n\r\t'):
            log(f"[UDP-LISTENER-{self.server_id}] [WARN] Skipped binary/fragmented data ({len(message)} bytes)")
            return
        
        # Логируем только читаемый текст
        log(f"[UDP-LISTENER-{self.server_id}] [OK] {timestamp} [{addr}:{port}] -> {message[:100]}...")
        
        # Если ждём ответ на команду - кладём в queue
        if self.waiting_for_response:
            log(f"[UDP-LISTENER-{self.server_id}] 📦 Putting response into queue for API")
            self.command_response_queue.put(message)
            # НЕ возвращаемся сразу - нужно обработать lst для обновления валюты!
            
            # Сбрасываем флаг если это ответ на lst с валютой
            if "Open Sell Orders:" in message or "Open Buy Orders:" in message:
                self.waiting_for_response = False
        
        # Проверяем это SQL команда?
        if "[SQLCommand" in message:
            self._process_sql_command(message)
        # Проверяем это ответ на lst команду?
        elif "Open Sell Orders:" in message or "Open Buy Orders:" in message:
            self._process_lst_response(message)
    
    def _process_order_update(self, packet: dict):
        """
        Обработка регулярного обновления ордера
        
        Формат: {"cmd":"order","bot":"BotName","oid":12345,"sql":"..."}
        """
        oid = packet.get("oid")  # MoonBot Order ID
        sql = packet.get("sql", "")
        bot_name = packet.get("bot", "")
        
        log(f"[UDP-LISTENER-{self.server_id}] 📦 Order update: oid={oid}, bot={bot_name}")
        
        if sql:
            self._process_sql_command(sql, moonbot_order_id=oid)
    
    def _process_balance_update(self, packet: dict):
        """
        Обработка регулярного обновления баланса (раз в 5 сек)
        
        Формат: {"cmd":"acc","bot":"BotName","data":"A:1234.56$,T:5678.90$"}
        Или:    {"cmd":"acc","bot":"BotName","A":1234.56,"T":5678.90}
        """
        bot_name = packet.get("bot", "")
        
        # Проверяем формат: строка в data или отдельные поля
        if "data" in packet:
            # Формат: "A:9590.09$,T:9590.09$"
            data_str = packet.get("data", "")
            available = 0.0
            total = 0.0
            
            # Парсим строку
            import re
            a_match = re.search(r'A:([\d.]+)', data_str)
            t_match = re.search(r'T:([\d.]+)', data_str)
            
            if a_match:
                available = float(a_match.group(1))
            if t_match:
                total = float(t_match.group(1))
        else:
            # Формат: отдельные поля A и T
            available = packet.get("A", 0.0)
            total = packet.get("T", 0.0)
        
        # Обновляем баланс в БД
        db = SessionLocal()
        try:
            # Создаём/обновляем запись баланса
            balance = db.query(models.ServerBalance).filter(
                models.ServerBalance.server_id == self.server_id
            ).first()
            
            if not balance:
                balance = models.ServerBalance(server_id=self.server_id)
                db.add(balance)
            
            balance.available = available
            balance.total = total
            balance.bot_name = bot_name
            balance.updated_at = datetime.now()
            
            db.commit()
            log(f"[UDP-LISTENER-{self.server_id}] 💰 Balance: Available={available:.2f}, Total={total:.2f}")
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Balance update error: {e}")
            db.rollback()
        finally:
            db.close()
    
    def _process_strategies_response(self, packet: dict):
        """
        Обработка ответа со стратегиями
        
        Формат: {"cmd":"strats","bot":"BotName","N":1,"data":"##Begin_Strategy..."}
        N = номер пакета (если стратегий много)
        data = строка со стратегиями в формате ##Begin_Strategy...##End_Strategy
        """
        pack_number = packet.get("N", 1)
        data = packet.get("data", "")
        bot_name = packet.get("bot", "")
        
        log(f"[UDP-LISTENER-{self.server_id}] 📋 Strategies pack #{pack_number} from {bot_name}")
        
        # Сохраняем в кэш/БД
        db = SessionLocal()
        try:
            # Создаём/обновляем запись стратегий
            strat_cache = db.query(models.StrategyCache).filter(
                models.StrategyCache.server_id == self.server_id,
                models.StrategyCache.pack_number == pack_number
            ).first()
            
            if not strat_cache:
                strat_cache = models.StrategyCache(
                    server_id=self.server_id,
                    pack_number=pack_number
                )
                db.add(strat_cache)
            
            strat_cache.data = data
            strat_cache.bot_name = bot_name
            strat_cache.received_at = datetime.utcnow()
            
            db.commit()
            log(f"[UDP-LISTENER-{self.server_id}] [OK] Strategies saved (pack {pack_number})")
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Strategies save error: {e}")
            db.rollback()
        finally:
            db.close()
    
    def _extract_currency(self, message: str) -> str:
        """
        Гениальное извлечение валюты из lst ответа
        
        Поддерживает любые валюты от 2 до 10 символов (только буквы).
        Примеры: USD, USDT, USDC, TRY, EUR, RUB, BTC, ETH, BNB, SOL, POLYGON и т.д.
        
        Приоритеты определения:
        1. Явное упоминание валюты рядом с числом (высший приоритет)
        2. Валюта в контексте баланса/доступных средств  
        3. Знак $ как индикатор USD-подобной валюты (но не сразу USDT!)
        4. Fallback на USDT только если ничего не найдено
        
        Примеры работы:
        - "Total: 2997.46$ Available USDC: 2903.4$" → "USDC" (явное упоминание)
        - "Total: 565285 TRY  Доступно TRY: 108.4k" → "TRY"
        - "Available: 8410.60$  Total: 8412.58$" → "USDT" (только $, нет явной валюты)
        - "Balance: 1000 BNB" → "BNB"
        
        Returns:
            Код валюты (TRY, USDC, USDT, BTC, ETH, etc.)
        """
        import re
        
        log(f"[UDP-LISTENER-{self.server_id}] 🔍 Analyzing currency from: {message[:100]}...")
        
        # Список исключений - слова, которые не являются валютами
        excluded_words = {
            'TOTAL', 'OPEN', 'SELL', 'BUY', 'ORDERS', 'AVAILABLE',
            'PRICE', 'AMOUNT', 'VOLUME', 'HIGH', 'LOW', 'CLOSE',
            'PROFIT', 'LOSS', 'BALANCE', 'MARGIN', 'EQUITY',
            'FREE', 'USED', 'LOCKED', 'PENDING', 'STATUS', 'SPOT'
        }
        
        # Известные стейблкоины и их приоритет при наличии $
        stablecoins = ['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'GUSD']
        
        # Собираем все найденные валюты с их позициями
        found_currencies = []
        
        # Паттерны для поиска валюты (упорядочены по приоритету)
        patterns = [
            # 1. Валюта непосредственно перед числом со знаком $ - высший приоритет
            (r'([A-Z]{2,10})[:：]?\s*[\d,\.]+\s*\$', 100),  # "USDC: 2903.4$" или "USDC 2903.4$"
            
            # 2. "Available/Доступно + валюта" - очень высокий приоритет
            (r'(?:Available|Доступно)\s+([A-Z]{2,10})[:：]', 90),  # "Available USDC:"
            
            # 3. Валюта после числа
            (r'[\d,\.]+\s+([A-Z]{2,10})(?:\s|$)', 80),  # "565285 TRY"
            
            # 4. Валюта перед числом  
            (r'([A-Z]{2,10})\s*[:：]\s*[\d,\.]+', 70),  # "TRY: 108.4k"
            
            # 5. Balance/Total с валютой
            (r'(?:Balance|Total|Баланс):\s*[\d,\.]+\s+([A-Z]{2,10})', 60),  # "Total: 1000 BTC"
            
            # 6. Изолированная валюта (может быть в заголовке)
            (r'\b([A-Z]{2,10})\b', 30),  # Любое слово из заглавных букв
        ]
        
        # Ищем все валюты
        for pattern, priority in patterns:
            for match in re.finditer(pattern, message, re.IGNORECASE | re.MULTILINE):
                currency = match.group(1).upper()
                
                # Пропускаем исключения
                if currency in excluded_words:
                    continue
                
                # Проверяем что это похоже на валюту
                if 2 <= len(currency) <= 10 and currency.isalpha():
                    position = match.start()
                    found_currencies.append((currency, priority, position))
                    log(f"[UDP-LISTENER-{self.server_id}] 💡 Found potential currency: {currency} (priority={priority}, pos={position})")
        
        # Специальная логика для $ без явной валюты
        has_dollar_sign = bool(re.search(r'\$', message))
        
        if found_currencies:
            # Сортируем по приоритету (больше = важнее), затем по позиции (раньше = важнее)
            found_currencies.sort(key=lambda x: (-x[1], x[2]))
            best_currency = found_currencies[0][0]
            
            # Если есть $ и найденная валюта не стейблкоин, проверяем наличие стейблкоинов
            if has_dollar_sign and best_currency not in stablecoins:
                stablecoin_found = next((c[0] for c in found_currencies if c[0] in stablecoins), None)
                if stablecoin_found:
                    log(f"[UDP-LISTENER-{self.server_id}] 💱 Detected stablecoin with $: {stablecoin_found}")
                    return stablecoin_found
            
            log(f"[UDP-LISTENER-{self.server_id}] 💱 Detected currency: {best_currency}")
            return best_currency
        
        # Если есть только $ без явной валюты - возвращаем USDT
        if has_dollar_sign:
            log(f"[UDP-LISTENER-{self.server_id}] 💱 Only $ sign found, defaulting to USDT")
            return 'USDT'
        
        # Default fallback
        log(f"[UDP-LISTENER-{self.server_id}] 💱 No currency detected, using default: USDT")
        return 'USDT'
    
    def _process_lst_response(self, message: str):
        """
        Обработка ответа на команду lst
        
        Парсит количество открытых ордеров и закрывает те, которых нет в MoonBot
        
        Формат ответа:
        Open Sell Orders: 1
        SOL  ( +0.52$ +104.8%)
        
        Available: 8410.60$  Total: 8412.58$
        """
        try:
            # Парсим количество открытых ордеров
            import re
            
            # 💱 АВТООПРЕДЕЛЕНИЕ ВАЛЮТЫ из lst
            currency = self._extract_currency(message)
            log(f"[UDP-LISTENER-{self.server_id}] 💱 Detected currency from lst: {currency}")
            
            total_open = 0
            
            # Ищем "Open Sell Orders: N"
            sell_match = re.search(r'Open Sell Orders:\s*(\d+)', message)
            if sell_match:
                total_open += int(sell_match.group(1))
            
            # Ищем "Open Buy Orders: N"
            buy_match = re.search(r'Open Buy Orders:\s*(\d+)', message)
            if buy_match:
                total_open += int(buy_match.group(1))
            
            log(f"[UDP-LISTENER-{self.server_id}] MoonBot reports {total_open} open orders")
            
            # Парсим символы открытых ордеров
            # Формат: "BTC  ( +0.52$ +104.8%)" или "SOL  ( -0.79$ -58.5%)"
            symbols_found = []
            lines = message.split('\n')
            for line in lines:
                # Ищем строки с символами (содержат "$" и "%")
                if '$' in line and '%' in line and '(' in line:
                    # Извлекаем символ (первое слово в строке)
                    parts = line.strip().split()
                    if parts:
                        symbol = parts[0].strip()
                        # Проверяем что это похоже на символ (2-10 букв)
                        if 2 <= len(symbol) <= 10 and symbol.isalpha():
                            symbols_found.append(symbol.upper())
                            log(f"[UDP-LISTENER-{self.server_id}]   Found symbol: {symbol.upper()}")
            
            # Проверяем сколько у нас открытых в БД
            db = SessionLocal()
            try:
                our_open_count = db.query(models.MoonBotOrder).filter(
                    models.MoonBotOrder.server_id == self.server_id,
                    models.MoonBotOrder.status == "Open"
                ).count()
                
                log(f"[UDP-LISTENER-{self.server_id}] Our DB has {our_open_count} open orders")
                
                # Обновляем символы для открытых ордеров с UNKNOWN или NULL
                if symbols_found:
                    from sqlalchemy import or_
                    unknown_orders = db.query(models.MoonBotOrder).filter(
                        models.MoonBotOrder.server_id == self.server_id,
                        models.MoonBotOrder.status == "Open",
                        or_(
                            models.MoonBotOrder.symbol == "UNKNOWN",
                            models.MoonBotOrder.symbol == None,
                            models.MoonBotOrder.symbol == ""
                        )
                    ).order_by(models.MoonBotOrder.id.desc()).limit(len(symbols_found)).all()
                    
                    for i, order in enumerate(unknown_orders):
                        if i < len(symbols_found):
                            order.symbol = symbols_found[i]
                            log(f"[UDP-LISTENER-{self.server_id}]   Updated order #{order.moonbot_order_id} symbol to {symbols_found[i]}")
                    
                    db.commit()
                
                # 💱 Обновляем валюту сервера
                server = db.query(models.Server).filter(
                    models.Server.id == self.server_id
                ).first()
                
                if server:
                    if server.default_currency != currency:
                        log(f"[UDP-LISTENER-{self.server_id}] 💱 Updating server currency from {server.default_currency} to {currency}")
                        server.default_currency = currency
                        db.commit()
                        log(f"[UDP-LISTENER-{self.server_id}] 💱 Server currency updated: {currency}")
                    else:
                        log(f"[UDP-LISTENER-{self.server_id}] 💱 Server currency already set to: {currency}")
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] ❌ Server not found in DB!")
                
                # Если у нас больше открытых чем у MoonBot - закрываем старые
                if our_open_count > total_open:
                    excess = our_open_count - total_open
                    log(f"[UDP-LISTENER-{self.server_id}] Closing {excess} excess orders...")
                    
                    # Находим самые старые открытые ордера (которые давно не обновлялись)
                    old_orders = db.query(models.MoonBotOrder).filter(
                        models.MoonBotOrder.server_id == self.server_id,
                        models.MoonBotOrder.status == "Open"
                    ).order_by(models.MoonBotOrder.updated_at.asc()).limit(excess).all()
                    
                    for order in old_orders:
                        order.status = "Closed"
                        order.closed_at = datetime.utcnow()
                        order.updated_at = datetime.now()
                        log(f"[UDP-LISTENER-{self.server_id}]   - Closed order #{order.moonbot_order_id} (last update: {order.updated_at})")
                    
                    db.commit()
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] Closed {excess} orders")
                
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] Error processing lst response: {e}")
                db.rollback()
            finally:
                db.close()
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Error parsing lst response: {e}")
    
    def _process_sql_command(self, sql_text: str, moonbot_order_id: int = None):
        """
        Парсинг и сохранение SQL команды в БД
        
        Формат: [SQLCommand 86516] update Orders set CloseDate=0, SellPrice=0.52135...
        Или просто: update Orders set CloseDate=0, SellPrice=0.52135...
        
        Args:
            sql_text: Полный текст SQL команды
            moonbot_order_id: ID ордера из пакета order (oid)
        """
        try:
            # Извлекаем ID команды (если есть)
            match = re.search(r'\[SQLCommand (\d+)\]', sql_text)
            if match:
                command_id = int(match.group(1))
                sql_body = sql_text[match.end():].strip()
                log(f"[UDP-LISTENER-{self.server_id}] [SQL] SQL [{command_id}]: {sql_body[:100]}...")
            else:
                # Нет ID - сохраняем как есть с автоинкрементным ID
                command_id = 0
                sql_body = sql_text.strip()
                log(f"[UDP-LISTENER-{self.server_id}] [SQL] SQL (no ID): {sql_body[:100]}...")
            
            # Сохраняем в БД
            db = SessionLocal()
            try:
                # Создаем запись в логе
                sql_log = models.SQLCommandLog(
                    server_id=self.server_id,
                    command_id=command_id,
                    sql_text=sql_body,
                    received_at=datetime.now(),
                    processed=False
                )
                db.add(sql_log)
                
                # Получаем user_id сервера для WebSocket уведомления
                server = db.query(models.Server).filter(models.Server.id == self.server_id).first()
                user_id = server.user_id if server else None
                
                # Пытаемся распарсить и обработать Orders
                if "Orders" in sql_body:
                    self._parse_and_save_order(db, sql_body, command_id, moonbot_order_id)
                
                db.commit()
                
                # Отправляем WebSocket уведомления (thread-safe)
                if user_id:
                    from websocket_manager import notify_sql_log_sync, notify_order_update_sync
                    
                    log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending WebSocket notification to user_id={user_id}")
                    
                    # Формируем данные для SQL лога
                    log_data = {
                        "id": sql_log.id,
                        "server_id": sql_log.server_id,
                        "command_id": sql_log.command_id,
                        "sql_text": sql_log.sql_text[:500],
                        "received_at": sql_log.received_at.isoformat() if sql_log.received_at else None,
                        "processed": sql_log.processed
                    }
                    
                    # Отправляем уведомление о SQL логе
                    notify_sql_log_sync(user_id, self.server_id, log_data)
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] SQL log notification sent")
                    
                    # Если это ордер - отправляем дополнительное уведомление
                    if "Orders" in sql_body:
                        notify_order_update_sync(user_id, self.server_id)
                        log(f"[UDP-LISTENER-{self.server_id}] [OK] Order update notification sent")
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] [WARN] No user_id found, cannot send WebSocket notification")
                
            except Exception as e:
                log(f"[UDP-LISTENER-{self.server_id}] DB Error: {e}")
                import traceback
                traceback.print_exc()
                db.rollback()
            finally:
                db.close()
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Parse error: {e}")
            import traceback
            traceback.print_exc()
    
    def _parse_and_save_order(self, db: Session, sql: str, command_id: int, moonbot_order_id: int = None):
        """
        Парсинг SQL команды для таблицы Orders и сохранение в moonbot_orders
        
        Args:
            db: Database session
            sql: SQL команда
            command_id: ID из [SQLCommand XXX] (может быть 0)
            moonbot_order_id: ID ордера из пакета order (oid) - приоритетный
        
        Примеры SQL:
        - update Orders set CloseDate=0, SellPrice=0.52135, GainedBTC=0, SpentBTC=3.12...
        - insert into Orders (Symbol, BuyPrice, ...) values ('BTC', 0.0001, ...)
        
        Args:
            db: Database session
            sql: SQL команда
            command_id: ID из [SQLCommand XXX] (может быть 0)
            moonbot_order_id: ID ордера из пакета order (oid) - приоритетный
        """
        try:
            # Определяем тип команды
            sql_lower = sql.lower()
            
            if sql_lower.startswith('update orders'):
                self._parse_update_order(db, sql, moonbot_order_id)
            elif sql_lower.startswith('insert into orders'):
                self._parse_insert_order(db, sql, command_id, moonbot_order_id)
            else:
                # Другие команды (delete, select...) пока не обрабатываем
                pass
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Order parse error: {e}")
    
    def _parse_update_order(self, db: Session, sql: str, moonbot_order_id: int = None):
        """
        Парсинг UPDATE Orders команды
        
        Формат: update Orders set CloseDate=0, SellPrice=0.52135, ... WHERE [ID]=86516
        
        Важно: в WHERE может быть [ID]=число - это и есть moonbot_order_id!
        """
        try:
            # Ищем ID=число в WHERE clause (может быть как ID, так и [ID])
            id_match = re.search(r'\[?ID\]?\s*=\s*(\d+)', sql, re.IGNORECASE)
            if not id_match:
                # Если нет ID, возможно это обновление по другому условию
                log(f"[UDP-LISTENER-{self.server_id}] UPDATE без ID: {sql[:100]}")
                return
            
            moonbot_order_id = int(id_match.group(1))
            
            # Парсим SET clause (упрощенный парсер)
            set_match = re.search(r'set\s+(.+?)\s+where', sql, re.IGNORECASE | re.DOTALL)
            if not set_match:
                return
            
            set_clause = set_match.group(1)
            
            # Извлекаем поля с учетом кавычек (правильный парсер)
            updates = {}
            current_key = ""
            current_value = ""
            in_quotes = False
            escape_next = False
            state = "key"  # key | value
            
            for i, char in enumerate(set_clause):
                if escape_next:
                    current_value += char
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    current_value += char
                    continue
                
                if char == "'":
                    in_quotes = not in_quotes
                    continue
                
                if state == "key":
                    if char == '=':
                        state = "value"
                    elif char not in [' ', '\n', '\t']:
                        current_key += char
                elif state == "value":
                    if char == ',' and not in_quotes:
                        # Конец пары key=value
                        key = current_key.strip().strip('[]')
                        value = current_value.strip()
                        if key:
                            updates[key] = value
                        current_key = ""
                        current_value = ""
                        state = "key"
                    else:
                        current_value += char
            
            # Добавляем последнюю пару
            if current_key:
                key = current_key.strip().strip('[]')
                value = current_value.strip()
                if key:
                    updates[key] = value
            
            # Находим или создаем ордер
            order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()
            
            if not order:
                # UPDATE пришел раньше INSERT или с другим ID
                # 🧠 ГЕНИАЛЬНОЕ РЕШЕНИЕ: Fingerprint Matching!
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ UPDATE для несуществующего ордера ID={moonbot_order_id}")
                log(f"[UDP-LISTENER-{self.server_id}] 🔍 Применяем FINGERPRINT MATCHING...")
                
                # Извлекаем ключевые данные из UPDATE
                quantity = self._safe_float(updates.get('Quantity'))
                spent_btc = self._safe_float(updates.get('SpentBTC'))
                gained_btc = self._safe_float(updates.get('GainedBTC'))
                
                if quantity:
                    # Ищем недавние ордера с похожим quantity
                    time_threshold = datetime.now() - timedelta(seconds=120)  # 2 минуты
                    
                    candidates = db.query(models.MoonBotOrder)\
                        .filter(models.MoonBotOrder.server_id == self.server_id)\
                        .filter(models.MoonBotOrder.created_at >= time_threshold)\
                        .filter(
                            func.abs(models.MoonBotOrder.quantity - quantity) < 1.0  # погрешность < 1
                        )\
                        .order_by(models.MoonBotOrder.created_at.desc())\
                        .all()
                    
                    log(f"[UDP-LISTENER-{self.server_id}] 📊 Найдено {len(candidates)} кандидатов с quantity ≈ {quantity}")
                    
                    # Уточняем поиск по SpentBTC если есть
                    best_match = None
                    if spent_btc and candidates:
                        for candidate in candidates:
                            if candidate.spent_btc and abs(candidate.spent_btc - spent_btc) < 1.0:
                                best_match = candidate
                                break
                    
                    # Или просто берем первого кандидата
                    if not best_match and candidates:
                        best_match = candidates[0]
                    
                    if best_match:
                        log(f"[UDP-LISTENER-{self.server_id}] ✅ НАЙДЕН ордер по fingerprint!")
                        log(f"[UDP-LISTENER-{self.server_id}]    Symbol: {best_match.symbol}")
                        log(f"[UDP-LISTENER-{self.server_id}]    Original ID: {best_match.moonbot_order_id}")
                        log(f"[UDP-LISTENER-{self.server_id}]    New ID: {moonbot_order_id}")
                        
                        # Обновляем moonbot_order_id на правильный
                        best_match.moonbot_order_id = moonbot_order_id
                        order = best_match
                        
                        # Теперь продолжаем обновление найденного ордера
                    else:
                        log(f"[UDP-LISTENER-{self.server_id}] ❌ Не найдено подходящих ордеров")
                        log(f"[UDP-LISTENER-{self.server_id}] ⏭️ Пропускаем UPDATE")
                        return
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] ❌ Нет Quantity для fingerprint matching")
                    log(f"[UDP-LISTENER-{self.server_id}] ⏭️ Пропускаем UPDATE")
                    return
            
            # Обновляем поля (все доступные из UPDATE)
            field_mapping = {
                'Coin': ('symbol', str),
                'Symbol': ('symbol', str),
                'BuyPrice': ('buy_price', float),
                'SellPrice': ('sell_price', float),
                'Quantity': ('quantity', float),
                'SpentBTC': ('spent_btc', float),
                'GainedBTC': ('gained_btc', float),
                'ProfitBTC': ('profit_btc', float),
                'SellReason': ('sell_reason', str),
                'Strategy': ('strategy', str),
                # Новые расширенные поля
                'SignalType': ('signal_type', str),
                'BaseCurrency': ('base_currency', str),
                'BoughtSO': ('bought_so', int),
                'Emulator': ('is_emulator', bool),
                'BTCInDelta': ('btc_in_delta', float),
                'Exchange1hDelta': ('exchange_1h_delta', float),
                'Exchange24hDelta': ('exchange_24h_delta', float),
                'Latency': ('latency', int),
                'TaskID': ('task_id', int),
            }
            
            # Применяем все найденные поля
            for sql_field, (model_field, field_type) in field_mapping.items():
                if sql_field in updates:
                    try:
                        if field_type == float:
                            value = self._safe_float(updates[sql_field])
                        elif field_type == int:
                            value = self._safe_int(updates[sql_field])
                        elif field_type == bool:
                            value = bool(self._safe_int(updates[sql_field]))
                        else:
                            value = updates[sql_field]
                        
                        if value is not None:
                            setattr(order, model_field, value)
                    except Exception as e:
                        log(f"[UDP-LISTENER-{self.server_id}] Error setting {model_field}: {e}")
            
            # Обрабатываем Lev как Leverage (если нет Quantity)
            if 'Lev' in updates and not order.quantity:
                order.quantity = self._safe_float(updates['Lev'])
            
            # Вычисляем GainedBTC если известно
            if order.profit_btc is not None and order.spent_btc:
                if order.gained_btc == 0 or order.gained_btc is None:
                    # GainedBTC = SpentBTC + ProfitBTC (всё в USDT!)
                    order.gained_btc = order.spent_btc + order.profit_btc
            
            # Вычисляем BuyPrice если неизвестен
            if not order.buy_price and order.spent_btc and order.quantity and order.quantity > 0:
                # BuyPrice = SpentBTC / Quantity
                order.buy_price = order.spent_btc / order.quantity
            
            # ВСЕГДА пересчитываем Profit % при каждом UPDATE (так как ProfitBTC меняется!)
            if order.profit_btc is not None and order.spent_btc and order.spent_btc > 0:
                # Profit % = (ProfitBTC / SpentBTC) * 100
                order.profit_percent = (order.profit_btc / order.spent_btc) * 100
            
            # Обработка CloseDate отдельно
            if 'CloseDate' in updates:
                close_date = self._safe_int(updates['CloseDate'])
                if close_date == 0:
                    order.status = "Open"
                    order.closed_at = None
                    if not order.opened_at:
                        order.opened_at = datetime.now()
                elif close_date > 0:
                    # 🎯 ГЕНИАЛЬНОЕ РЕШЕНИЕ: Проверяем ВСЕ признаки закрытия ордера
                    #
                    # ПРОБЛЕМА: CloseDate может быть в будущем из-за:
                    # - Разницы часовых поясов между MoonBot и Commander
                    # - Рассинхронизации часов серверов  
                    # - MoonBot использует UTC, Commander - локальное время
                    #
                    # РЕШЕНИЕ: Смотрим на СОВОКУПНОСТЬ признаков закрытия:
                    # 1. SellReason присутствует ("Manual Sell", "Stop Loss", etc.)
                    # 2. SellPrice > 0 (цена продажи установлена)
                    # 3. ProfitBTC рассчитан (финальная прибыль)
                    #
                    # Если ВСЕ признаки есть - ордер ТОЧНО закрыт, даже если дата в будущем!
                    
                    has_sell_reason = order.sell_reason and len(order.sell_reason.strip()) > 0
                    has_sell_price = order.sell_price and order.sell_price > 0
                    has_profit_calculated = order.profit_btc is not None
                    
                    # Проверяем дату
                    current_timestamp = int(datetime.now().timestamp())
                    is_date_in_future = close_date > current_timestamp
                    
                    # ЛОГИКА ОПРЕДЕЛЕНИЯ СТАТУСА:
                    # - Если дата в прошлом → Closed (классический случай)
                    # - Если дата в будущем, НО есть все признаки закрытия → Closed (умное определение)
                    # - Если дата в будущем и нет признаков → Open (планируемое закрытие)
                    
                    if not is_date_in_future:
                        # Классический случай: дата в прошлом - ордер закрыт
                        order.status = "Closed"
                        try:
                            order.closed_at = datetime.utcfromtimestamp(close_date)
                        except (ValueError, OSError, OverflowError) as e:
                            log(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid CloseDate={close_date}, Error: {e}")
                            order.closed_at = datetime.now()
                        log(f"[UDP-LISTENER-{self.server_id}] ✅ Order {order.moonbot_order_id} marked as Closed (CloseDate in past)")
                    
                    elif has_sell_reason and has_sell_price and has_profit_calculated:
                        # 🎯 ГЕНИАЛЬНЫЙ СЛУЧАЙ: Дата в будущем, НО есть все признаки закрытия!
                        # Это значит ордер УЖЕ закрыт, просто часы рассинхронизированы
                        order.status = "Closed"
                        try:
                            # Используем CloseDate несмотря на то, что в будущем
                            # (это timestamp от MoonBot, которому мы доверяем больше)
                            order.closed_at = datetime.utcfromtimestamp(close_date)
                        except (ValueError, OSError, OverflowError) as e:
                            # Если не можем распарсить, берём текущее время
                            order.closed_at = datetime.now()
                        
                        log(f"[UDP-LISTENER-{self.server_id}] ✅ Order {order.moonbot_order_id} marked as Closed")
                        log(f"[UDP-LISTENER-{self.server_id}]    CloseDate={close_date} is {close_date - current_timestamp}s in future (time sync issue)")
                        log(f"[UDP-LISTENER-{self.server_id}]    BUT has all close indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}")
                        log(f"[UDP-LISTENER-{self.server_id}]    → SMART DETECTION: Order is actually closed!")
                    
                    else:
                        # Дата в будущем и нет всех признаков закрытия
                        # Это действительно планируемое закрытие (редкий случай)
                        log(f"[UDP-LISTENER-{self.server_id}] ⏳ CloseDate={close_date} in future for order {order.moonbot_order_id}")
                        log(f"[UDP-LISTENER-{self.server_id}]    Missing close indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}")
                        log(f"[UDP-LISTENER-{self.server_id}]    → Keeping status as Open (planned close)")
                        if order.status != "Open":
                            order.status = "Open"

            
            # 🎯 КРИТИЧНО: Если symbol == UNKNOWN, но есть FName - исправляем!
            if order.symbol == 'UNKNOWN' and 'FName' in updates:
                extracted_symbol = self._extract_symbol_from_fname(updates['FName'])
                if extracted_symbol:
                    order.symbol = extracted_symbol
                    log(f"[UDP-LISTENER-{self.server_id}] ✅ Fixed UNKNOWN → {extracted_symbol} from FName!")
            
            # 🎯 ФИНАЛЬНАЯ ПРОВЕРКА: Если CloseDate не пришёл в UPDATE, но ордер имеет все признаки закрытия
            # Это может быть второй UPDATE с только FName или другими полями
            if 'CloseDate' not in updates and order.status == "Open":
                # Проверяем признаки закрытия в ТЕКУЩЕМ состоянии ордера
                has_sell_reason = order.sell_reason and len(order.sell_reason.strip()) > 0
                has_sell_price = order.sell_price and order.sell_price > 0
                has_profit_calculated = order.profit_btc is not None
                
                if has_sell_reason and has_sell_price and has_profit_calculated:
                    # У ордера есть ВСЕ признаки закрытия, но он все еще Open
                    # Это значит предыдущий UPDATE установил статус неправильно (CloseDate был в будущем)
                    order.status = "Closed"
                    
                    # Если есть closed_at - оставляем, иначе ставим текущее время
                    if not order.closed_at:
                        order.closed_at = datetime.now()
                    
                    log(f"[UDP-LISTENER-{self.server_id}] 🔄 SMART RE-CHECK: Order {order.moonbot_order_id} has all close indicators → Changed status to Closed")
                    log(f"[UDP-LISTENER-{self.server_id}]    Indicators: SellReason={has_sell_reason}, SellPrice={has_sell_price}, ProfitBTC={has_profit_calculated}")
            
            order.updated_at = datetime.now()
            
            log(f"[UDP-LISTENER-{self.server_id}] Updated order {moonbot_order_id}: {len(updates)} fields")
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] UPDATE parse error: {e}")
            import traceback
            traceback.print_exc()
            # Откатываем транзакцию чтобы не блокировать БД
            try:
                db.rollback()
            except:
                pass
    
    def _parse_insert_order(self, db: Session, sql: str, command_id: int, moonbot_order_id: int = None):
        """
        Парсинг INSERT INTO Orders команды
        
        Формат: insert into Orders (exOrderID, Coin, BuyDate, ...) values ('id', 'DOGE', 1762466213, ...)
        
        Поля в INSERT отличаются от UPDATE:
        - Coin вместо Symbol
        - BuyDate вместо OpenDate
        - StrategyID вместо Strategy
        
        Args:
            command_id: ID из [SQLCommand XXX] - это и есть moonbot_order_id!
        """
        try:
            # Извлекаем список полей
            fields_match = re.search(r'insert\s+into\s+Orders\s*\(([^)]+)\)', sql, re.IGNORECASE)
            if not fields_match:
                log(f"[UDP-LISTENER-{self.server_id}] INSERT без полей: {sql[:100]}")
                return
            
            fields_str = fields_match.group(1)
            # Разбиваем поля, убираем пробелы и квадратные скобки
            fields = [f.strip().strip('[]').strip() for f in fields_str.split(',')]
            
            # Извлекаем значения - СЛОЖНЫЙ парсер для вложенных кавычек!
            values_match = re.search(r'values\s*\((.*)\)', sql, re.IGNORECASE | re.DOTALL)
            if not values_match:
                log(f"[UDP-LISTENER-{self.server_id}] INSERT без values: {sql[:100]}")
                return
            
            values_str = values_match.group(1).strip()
            
            # Парсим значения с учетом вложенных кавычек и запятых внутри строк
            values = []
            current_value = ""
            in_quotes = False
            escape_next = False
            paren_depth = 0
            
            for i, char in enumerate(values_str):
                if escape_next:
                    current_value += char
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    current_value += char
                    continue
                
                if char == "'" and (i == 0 or values_str[i-1] != '\\'):
                    in_quotes = not in_quotes
                    # Не добавляем кавычки в значение
                    continue
                
                if char == '(' and not in_quotes:
                    paren_depth += 1
                elif char == ')' and not in_quotes:
                    paren_depth -= 1
                
                if char == ',' and not in_quotes and paren_depth == 0:
                    # Конец значения
                    val = current_value.strip()
                    values.append(val)
                    current_value = ""
                else:
                    current_value += char
            
            # Добавляем последнее значение
            if current_value.strip():
                values.append(current_value.strip())
            
            # Создаём словарь поле -> значение
            if len(fields) != len(values):
                log(f"[UDP-LISTENER-{self.server_id}] INSERT mismatch: {len(fields)} fields vs {len(values)} values")
                log(f"  Fields: {fields[:10]}...")
                log(f"  Values: {values[:10]}...")
                return
            
            data = dict(zip(fields, values))
            
            # 🧠 ГЕНИАЛЬНОЕ РЕШЕНИЕ: Извлекаем TaskID из данных - это реальный ID ордера!
            task_id = None
            if 'TaskID' in data:
                try:
                    task_id_raw = data['TaskID'].strip()
                    # TaskID может быть числом или строкой типа "Task #123"
                    if task_id_raw.isdigit():
                        task_id = int(task_id_raw)
                    else:
                        # Ищем число в строке
                        task_id_match = re.search(r'(\d+)', task_id_raw)
                        if task_id_match:
                            task_id = int(task_id_match.group(1))
                except:
                    pass
            
            # Приоритеты определения ID:
            # 1. moonbot_order_id из параметра (oid из JSON пакета)
            # 2. TaskID из SQL данных (новое!)
            # 3. command_id из [SQLCommand XXX]
            if moonbot_order_id is None:
                if task_id and task_id > 0:
                    moonbot_order_id = task_id
                    log(f"[UDP-LISTENER-{self.server_id}] 🧠 Using TaskID as moonbot_order_id: {task_id}")
                else:
                    moonbot_order_id = command_id
            
            if not moonbot_order_id:
                log(f"[UDP-LISTENER-{self.server_id}] [WARN] No order ID available for INSERT, skipping...")
                return
            
            # Проверяем не существует ли уже такой ордер
            existing_order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()
            
            if existing_order:
                # Проверяем был ли ордер создан из UPDATE
                if getattr(existing_order, 'created_from_update', False):
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] INSERT arrived for UPDATE-created order (ID={moonbot_order_id})")
                    log(f"[UDP-LISTENER-{self.server_id}] [INFO] Completing order with missing data (BuyDate, BuyPrice...)")
                    existing_order.created_from_update = False  # Теперь полный ордер
                else:
                    log(f"[UDP-LISTENER-{self.server_id}] Order {moonbot_order_id} already exists, updating from INSERT...")
                # Обновляем существующий ордер данными из INSERT
                order = existing_order
            else:
                # Создаём новый ордер
                order = models.MoonBotOrder(
                    server_id=self.server_id,
                    moonbot_order_id=moonbot_order_id,
                    status="Open"
                )
                db.add(order)
            
            # Маппинг полей INSERT -> наша модель
            field_mapping = {
                'Coin': 'symbol',
                'Symbol': 'symbol',
                'BuyPrice': 'buy_price',
                'SellPrice': 'sell_price',
                'Quantity': 'quantity',
                'SpentBTC': 'spent_btc',
                'GainedBTC': 'gained_btc',
                'ProfitBTC': 'profit_btc',
                'SellReason': 'sell_reason',
                'Comment': 'strategy',
                'Strategy': 'strategy',
                'StrategyID': 'strategy',
                'TaskID': 'task_id',
                # Новые расширенные поля
                'exOrderID': 'ex_order_id',
                'SignalType': 'signal_type',
                'BaseCurrency': 'base_currency',
                'BoughtSO': 'bought_so',
                'Emulator': 'is_emulator',
                'BTCInDelta': 'btc_in_delta',
                'Exchange1hDelta': 'exchange_1h_delta',
                'Exchange24hDelta': 'exchange_24h_delta',
                'Latency': 'latency',
            }
            
            # Заполняем все поля
            # Сначала обрабатываем Comment для извлечения названия стратегии
            strategy_from_comment = None
            if 'Comment' in data:
                comment_value = data['Comment']
                strategy_match = re.search(r'<([^>]+)>', str(comment_value))
                if strategy_match:
                    strategy_from_comment = strategy_match.group(1)
            
            for sql_field, model_field in field_mapping.items():
                if sql_field in data:
                    value = data[sql_field]
                    
                    # Определяем тип поля и конвертируем
                    if model_field in ['buy_price', 'sell_price', 'quantity', 'spent_btc', 'gained_btc', 'profit_btc', 
                                       'btc_in_delta', 'exchange_1h_delta', 'exchange_24h_delta']:
                        value = self._safe_float(value)
                    elif model_field in ['bought_so', 'latency', 'task_id']:
                        value = self._safe_int(value)
                    elif model_field == 'is_emulator':
                        # Emulator может быть 0/1 или True/False
                        value = bool(self._safe_int(value))
                    elif model_field == 'strategy':
                        # Для стратегии - приоритет у названия из Comment
                        if sql_field == 'Comment':
                            continue  # Уже обработано выше
                        elif strategy_from_comment:
                            continue  # Используем название из Comment
                        elif value and str(value).isdigit() and str(value) != '0':
                            value = str(value)
                        else:
                            value = None
                    
                    if value is not None:
                        setattr(order, model_field, value)
            
            # Устанавливаем стратегию из Comment если она была найдена
            if strategy_from_comment:
                order.strategy = strategy_from_comment
            
            # Обработка дат
            if 'BuyDate' in data:
                buy_date = self._safe_int(data['BuyDate'])
                if buy_date and buy_date > 0:
                    try:
                        # MoonBot отправляет timestamp в UTC
                        order.opened_at = datetime.utcfromtimestamp(buy_date)
                    except:
                        order.opened_at = datetime.now()
            
            if 'CloseDate' in data:
                close_date = self._safe_int(data['CloseDate'])
                if close_date == 0:
                    order.status = "Open"
                    order.closed_at = None
                elif close_date and close_date > 0:
                    # 🎯 УМНОЕ ОПРЕДЕЛЕНИЕ СТАТУСА (аналогично UPDATE)
                    # Проверяем все признаки закрытия, а не только дату
                    
                    has_sell_reason = order.sell_reason and len(order.sell_reason.strip()) > 0
                    has_sell_price = order.sell_price and order.sell_price > 0
                    has_profit_calculated = order.profit_btc is not None
                    
                    current_timestamp = int(datetime.now().timestamp())
                    is_date_in_future = close_date > current_timestamp
                    
                    if not is_date_in_future:
                        # Классический случай: дата в прошлом - ордер закрыт
                        order.status = "Closed"
                        try:
                            order.closed_at = datetime.utcfromtimestamp(close_date)
                        except:
                            order.closed_at = datetime.now()
                        log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Order {moonbot_order_id} marked as Closed (CloseDate in past)")
                    
                    elif has_sell_reason and has_sell_price and has_profit_calculated:
                        # 🎯 УМНЫЙ СЛУЧАЙ: Дата в будущем, НО есть все признаки закрытия
                        order.status = "Closed"
                        try:
                            order.closed_at = datetime.utcfromtimestamp(close_date)
                        except:
                            order.closed_at = datetime.now()
                        log(f"[UDP-LISTENER-{self.server_id}] ✅ INSERT: Order {moonbot_order_id} marked as Closed (smart detection)")
                        log(f"[UDP-LISTENER-{self.server_id}]    CloseDate={close_date} is {close_date - current_timestamp}s in future, but has close indicators")
                    
                    else:
                        # Дата в будущем и нет всех признаков - планируемое закрытие
                        log(f"[UDP-LISTENER-{self.server_id}] ⏳ INSERT: Future CloseDate={close_date} for order {moonbot_order_id}, setting status as Open")
                        order.status = "Open"
                        order.closed_at = None
            
            # Вычисляем недостающие поля
            if not order.buy_price and order.spent_btc and order.quantity and order.quantity > 0:
                order.buy_price = order.spent_btc / order.quantity
            
            if order.profit_btc is not None and order.spent_btc and order.spent_btc > 0:
                order.profit_percent = (order.profit_btc / order.spent_btc) * 100
            
            if order.profit_btc is not None and order.spent_btc and not order.gained_btc:
                order.gained_btc = order.spent_btc + order.profit_btc
            
            order.updated_at = datetime.now()
            
            log(f"[UDP-LISTENER-{self.server_id}] {'Updated' if existing_order else 'Created'} order {moonbot_order_id}: {order.symbol} (Qty:{order.quantity}, Strategy:{order.strategy})")
            
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] INSERT parse error: {e}")
            import traceback
            traceback.print_exc()
            # Откатываем транзакцию чтобы не блокировать БД
            try:
                db.rollback()
            except:
                pass
    
    def _safe_float(self, value: str) -> Optional[float]:
        """Безопасное преобразование в float"""
        try:
            return float(value)
        except:
            return None
    
    def _safe_int(self, value: str) -> Optional[int]:
        """Безопасное преобразование в int"""
        try:
            return int(value)
        except:
            return None
    
    def _safe_bool(self, value) -> bool:
        """Безопасное преобразование в bool"""
        try:
            if isinstance(value, bool):
                return value
            if isinstance(value, str):
                return value.lower() in ('true', '1', 'yes')
            return bool(int(value))
        except:
            return False
    
    def _parse_timestamp(self, value) -> Optional[datetime]:
        """Преобразование timestamp в datetime"""
        try:
            if not value:
                return None
            timestamp = int(value)
            if timestamp == 0:
                return None
            # Unix timestamp
            return datetime.fromtimestamp(timestamp)
        except:
            return None
    
    def _extract_symbol_from_fname(self, fname: str) -> Optional[str]:
        """
        Извлечение Symbol из FName (КРИТИЧЕСКОЕ РЕШЕНИЕ проблемы UNKNOWN!)
        
        FName формат: {Exchange}{Type}_{BaseCurrency}-{SYMBOL}_{DateTime}.bin
        
        Примеры:
        - BinanceF_USDT-SAPIEN_18-11-2025 19-23-11_2.bin → SAPIEN
        - BinanceS_TRY-AXS_18-11-2025 12-42-19_2.bin → AXS
        - BybitS_USDT-XTER_18-11-2025 11-05-11_2.bin → XTER
        
        Args:
            fname: Значение поля FName из UPDATE команды
        
        Returns:
            Symbol или None если не удалось извлечь
        """
        if not fname:
            return None
        
        try:
            # Универсальный паттерн для всех бирж и баз валют
            # Формат: {что-то}_{БАЗА}-{SYMBOL}_{дата-время}
            match = re.search(r'_([A-Z]{2,6})-([A-Z0-9]{2,20})_', str(fname), re.IGNORECASE)
            if match:
                base_currency = match.group(1).upper()
                symbol = match.group(2).upper()
                
                # Валидация: symbol не должен быть числом или датой
                if symbol.isdigit():
                    return None
                
                if re.match(r'^\d{2}-\d{2}', symbol):  # Защита от дат (18-11)
                    return None
                
                # Symbol валиден!
                log(f"[UDP-LISTENER-{self.server_id}] ✅ Extracted Symbol from FName: {symbol} (base: {base_currency})")
                return symbol
            
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] ⚠️ Error extracting symbol from FName '{fname}': {e}")
        
        return None
    
    def _start_keepalive(self):
        """Запустить keep-alive таймер для сохранения NAT mapping (только для локалки)"""
        import threading
        
        def send_keepalive():
            while self.running:
                try:
                    # Ждём 60 секунд (1 минуту) перед каждой отправкой
                    time.sleep(60)
                    
                    if not self.running:
                        break
                    
                    log(f"[UDP-LISTENER-{self.server_id}] [KEEPALIVE] Recreating socket with NEW ephemeral port...")
                    
                    # Создаем НОВЫЙ UDP сокет на новом эфемерном порту
                    new_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    new_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                    new_sock.bind(("", 0))  # 0 = система выберет свободный эфемерный порт
                    
                    local_addr = new_sock.getsockname()
                    log(f"[UDP-LISTENER-{self.server_id}] [KEEPALIVE] New ephemeral port: {local_addr[1]}")
                    
                    # Закрываем СТАРЫЙ сокет
                    old_sock = self.sock
                    if old_sock:
                        try:
                            old_sock.close()
                            log(f"[UDP-LISTENER-{self.server_id}] [CLOSE] Old socket closed")
                        except:
                            pass
                    
                    # АТОМАРНО заменяем сокет
                    # Listener thread будет использовать новый сокет при следующем recvfrom()
                    self.sock = new_sock
                    
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] Listener switched to NEW port {local_addr[1]}")
                    
                    # Отправляем lst с НОВОГО порта -> Moonbot запомнит новый порт
                    log(f"[UDP-LISTENER-{self.server_id}] [SEND] Sending 'lst' from new port...")
                    self._send_command_from_listener("lst")
                    
                    log(f"[UDP-LISTENER-{self.server_id}] [OK] Keep-alive sent! Moonbot will now send to port {local_addr[1]}")
                    
                except Exception as e:
                    log(f"[UDP-LISTENER-{self.server_id}] [ERROR] Keep-alive error: {e}")
                    import traceback
                    traceback.print_exc()
        
        self.keepalive_timer = threading.Thread(
            target=send_keepalive,
            daemon=True,
            name=f"KeepAlive-{self.server_id}"
        )
        self.keepalive_timer.start()
        log(f"[UDP-LISTENER-{self.server_id}] [KEEPALIVE] Keep-alive scheduled (port rotation every 1 min)")
    
    def _update_status(self, **kwargs):
        """
        Обновление статуса listener в БД
        
        Args:
            **kwargs: Поля для обновления (is_running, started_at, last_message_at...)
        """
        db = SessionLocal()
        try:
            status = db.query(models.UDPListenerStatus).filter(
                models.UDPListenerStatus.server_id == self.server_id
            ).first()
            
            if not status:
                # Создаем новый статус
                status = models.UDPListenerStatus(server_id=self.server_id)
                db.add(status)
            
            # Обновляем поля
            for key, value in kwargs.items():
                if hasattr(status, key):
                    setattr(status, key, value)
            
            db.commit()
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Status update error: {e}")
            db.rollback()
        finally:
            db.close()


# ==================== GLOBAL UDP SOCKET (для SERVER режима) ====================

def normalize_localhost_ip(ip: str) -> str:
    """
    Нормализация localhost адресов для корректного маппинга
    
    Проблема: когда бот на том же сервере, пакеты могут приходить с разных адресов:
    - 127.0.0.1 (IPv4 localhost)
    - ::1 (IPv6 localhost) 
    - Реальный IP сервера (когда соединение идет через внешний интерфейс)
    
    Решение: приводим все localhost варианты к 127.0.0.1
    """
    if ip in ('localhost', '::1', '0.0.0.0'):
        return '127.0.0.1'
    # Если это IPv6 mapped IPv4 (например ::ffff:127.0.0.1)
    if ip.startswith('::ffff:'):
        return ip.replace('::ffff:', '')
    return ip

class GlobalUDPSocket:
    """
    Глобальный UDP сокет для SERVER режима
    
    Один сокет на фиксированном порту (2500) обслуживает все MoonBot серверы.
    Роутит входящие пакеты по комбинации (IP, PORT) в соответствующий UDPListener.
    """
    
    def __init__(self, port: int = 2500):
        """
        Args:
            port: UDP порт для прослушивания (по умолчанию 2500)
        """
        self.port = port
        self.sock = None
        self.running = False
        self.thread = None
        
        # Маппинг (IP, PORT) на listeners: {(ip, port): UDPListener}
        # ВАЖНО: Используем (IP, PORT) чтобы поддержать несколько ботов на одном IP
        self.ip_port_to_listener: Dict[tuple, 'UDPListener'] = {}
        
        # Счетчики
        self.total_packets = 0
        self.last_error = None
    
    def register_listener(self, listener: 'UDPListener'):
        """
        Зарегистрировать listener для определенной комбинации (IP, PORT)
        
        Args:
            listener: UDPListener экземпляр
        """
        # Нормализуем localhost для корректной работы когда бот на том же сервере
        normalized_host = normalize_localhost_ip(listener.host)
        key = (normalized_host, listener.port)
        self.ip_port_to_listener[key] = listener
        log(f"[GLOBAL-UDP] Registered listener for {listener.host}:{listener.port} (normalized: {normalized_host}:{listener.port}, server_id={listener.server_id})")
    
    def unregister_listener(self, listener: 'UDPListener'):
        """
        Отменить регистрацию listener
        
        Args:
            listener: UDPListener экземпляр
        """
        # Нормализуем localhost
        normalized_host = normalize_localhost_ip(listener.host)
        key = (normalized_host, listener.port)
        if key in self.ip_port_to_listener:
            del self.ip_port_to_listener[key]
            log(f"[GLOBAL-UDP] Unregistered listener for {listener.host}:{listener.port} (normalized: {normalized_host}:{listener.port}, server_id={listener.server_id})")
    
    def start(self):
        """Запустить глобальный UDP сокет"""
        if self.running:
            log(f"[GLOBAL-UDP] Already running on port {self.port}")
            return True
        
        try:
            # Создаем UDP сокет
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            
            # Привязываемся к фиксированному порту
            self.sock.bind(("", self.port))
            self.sock.settimeout(1.0)
            
            log(f"[GLOBAL-UDP] [BIND] Bound to port {self.port}")
            
            # Запускаем поток прослушивания
            self.running = True
            self.thread = threading.Thread(
                target=self._listen_loop,
                daemon=True,
                name="GlobalUDPSocket"
            )
            self.thread.start()
            
            log(f"[GLOBAL-UDP] [OK] Started successfully on port {self.port}")
            return True
            
        except Exception as e:
            log(f"[GLOBAL-UDP] [ERROR] Failed to start: {e}")
            self.last_error = str(e)
            self.running = False
            if self.sock:
                try:
                    self.sock.close()
                except:
                    pass
            return False
    
    def stop(self):
        """Остановить глобальный UDP сокет"""
        if not self.running:
            return False
        
        log(f"[GLOBAL-UDP] Stopping...")
        
        self.running = False
        
        # Закрываем сокет
        if self.sock:
            try:
                self.sock.close()
            except:
                pass
        
        # Ждем завершения потока
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        
        log(f"[GLOBAL-UDP] Stopped")
        return True
    
    def _listen_loop(self):
        """Основной цикл прослушивания"""
        log(f"[GLOBAL-UDP] Listen loop started")
        
        try:
            while self.running:
                try:
                    # Получаем пакет
                    data, addr_tuple = self.sock.recvfrom(204800)  # 200KB буфер
                    source_ip = addr_tuple[0]
                    source_port = addr_tuple[1]
                    
                    self.total_packets += 1
                    
                    # ВАЖНО: Нормализуем localhost для корректной работы когда бот на том же сервере
                    # Пакеты от localhost могут приходить с разных адресов (127.0.0.1, ::1, внешний IP)
                    normalized_ip = normalize_localhost_ip(source_ip)
                    
                    # Ищем listener по комбинации (IP, PORT)
                    key = (normalized_ip, source_port)
                    listener = self.ip_port_to_listener.get(key)
                    
                    # FALLBACK для UDP loopback:
                    # Если не нашли listener по source_ip, но пакет пришел с localhost,
                    # пробуем найти listener по порту среди всех зарегистрированных
                    if not listener and normalized_ip == '127.0.0.1':
                        # Ищем listeners на этом порту (может быть бот с внешним IP но физически localhost)
                        possible_listeners = [
                            (k, l) for k, l in self.ip_port_to_listener.items() 
                            if k[1] == source_port  # Совпадает порт
                        ]
                        
                        # Если на этом порту ТОЛЬКО ОДИН listener - используем его (безопасно)
                        if len(possible_listeners) == 1:
                            listener = possible_listeners[0][1]
                            original_key = possible_listeners[0][0]
                            log(f"[GLOBAL-UDP] [LOOPBACK] Packet from {source_ip}:{source_port} matched to {original_key} (UDP loopback detected)")
                        elif len(possible_listeners) > 1:
                            # Несколько listeners на этом порту - не можем определить какой нужен
                            log(f"[GLOBAL-UDP] [WARN] Ambiguous loopback from {source_ip}:{source_port} - {len(possible_listeners)} listeners on port {source_port}")
                            log(f"[GLOBAL-UDP]   Possible matches: {[k for k, l in possible_listeners]}")
                    
                    if listener:
                        # Передаем пакет в listener для обработки
                        try:
                            listener._process_message(data, source_ip, source_port)
                        except Exception as e:
                            log(f"[GLOBAL-UDP] Error processing packet from {source_ip}:{source_port} (normalized: {normalized_ip}): {e}")
                    else:
                        # Пакет от неизвестной комбинации (IP, PORT)
                        log(f"[GLOBAL-UDP] [WARN] Received packet from unknown source: {source_ip}:{source_port} (normalized: {normalized_ip}:{source_port})")
                        log(f"[GLOBAL-UDP]   Known servers: {list(self.ip_port_to_listener.keys())}")
                
                except socket.timeout:
                    # Timeout - это нормально, продолжаем
                    continue
                
                except Exception as e:
                    if self.running:  # Логируем только если не останавливаемся
                        log(f"[GLOBAL-UDP] Receive error: {e}")
                        self.last_error = str(e)
                        time.sleep(1)
        
        except Exception as e:
            log(f"[GLOBAL-UDP] Fatal error: {e}")
            self.last_error = str(e)
        
        finally:
            if self.sock:
                self.sock.close()
            log(f"[GLOBAL-UDP] Listen loop ended (total packets: {self.total_packets})")
    
    def send_command(self, command: str, target_host: str, target_port: int, password: Optional[str] = None) -> bool:
        """
        Отправить команду через глобальный сокет
        
        Args:
            command: Команда для отправки
            target_host: IP адрес MoonBot
            target_port: UDP порт MoonBot
            password: Пароль для HMAC (опционально)
        
        Returns:
            bool: True если отправка успешна
        """
        try:
            if not self.sock:
                log(f"[GLOBAL-UDP] [ERROR] Socket not initialized")
                return False
            
            import hmac
            import hashlib
            
            # Вычисляем HMAC если есть пароль
            if password:
                h = hmac.new(
                    password.encode('utf-8'),
                    command.encode('utf-8'),
                    hashlib.sha256
                )
                hmac_hex = h.hexdigest()
                payload = f"{hmac_hex} {command}"
            else:
                payload = command
            
            # Отправляем через глобальный сокет
            self.sock.sendto(
                payload.encode('utf-8'),
                (target_host, target_port)
            )
            
            return True
            
        except Exception as e:
            log(f"[GLOBAL-UDP] [ERROR] Failed to send command: {e}")
            return False


# ==================== УПРАВЛЕНИЕ LISTENERS ====================

def start_listener(server_id: int, host: str, port: int, password: Optional[str] = None, keepalive_enabled: bool = True) -> bool:
    """
    Запустить UDP listener для сервера
    
    Args:
        server_id: ID сервера в БД
        host: IP адрес сервера
        port: UDP порт
        password: Пароль HMAC (расшифрованный)
        keepalive_enabled: Включен ли keep-alive
    
    Returns:
        bool: True если успешно запущен
    """
    global active_listeners, global_udp_socket
    
    # Проверяем что не запущен уже
    if server_id in active_listeners:
        existing = active_listeners[server_id]
        if existing.running:
            log(f"[UDP-LISTENER] Server {server_id} already has active listener - returning success")
            return True
        # Если есть но не running - удаляем старый
        del active_listeners[server_id]
    
    # Определяем режим работы
    import os
    moonbot_mode = os.environ.get('MOONBOT_MODE', '').lower().strip()
    
    # В SERVER режиме используем глобальный сокет
    if moonbot_mode == 'server':
        # Создаем глобальный сокет если еще не создан ИЛИ если не запущен
        if global_udp_socket is None or not global_udp_socket.running:
            # Если объект существует но сокет не запущен - обнуляем
            if global_udp_socket and not global_udp_socket.running:
                log(f"[UDP-LISTENER] [WARN] Previous global socket failed, recreating...")
                global_udp_socket = None
            
            log(f"[UDP-LISTENER] Creating global UDP socket on port 2500...")
            global_udp_socket = GlobalUDPSocket(port=2500)
            success = global_udp_socket.start()
            
            if not success:
                log(f"[UDP-LISTENER] [ERROR] Failed to start global socket")
                # Обнуляем объект чтобы следующий сервер мог попробовать снова
                global_udp_socket = None
                return False
        
        # Проверяем что глобальный сокет действительно работает
        if not global_udp_socket or not global_udp_socket.running or not global_udp_socket.sock:
            log(f"[UDP-LISTENER] [ERROR] Global socket is not running properly")
            return False
        
        # Создаем listener с ссылкой на глобальный сокет
        listener = UDPListener(
            server_id=server_id,
            host=host,
            port=port,
            password=password,
            keepalive_enabled=keepalive_enabled,
            global_socket=global_udp_socket
        )
        
        # Регистрируем listener в глобальном сокете
        global_udp_socket.register_listener(listener)
        
        # Запускаем listener (он не создаст свой сокет в SERVER режиме)
        success = listener.start()
        
        if success:
            active_listeners[server_id] = listener
            log(f"[UDP-LISTENER] [OK] Registered server {server_id} ({host}) with global socket")
            return True
        else:
            global_udp_socket.unregister_listener(listener)
            return False
    
    # В LOCAL/AUTO режиме - создаем независимый listener с собственным сокетом
    else:
        listener = UDPListener(
            server_id=server_id,
            host=host,
            port=port,
            password=password,
            keepalive_enabled=keepalive_enabled,
            global_socket=None
        )
        
        # Запускаем
        success = listener.start()
        
        if success:
            active_listeners[server_id] = listener
            return True
        else:
            return False


def stop_listener(server_id: int) -> bool:
    """
    Остановить UDP listener для сервера
    
    Args:
        server_id: ID сервера в БД
    
    Returns:
        bool: True если успешно остановлен
    """
    global active_listeners, global_udp_socket
    
    if server_id not in active_listeners:
        log(f"[UDP-LISTENER] No active listener for server {server_id}")
        return False
    
    listener = active_listeners[server_id]
    
    # Если использует глобальный сокет - отменяем регистрацию
    if listener.use_global_socket and global_udp_socket:
        global_udp_socket.unregister_listener(listener)
    
    success = listener.stop()
    
    if success:
        del active_listeners[server_id]
        return True
    else:
        return False


def get_listener_status(server_id: int) -> Dict:
    """
    Получить статус listener
    
    Args:
        server_id: ID сервера
    
    Returns:
        dict: Статус listener
    """
    if server_id in active_listeners:
        listener = active_listeners[server_id]
        return {
            "is_running": listener.running,
            "messages_received": listener.messages_received,
            "last_error": listener.last_error
        }
    else:
        return {
            "is_running": False,
            "messages_received": 0,
            "last_error": None
        }


def stop_all_listeners():
    """Остановить все активные listeners"""
    global active_listeners, global_udp_socket
    
    log("[UDP-LISTENER] Stopping all listeners...")
    
    for server_id in list(active_listeners.keys()):
        stop_listener(server_id)
    
    # Останавливаем глобальный сокет если он был создан
    if global_udp_socket:
        log("[UDP-LISTENER] Stopping global UDP socket...")
        global_udp_socket.stop()
        global_udp_socket = None
    
    log("[UDP-LISTENER] All listeners stopped")

