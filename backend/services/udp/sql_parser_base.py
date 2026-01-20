"""
Базовый класс SQL парсера
"""
import re
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session
from models import models
from utils.logging import log
from . import utils


class SQLParserBase:
    """Базовый класс для парсинга SQL команд от MoonBot"""
    
    def __init__(self, server_id: int):
        self.server_id = server_id
    
    def parse_and_save_order(self, db: Session, sql: str, command_id: int, moonbot_order_id: int = None, bot_name: str = None):
        """
        Парсинг SQL команды для таблицы Orders и сохранение в moonbot_orders
        
        Args:
            db: Сессия базы данных
            sql: SQL команда
            command_id: ID команды из пакета
            moonbot_order_id: ID ордера от MoonBot
            bot_name: Имя бота (передаётся в пакете как "bot")
        """
        try:
            sql_lower = sql.lower()
            
            if sql_lower.startswith('update orders'):
                self.parse_update_order(db, sql, moonbot_order_id, bot_name=bot_name)
            elif sql_lower.startswith('insert into orders'):
                self.parse_insert_order(db, sql, command_id, moonbot_order_id, bot_name=bot_name)
            elif sql_lower.startswith('delete from orders'):
                self.parse_delete_order(db, sql, moonbot_order_id)
        
        except Exception as e:
            log(f"[UDP-LISTENER-{self.server_id}] Order parse error: {e}")
    
    def _parse_set_clause(self, set_clause: str) -> dict:
        """Парсинг SET clause из UPDATE"""
        updates = {}
        current_key = ""
        current_value = ""
        in_quotes = False
        escape_next = False
        state = "key"
        
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
                    key = current_key.strip().strip('[]')
                    value = current_value.strip()
                    if key:
                        updates[key] = value
                    current_key = ""
                    current_value = ""
                    state = "key"
                else:
                    current_value += char
        
        if current_key:
            key = current_key.strip().strip('[]')
            value = current_value.strip()
            if key:
                updates[key] = value
        
        return updates
    
    def _parse_values_clause(self, values_str: str) -> list:
        """Парсинг VALUES clause из INSERT"""
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
                continue
            
            if char == '(' and not in_quotes:
                paren_depth += 1
            elif char == ')' and not in_quotes:
                paren_depth -= 1
            
            if char == ',' and not in_quotes and paren_depth == 0:
                val = current_value.strip()
                values.append(val)
                current_value = ""
            else:
                current_value += char
        
        if current_value.strip():
            values.append(current_value.strip())
        
        return values
    
    
    def _extract_task_id(self, data: dict) -> Optional[int]:
        """Извлечение TaskID из данных INSERT"""
        if 'TaskID' in data:
            try:
                task_id_raw = data['TaskID'].strip()
                if task_id_raw.isdigit():
                    return int(task_id_raw)
                else:
                    task_id_match = re.search(r'(\d+)', task_id_raw)
                    if task_id_match:
                        return int(task_id_match.group(1))
            except (ValueError, TypeError):
                pass  # Не удалось преобразовать в число
        return None



