"""
Парсеры SQL команд для UDP Listener

Обработка INSERT, UPDATE, DELETE команд от MoonBot
"""
from .sql_parser_base import SQLParserBase
from .sql_parser_update import SQLParserUpdateMixin
from .sql_parser_insert import SQLParserInsertMixin
from .sql_parser_delete import SQLParserDeleteMixin
from .sql_parser_dates import SQLParserDatesMixin


class SQLParser(
    SQLParserDatesMixin,
    SQLParserDeleteMixin,
    SQLParserInsertMixin,
    SQLParserUpdateMixin,
    SQLParserBase
):
    """
    Полный SQL парсер для обработки команд от MoonBot
    
    Объединяет все миксины для обработки:
    - INSERT команд
    - UPDATE команд
    - DELETE команд
    - Дат и временных меток
    """
    pass
