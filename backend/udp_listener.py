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
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.orm import Session
from database import SessionLocal
import models
import encryption

# Глобальный словарь активных listeners
active_listeners: Dict[int, 'UDPListener'] = {}


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
        local_port: int = 0
    ):
        """
        Args:
            server_id: ID сервера в БД
            host: IP адрес MoonBot сервера
            port: UDP порт MoonBot
            password: Пароль для HMAC (расшифрованный)
            local_port: Локальный порт для привязки (0 = эфемерный)
        """
        self.server_id = server_id
        self.host = host
        self.port = port
        self.password = password
        self.local_port = local_port
        
        self.running = False
        self.sock = None
        self.thread = None
        self.messages_received = 0
        self.last_error = None
        
        # Queue для ответов на команды (чтобы не конфликтовать с основным циклом)
        self.command_response_queue = queue.Queue()
        self.waiting_for_response = False
    
    def start(self):
        """Запустить listener в отдельном потоке"""
        if self.running:
            print(f"[UDP-LISTENER-{self.server_id}] Already running")
            return False
        
        self.running = True
        self.thread = threading.Thread(
            target=self._listen_loop,
            daemon=True,
            name=f"UDPListener-{self.server_id}"
        )
        self.thread.start()
        
        # Обновляем статус в БД
        self._update_status(is_running=True, started_at=datetime.utcnow())
        
        print(f"[UDP-LISTENER-{self.server_id}] Started for {self.host}:{self.port}")
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
        
        print(f"[UDP-LISTENER-{self.server_id}] Stopped")
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
            # Создаем UDP сокет на ЭФЕМЕРНОМ порту (как у ребят!)
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.sock.bind(("", 0))  # ЭФЕМЕРНЫЙ порт!
            self.sock.settimeout(1.0)
            
            local_addr = self.sock.getsockname()
            print(f"[UDP-LISTENER-{self.server_id}] Listening on EPHEMERAL port {local_addr[1]} (local: {local_addr})")
            print(f"[UDP-LISTENER-{self.server_id}] Will send initial command to {self.host}:{self.port}")
            
            # ОТПРАВЛЯЕМ ТОЛЬКО ОДНУ КОМАНДУ LST
            self._send_command_from_listener("lst")
            print(f"[UDP-LISTENER-{self.server_id}] Initial 'lst' sent, now listening for all data from MoonBot...")
            
            # СЛУШАЕМ НА ЭТОМ ЖЕ СОКЕТЕ
            while self.running:
                try:
                    # Получаем данные (блокирующий вызов с timeout)
                    data, addr_tuple = self.sock.recvfrom(204800)  # Буфер 200KB для больших SQL отчетов
                    addr = addr_tuple[0]  # IP адрес
                    port = addr_tuple[1]  # Порт
                    
                    # Декодируем
                    try:
                        text = data.decode('utf-8', errors='replace')
                    except Exception as e:
                        print(f"[UDP-LISTENER-{self.server_id}] Decode error: {e}")
                        continue
                    
                    # Обрабатываем полученное сообщение (с защитой от падения)
                    try:
                        self._process_message(text, addr, port)
                    except Exception as e:
                        print(f"[UDP-LISTENER-{self.server_id}] Message processing error: {e}")
                        import traceback
                        traceback.print_exc()
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
                            print(f"[UDP-LISTENER-{self.server_id}] Status update error: {e}")
                    
                except socket.timeout:
                    # Timeout - это нормально, продолжаем цикл
                    continue
                
                except Exception as e:
                    if self.running:  # Логируем только если не останавливаемся
                        print(f"[UDP-LISTENER-{self.server_id}] Receive error: {e}")
                        self.last_error = str(e)
                        time.sleep(1)  # Небольшая пауза перед retry
        
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] Fatal error: {e}")
            self.last_error = str(e)
            self._update_status(is_running=False, last_error=str(e))
        
        finally:
            if self.sock:
                self.sock.close()
            print(f"[UDP-LISTENER-{self.server_id}] Loop ended")
    
    def _send_command_from_listener(self, command: str):
        """
        Отправка команды через сокет listener (как у ребят!)
        
        Args:
            command: Команда для отправки
        """
        try:
            import hmac
            import hashlib
            
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
                print(f"[UDP-LISTENER-{self.server_id}] 📤 Sending command from listener:")
                print(f"  Command: {command}")
                print(f"  Target: {self.host}:{self.port}")
                print(f"  Password: {password_masked}")
                print(f"  HMAC: {hmac_hex[:16]}...")
            else:
                payload = command
                print(f"[UDP-LISTENER-{self.server_id}] 📤 Sending command (no password):")
                print(f"  Command: {command}")
                print(f"  Target: {self.host}:{self.port}")
            
            # Отправляем через listener сокет
            if self.sock:
                self.sock.sendto(
                    payload.encode('utf-8'),
                    (self.host, self.port)
                )
                print(f"[UDP-LISTENER-{self.server_id}] ✅ Command sent successfully")
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] ❌ Failed to send command: {e}")
    
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
                print(f"[UDP-LISTENER-{self.server_id}] 📤 Sending command with response:")
                print(f"  Command: {command}")
                print(f"  Target: {self.host}:{self.port}")
                print(f"  Password: {password_masked}")
                print(f"  HMAC: {hmac_hex[:16]}...")
            else:
                payload = command
                print(f"[UDP-LISTENER-{self.server_id}] 📤 Sending command with response (no password):")
                print(f"  Command: {command}")
                print(f"  Target: {self.host}:{self.port}")
            
            # Отправляем команду
            self.sock.sendto(
                payload.encode('utf-8'),
                (self.host, self.port)
            )
            print(f"[UDP-LISTENER-{self.server_id}] ✅ Command sent, waiting for response in queue...")
            
            # Ждём ответ из queue (listener положит его туда)
            try:
                response = self.command_response_queue.get(timeout=timeout)
                print(f"[UDP-LISTENER-{self.server_id}] 📥 Response received from queue: {response[:100]}...")
                
                # Проверяем на ошибки MoonBot
                if response.startswith('ERR'):
                    return False, response
                
                return True, response
                
            except queue.Empty:
                print(f"[UDP-LISTENER-{self.server_id}] ⏱️ Timeout waiting for response in queue")
                return False, "Timeout: не получен ответ от сервера"
            finally:
                self.waiting_for_response = False
                
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] ❌ Failed to send command with response: {e}")
            self.waiting_for_response = False
            return False, f"Ошибка: {str(e)}"
    
    
    def _process_message(self, message: str, addr: str, port: int):
        """
        Обработка полученного сообщения
        
        Args:
            message: Текст сообщения
            addr: IP адрес отправителя
            port: Порт отправителя
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]
        
        # Проверяем источник сообщения - только IP
        # Порт НЕ проверяем жестко, так как MoonBot может отправлять с разных портов
        if addr != self.host:
            print(f"[UDP-LISTENER-{self.server_id}] ⚠️ WARNING: Received message from WRONG HOST!")
            print(f"[UDP-LISTENER-{self.server_id}]   Expected: {self.host}:{self.port}")
            print(f"[UDP-LISTENER-{self.server_id}]   Got from: {addr}:{port}")
            print(f"[UDP-LISTENER-{self.server_id}]   Message: {message[:100]}...")
            # НЕ обрабатываем сообщения от других хостов!
            return
        
        # Логируем если порт не совпадает, но ВСЁ РАВНО ОБРАБАТЫВАЕМ
        if port != self.port:
            print(f"[UDP-LISTENER-{self.server_id}] ℹ️ INFO: Received from unexpected port {port} (expected {self.port}), but processing anyway")
            print(f"[UDP-LISTENER-{self.server_id}]   From: {addr}:{port}")
            print(f"[UDP-LISTENER-{self.server_id}]   Message: {message[:100]}...")
        
        # Логируем ПРАВИЛЬНЫЕ сообщения
        print(f"[UDP-LISTENER-{self.server_id}] ✅ {timestamp} [{addr}:{port}] -> {message[:100]}...")
        
        # ВАЖНО: Если ждём ответ на команду - кладём в queue и НЕ обрабатываем дальше
        if self.waiting_for_response:
            print(f"[UDP-LISTENER-{self.server_id}] 📦 Putting response into queue for API")
            self.command_response_queue.put(message)
            # НЕ обрабатываем это сообщение как SQL/lst - это ответ на команду
            return
        
        # Проверяем это SQL команда?
        if "[SQLCommand" in message:
            # SQL команда от MoonBot
            self._process_sql_command(message)
        # Проверяем это ответ на lst команду?
        elif "Open Sell Orders:" in message or "Open Buy Orders:" in message:
            # Ответ на lst - парсим количество открытых ордеров
            self._process_lst_response(message)
        else:
            # Обычное сообщение (уже залогировали выше)
            pass
    
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
            
            total_open = 0
            
            # Ищем "Open Sell Orders: N"
            sell_match = re.search(r'Open Sell Orders:\s*(\d+)', message)
            if sell_match:
                total_open += int(sell_match.group(1))
            
            # Ищем "Open Buy Orders: N"
            buy_match = re.search(r'Open Buy Orders:\s*(\d+)', message)
            if buy_match:
                total_open += int(buy_match.group(1))
            
            print(f"[UDP-LISTENER-{self.server_id}] MoonBot reports {total_open} open orders")
            
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
                            print(f"[UDP-LISTENER-{self.server_id}]   Found symbol: {symbol.upper()}")
            
            # Проверяем сколько у нас открытых в БД
            db = SessionLocal()
            try:
                our_open_count = db.query(models.MoonBotOrder).filter(
                    models.MoonBotOrder.server_id == self.server_id,
                    models.MoonBotOrder.status == "Open"
                ).count()
                
                print(f"[UDP-LISTENER-{self.server_id}] Our DB has {our_open_count} open orders")
                
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
                            print(f"[UDP-LISTENER-{self.server_id}]   Updated order #{order.moonbot_order_id} symbol to {symbols_found[i]}")
                    
                    db.commit()
                
                # Если у нас больше открытых чем у MoonBot - закрываем старые
                if our_open_count > total_open:
                    excess = our_open_count - total_open
                    print(f"[UDP-LISTENER-{self.server_id}] Closing {excess} excess orders...")
                    
                    # Находим самые старые открытые ордера (которые давно не обновлялись)
                    old_orders = db.query(models.MoonBotOrder).filter(
                        models.MoonBotOrder.server_id == self.server_id,
                        models.MoonBotOrder.status == "Open"
                    ).order_by(models.MoonBotOrder.updated_at.asc()).limit(excess).all()
                    
                    for order in old_orders:
                        order.status = "Closed"
                        order.closed_at = datetime.utcnow()
                        order.updated_at = datetime.utcnow()
                        print(f"[UDP-LISTENER-{self.server_id}]   - Closed order #{order.moonbot_order_id} (last update: {order.updated_at})")
                    
                    db.commit()
                    print(f"[UDP-LISTENER-{self.server_id}] [OK] Closed {excess} orders")
                
            except Exception as e:
                print(f"[UDP-LISTENER-{self.server_id}] Error processing lst response: {e}")
                db.rollback()
            finally:
                db.close()
        
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] Error parsing lst response: {e}")
    
    def _process_sql_command(self, sql_text: str):
        """
        Парсинг и сохранение SQL команды в БД
        
        Формат: [SQLCommand 86516] update Orders set CloseDate=0, SellPrice=0.52135...
        
        Args:
            sql_text: Полный текст SQL команды
        """
        try:
            # Извлекаем ID команды
            match = re.search(r'\[SQLCommand (\d+)\]', sql_text)
            if not match:
                print(f"[UDP-LISTENER-{self.server_id}] No SQLCommand ID found: {sql_text[:100]}")
                return
            
            command_id = int(match.group(1))
            sql_body = sql_text[match.end():].strip()
            
            # Логируем (короткая версия)
            print(f"[UDP-LISTENER-{self.server_id}] SQL [{command_id}]: {sql_body[:100]}...")
            
            # Сохраняем в БД
            db = SessionLocal()
            try:
                # Создаем запись в логе
                sql_log = models.SQLCommandLog(
                    server_id=self.server_id,
                    command_id=command_id,
                    sql_text=sql_body,
                    received_at=datetime.utcnow(),
                    processed=False
                )
                db.add(sql_log)
                
                # Получаем user_id сервера для WebSocket уведомления
                server = db.query(models.Server).filter(models.Server.id == self.server_id).first()
                user_id = server.user_id if server else None
                
                # Пытаемся распарсить и обработать Orders
                if "Orders" in sql_body:
                    self._parse_and_save_order(db, sql_body, command_id)
                
                db.commit()
                
                # Отправляем WebSocket уведомления (thread-safe)
                if user_id:
                    from websocket_manager import notify_sql_log_sync, notify_order_update_sync
                    
                    print(f"[UDP-LISTENER-{self.server_id}] 📤 Sending WebSocket notification to user_id={user_id}")
                    
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
                    print(f"[UDP-LISTENER-{self.server_id}] ✅ SQL log notification sent")
                    
                    # Если это ордер - отправляем дополнительное уведомление
                    if "Orders" in sql_body:
                        notify_order_update_sync(user_id, self.server_id)
                        print(f"[UDP-LISTENER-{self.server_id}] ✅ Order update notification sent")
                else:
                    print(f"[UDP-LISTENER-{self.server_id}] ⚠️ No user_id found, cannot send WebSocket notification")
                
            except Exception as e:
                print(f"[UDP-LISTENER-{self.server_id}] DB Error: {e}")
                import traceback
                traceback.print_exc()
                db.rollback()
            finally:
                db.close()
        
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] Parse error: {e}")
            import traceback
            traceback.print_exc()
    
    def _parse_and_save_order(self, db: Session, sql: str, command_id: int):
        """
        Парсинг SQL команды для таблицы Orders и сохранение в moonbot_orders
        
        Примеры SQL:
        - update Orders set CloseDate=0, SellPrice=0.52135, GainedBTC=0, SpentBTC=3.12...
        - insert into Orders (Symbol, BuyPrice, ...) values ('BTC', 0.0001, ...)
        
        Args:
            db: Database session
            sql: SQL команда
            command_id: ID команды от MoonBot
        """
        try:
            # Определяем тип команды
            sql_lower = sql.lower()
            
            if sql_lower.startswith('update orders'):
                self._parse_update_order(db, sql)
            elif sql_lower.startswith('insert into orders'):
                self._parse_insert_order(db, sql, command_id)
            else:
                # Другие команды (delete, select...) пока не обрабатываем
                pass
        
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] Order parse error: {e}")
    
    def _parse_update_order(self, db: Session, sql: str):
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
                print(f"[UDP-LISTENER-{self.server_id}] UPDATE без ID: {sql[:100]}")
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
                # Создаем новый ордер (если еще не было INSERT)
                order = models.MoonBotOrder(
                    server_id=self.server_id,
                    moonbot_order_id=moonbot_order_id,
                    symbol="UNKNOWN"  # Будет обновлено позже
                )
                db.add(order)
            
            # Обновляем поля (все доступные из UPDATE)
            field_mapping = {
                'Symbol': ('symbol', str),
                'BuyPrice': ('buy_price', float),
                'SellPrice': ('sell_price', float),
                'Quantity': ('quantity', float),
                'SpentBTC': ('spent_btc', float),
                'GainedBTC': ('gained_btc', float),
                'ProfitBTC': ('profit_btc', float),
                'SellReason': ('sell_reason', str),
                'Strategy': ('strategy', str),
            }
            
            # Применяем все найденные поля
            for sql_field, (model_field, field_type) in field_mapping.items():
                if sql_field in updates:
                    try:
                        if field_type == float:
                            value = self._safe_float(updates[sql_field])
                        elif field_type == int:
                            value = self._safe_int(updates[sql_field])
                        else:
                            value = updates[sql_field]
                        
                        if value is not None:
                            setattr(order, model_field, value)
                    except Exception as e:
                        print(f"[UDP-LISTENER-{self.server_id}] Error setting {model_field}: {e}")
            
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
                else:
                    order.status = "Closed"
                    try:
                        # MoonBot отправляет timestamp, который нужно интерпретировать как UTC
                        # и сохранить без конвертации в локальное время
                        order.closed_at = datetime.utcfromtimestamp(close_date)
                    except (ValueError, OSError, OverflowError) as e:
                        print(f"[UDP-LISTENER-{self.server_id}] Warning: Invalid CloseDate={close_date}, Error: {e}")
                        order.closed_at = datetime.now()

            
            order.updated_at = datetime.now()
            
            print(f"[UDP-LISTENER-{self.server_id}] Updated order {moonbot_order_id}: {len(updates)} fields")
        
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] UPDATE parse error: {e}")
            import traceback
            traceback.print_exc()
            # Откатываем транзакцию чтобы не блокировать БД
            try:
                db.rollback()
            except:
                pass
    
    def _parse_insert_order(self, db: Session, sql: str, command_id: int):
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
                print(f"[UDP-LISTENER-{self.server_id}] INSERT без полей: {sql[:100]}")
                return
            
            fields_str = fields_match.group(1)
            # Разбиваем поля, убираем пробелы и квадратные скобки
            fields = [f.strip().strip('[]').strip() for f in fields_str.split(',')]
            
            # Извлекаем значения - СЛОЖНЫЙ парсер для вложенных кавычек!
            values_match = re.search(r'values\s*\((.*)\)', sql, re.IGNORECASE | re.DOTALL)
            if not values_match:
                print(f"[UDP-LISTENER-{self.server_id}] INSERT без values: {sql[:100]}")
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
                print(f"[UDP-LISTENER-{self.server_id}] INSERT mismatch: {len(fields)} fields vs {len(values)} values")
                print(f"  Fields: {fields[:10]}...")
                print(f"  Values: {values[:10]}...")
                return
            
            data = dict(zip(fields, values))
            
            # Используем command_id как moonbot_order_id (это ID из [SQLCommand XXX])
            moonbot_order_id = command_id
            
            # Проверяем не существует ли уже такой ордер
            existing_order = db.query(models.MoonBotOrder).filter(
                models.MoonBotOrder.server_id == self.server_id,
                models.MoonBotOrder.moonbot_order_id == moonbot_order_id
            ).first()
            
            if existing_order:
                print(f"[UDP-LISTENER-{self.server_id}] Order {moonbot_order_id} already exists, updating from INSERT...")
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
                'Coin': 'symbol',           # Coin -> symbol
                'Symbol': 'symbol',         # На случай если есть Symbol
                'BuyPrice': 'buy_price',
                'SellPrice': 'sell_price',
                'Quantity': 'quantity',
                'SpentBTC': 'spent_btc',
                'GainedBTC': 'gained_btc',
                'ProfitBTC': 'profit_btc',
                'SellReason': 'sell_reason',
                'Comment': 'strategy',       # Из Comment извлекаем название стратегии
                'Strategy': 'strategy',
                'StrategyID': 'strategy',    # StrategyID -> strategy
                'TaskID': 'strategy',        # TaskID тоже может быть стратегия
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
                    
                    # Определяем тип поля
                    if model_field in ['buy_price', 'sell_price', 'quantity', 'spent_btc', 'gained_btc', 'profit_btc']:
                        value = self._safe_float(value)
                    elif model_field == 'strategy':
                        # Для стратегии - приоритет у названия из Comment
                        if sql_field == 'Comment':
                            # Уже обработано выше
                            continue
                        elif strategy_from_comment:
                            # Если есть название из Comment - используем его, пропускаем TaskID/StrategyID
                            continue
                        elif value and str(value).isdigit() and str(value) != '0':
                            # TaskID или StrategyID - сохраняем как число (только если нет названия из Comment)
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
                    order.status = "Closed"
                    try:
                        # MoonBot отправляет timestamp в UTC
                        order.closed_at = datetime.utcfromtimestamp(close_date)
                    except:
                        order.closed_at = datetime.now()
            
            # Вычисляем недостающие поля
            if not order.buy_price and order.spent_btc and order.quantity and order.quantity > 0:
                order.buy_price = order.spent_btc / order.quantity
            
            if order.profit_btc is not None and order.spent_btc and order.spent_btc > 0:
                order.profit_percent = (order.profit_btc / order.spent_btc) * 100
            
            if order.profit_btc is not None and order.spent_btc and not order.gained_btc:
                order.gained_btc = order.spent_btc + order.profit_btc
            
            order.updated_at = datetime.utcnow()
            
            print(f"[UDP-LISTENER-{self.server_id}] {'Updated' if existing_order else 'Created'} order {moonbot_order_id}: {order.symbol} (Qty:{order.quantity}, Strategy:{order.strategy})")
            
        except Exception as e:
            print(f"[UDP-LISTENER-{self.server_id}] INSERT parse error: {e}")
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
            print(f"[UDP-LISTENER-{self.server_id}] Status update error: {e}")
            db.rollback()
        finally:
            db.close()


# ==================== УПРАВЛЕНИЕ LISTENERS ====================

def start_listener(server_id: int, host: str, port: int, password: Optional[str] = None) -> bool:
    """
    Запустить UDP listener для сервера
    
    Args:
        server_id: ID сервера в БД
        host: IP адрес сервера
        port: UDP порт
        password: Пароль HMAC (расшифрованный)
    
    Returns:
        bool: True если успешно запущен
    """
    global active_listeners
    
    # Проверяем что не запущен уже
    if server_id in active_listeners:
        existing = active_listeners[server_id]
        if existing.running:
            print(f"[UDP-LISTENER] Server {server_id} already has active listener - returning success")
            return True
        # Если есть но не running - удаляем старый
        del active_listeners[server_id]
    
    # Создаем новый listener
    listener = UDPListener(
        server_id=server_id,
        host=host,
        port=port,
        password=password
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
    global active_listeners
    
    if server_id not in active_listeners:
        print(f"[UDP-LISTENER] No active listener for server {server_id}")
        return False
    
    listener = active_listeners[server_id]
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
    global active_listeners
    
    print("[UDP-LISTENER] Stopping all listeners...")
    
    for server_id in list(active_listeners.keys()):
        stop_listener(server_id)
    
    print("[UDP-LISTENER] All listeners stopped")

