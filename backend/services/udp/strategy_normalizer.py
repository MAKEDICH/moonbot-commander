"""
Нормализация и извлечение названий стратегий
"""
import re
from typing import Optional
from utils.logging import log


class StrategyNormalizer:
    """Класс для нормализации и извлечения названий стратегий"""
    
    def __init__(self, server_id: int):
        self.server_id = server_id
    
    def extract_strategy_from_all_sources(self, data: dict) -> Optional[str]:
        """
        Извлечение стратегии из трёх источников (как в проекте A):
        1. SellReason - проверяем паттерн (strategy <Name>)
        2. ChannelName - проверяем (strategy <Name>) или <Name>
        3. Comment - проверяем (strategy <Name>) или <Name>
        """
        # 1. Проверяем SellReason ТОЛЬКО на наличие (strategy <Name>)
        if 'SellReason' in data:
            sellreason_value = str(data['SellReason'])
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', sellreason_value)
            if strategy_match:
                strategy = strategy_match.group(1).strip()
                log(f"[UDP-LISTENER-{self.server_id}] 🎯 Found strategy in SellReason: '{strategy}'")
                return strategy
        
        # 2. Проверяем ChannelName
        if 'ChannelName' in data:
            channel_value = str(data['ChannelName'])
            # Сначала ищем в формате (strategy <StrategyName>)
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', channel_value)
            if strategy_match:
                strategy = strategy_match.group(1).strip()
                log(f"[UDP-LISTENER-{self.server_id}] 🎯 Found strategy in ChannelName: '{strategy}'")
                return strategy
            else:
                # Если не нашли, ищем просто <StrategyName>
                strategy_match = re.search(r'<([^<>]+)>', channel_value)
                if strategy_match:
                    strategy = strategy_match.group(1).strip()
                    log(f"[UDP-LISTENER-{self.server_id}] 🎯 Found strategy in ChannelName: '{strategy}'")
                    return strategy
        
        # 3. Проверяем Comment
        if 'Comment' in data:
            comment_value = str(data['Comment'])
            
            # 🎯 КРИТИЧНО: Если Comment начинается с "CPU:" - это системная информация
            # Не извлекаем из него стратегию, чтобы ордер отображался как MANUAL
            if comment_value.strip().startswith('CPU:'):
                log(f"[UDP-LISTENER-{self.server_id}] ⚠️ Comment starts with 'CPU:' - skipping strategy extraction (will be MANUAL)")
                return None
            
            # Сначала ищем в формате (strategy <StrategyName>)
            strategy_match = re.search(r'\(strategy\s*<([^>]+)>\)', comment_value)
            if strategy_match:
                strategy = strategy_match.group(1).strip()
                log(f"[UDP-LISTENER-{self.server_id}] 🎯 Found strategy in Comment: '{strategy}'")
                return strategy
            else:
                # Если не нашли, ищем просто <StrategyName>
                strategy_match = re.search(r'<([^<>]+)>', comment_value)
                if strategy_match:
                    strategy = strategy_match.group(1).strip()
                    log(f"[UDP-LISTENER-{self.server_id}] 🎯 Found strategy in Comment: '{strategy}'")
                    return strategy
        
        return None
    
    def normalize_strategy_name(self, strategy: str) -> Optional[str]:
        """
        🎯 ГЕНИАЛЬНОЕ РЕШЕНИЕ: Нормализация и валидация названия стратегии
        (Логика из эталонного проекта AAAA)
        
        Проблемы, которые решает:
        1. "Palki(e)" → "Palki" (удаляет лишние скобки и некорректные суффиксы)
        2. Обрезает слишком длинные стратегии до читаемого формата
        3. Извлекает ключевые слова из сложных описаний
        4. Валидирует и фильтрует "мусорные" значения
        
        Args:
            strategy: Исходное название стратегии из SQL
            
        Returns:
            Нормализованное название стратегии или None
        """
        if not strategy:
            return None
        
        strategy = str(strategy).strip()
        
        # Удаляем кавычки если есть
        strategy = strategy.strip("'\"")
        
        # Если пустое - возвращаем None
        if not strategy or strategy in ('0', '', 'null', 'NULL', 'None'):
            return None
        
        # 🎯 КРИТИЧНО: Строки начинающиеся с "CPU:" - это системная информация, НЕ стратегия!
        # Такие ордера должны отображаться как MANUAL
        if strategy.startswith('CPU:'):
            log(f"[UDP-LISTENER-{self.server_id}] ⚠️ '{strategy[:50]}...' starts with 'CPU:' - this is system info, not a Strategy! Filtering out.")
            return None
        
        # ИЗВЕСТНЫЕ ПАТТЕРНЫ СТРАТЕГИЙ MoonBot
        # ⚠️ ВАЖНО: Это ТИПЫ стратегий, а НЕ конкретные названия!
        # Если в поле strategy попал тип (SpreadDetection, Palki и т.д.),
        # это значит что конкретного названия стратегии нет.
        # В таком случае ЛУЧШЕ ОСТАВИТЬ ПУСТЫМ!
        strategy_types = [
            'spreaddetection',
            'palki',
            'market maker',
            'arbitrage',
            'grid trading',
            'dca',
        ]
        
        # ⚠️ ВАЖНО: Это НЕ стратегии, а причины закрытия (SellReason)!
        # Они НЕ должны попадать в поле strategy
        non_strategies = [
            'auto price down',
            'auto price up',
            'manual sell',
            'stop loss',
            'take profit',
            'trailing stop',
            'price up',
            'price down',
            'manual',
            'auto',
            'timeout',
        ]
        
        # 1️⃣ ИСПРАВЛЕНИЕ: "Palki(e)" → "Palki"
        # Удаляем некорректные суффиксы в скобках
        strategy = re.sub(r'\([a-z]\)$', '', strategy, flags=re.IGNORECASE)  # (e), (x), (a) и т.д.
        strategy = strategy.strip()
        
        # 2️⃣ Проверяем точное совпадение с известными стратегиями (игнорируя регистр)
        strategy_lower = strategy.lower()
        
        # Сначала проверяем что это НЕ причина закрытия
        if strategy_lower in non_strategies:
            log(f"[UDP-LISTENER-{self.server_id}] ⚠️ '{strategy}' is a SellReason, not a Strategy! Filtering out.")
            return None
        
        # 🎯 КРИТИЧНО: Проверяем что это НЕ тип стратегии
        if strategy_lower in strategy_types:
            log(f"[UDP-LISTENER-{self.server_id}] ⚠️ '{strategy}' is a Strategy TYPE, not a specific Strategy NAME! Filtering out.")
            return None
        
        # 3️⃣ Если дошли сюда - это конкретное название стратегии
        # Удаляем лишние символы и пробелы
        strategy = strategy.strip()
        
        # Ограничиваем длину (максимум 50 символов для читаемости)
        if len(strategy) > 50:
            return strategy[:50] + '...'
        
        # 4️⃣ Фильтруем "мусорные" значения (числа, короткие бессмысленные строки)
        if strategy.isdigit():
            return None  # Это TaskID, а не стратегия
        
        if len(strategy) < 3:
            return None  # Слишком короткое - скорее всего мусор
        
        # 6️⃣ Возвращаем как есть, если прошло все проверки
        return strategy



