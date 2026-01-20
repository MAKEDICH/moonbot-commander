"""
Mixin с методами bulk upsert для BatchProcessor.

Содержит оптимизированные методы для upsert операций
разных типов таблиц (server_balance, strategy_cache, moonbot_orders).
"""

from typing import Any, Dict, List, Optional, Type

from sqlalchemy.orm import Session


class BatchUpsertMixin:
    """
    Mixin с методами bulk upsert.
    
    Оптимизировано для 3000+ серверов:
    - Один SELECT для получения всех существующих записей
    - Bulk update для существующих
    - Bulk insert для новых
    """
    
    def _bulk_upsert(self, db: Session, model_class: Type, table: str,
                     data_list: List[Dict]) -> None:
        """
        Выполнить bulk upsert (insert or update).
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            table: Имя таблицы
            data_list: Список данных
        """
        if not data_list:
            return
        
        # Оптимизированный upsert для разных таблиц
        if table == 'server_balance':
            self._bulk_upsert_by_server_id(db, model_class, data_list)
        elif table == 'strategy_cache':
            self._bulk_upsert_strategy_cache(db, model_class, data_list)
        elif table == 'moonbot_orders':
            self._bulk_upsert_orders(db, model_class, data_list)
        else:
            # Fallback для неизвестных таблиц
            self._bulk_upsert_fallback(db, model_class, table, data_list)
    
    def _bulk_upsert_by_server_id(self, db: Session, model_class: Type, 
                                   data_list: List[Dict]) -> None:
        """
        Bulk upsert по server_id (для server_balance).
        
        Один SELECT вместо N.
        """
        # Собираем все server_id
        server_ids = [d.get('server_id') for d in data_list if d.get('server_id')]
        if not server_ids:
            return
        
        # Один запрос для получения всех существующих записей
        existing_records = db.query(model_class).filter(
            model_class.server_id.in_(server_ids)
        ).all()
        
        # Создаём словарь для быстрого поиска
        existing_map = {r.server_id: r for r in existing_records}
        
        # Разделяем на update и insert
        to_insert = []
        for data in data_list:
            server_id = data.get('server_id')
            existing = existing_map.get(server_id)
            
            if existing:
                # Update существующей записи
                for key, value in data.items():
                    if hasattr(existing, key) and value is not None:
                        setattr(existing, key, value)
            else:
                # Новая запись для insert
                to_insert.append(data)
        
        # Bulk insert новых записей
        if to_insert:
            db.bulk_insert_mappings(model_class, to_insert)
    
    def _bulk_upsert_strategy_cache(self, db: Session, model_class: Type,
                                     data_list: List[Dict]) -> None:
        """
        Bulk upsert для strategy_cache (составной ключ server_id + pack_number).
        """
        if not data_list:
            return
        
        # Собираем все уникальные комбинации (server_id, pack_number)
        keys = [(d.get('server_id'), d.get('pack_number')) for d in data_list]
        server_ids = list(set(k[0] for k in keys if k[0]))
        
        if not server_ids:
            return
        
        # Получаем все записи для этих серверов
        existing_records = db.query(model_class).filter(
            model_class.server_id.in_(server_ids)
        ).all()
        
        # Создаём словарь для быстрого поиска
        existing_map = {(r.server_id, r.pack_number): r for r in existing_records}
        
        to_insert = []
        for data in data_list:
            key = (data.get('server_id'), data.get('pack_number'))
            existing = existing_map.get(key)
            
            if existing:
                for k, v in data.items():
                    if hasattr(existing, k) and v is not None:
                        setattr(existing, k, v)
            else:
                to_insert.append(data)
        
        if to_insert:
            db.bulk_insert_mappings(model_class, to_insert)
    
    def _bulk_upsert_orders(self, db: Session, model_class: Type,
                            data_list: List[Dict]) -> None:
        """
        Bulk upsert для ордеров (по moonbot_order_id + server_id).
        """
        if not data_list:
            return
        
        # Собираем ордера с moonbot_order_id
        orders_with_id = [d for d in data_list if d.get('moonbot_order_id')]
        orders_without_id = [d for d in data_list if not d.get('moonbot_order_id')]
        
        if orders_with_id:
            server_ids = list(set(d.get('server_id') for d in orders_with_id if d.get('server_id')))
            
            if server_ids:
                existing_records = db.query(model_class).filter(
                    model_class.server_id.in_(server_ids)
                ).all()
                
                existing_map = {(r.server_id, r.moonbot_order_id): r for r in existing_records}
                
                to_insert = []
                for data in orders_with_id:
                    key = (data.get('server_id'), data.get('moonbot_order_id'))
                    existing = existing_map.get(key)
                    
                    if existing:
                        for k, v in data.items():
                            if hasattr(existing, k) and v is not None:
                                setattr(existing, k, v)
                    else:
                        to_insert.append(data)
                
                if to_insert:
                    db.bulk_insert_mappings(model_class, to_insert)
        
        # Ордера без moonbot_order_id просто вставляем
        if orders_without_id:
            db.bulk_insert_mappings(model_class, orders_without_id)
    
    def _bulk_upsert_fallback(self, db: Session, model_class: Type, table: str,
                               data_list: List[Dict]) -> None:
        """
        Fallback upsert для неизвестных таблиц (старая логика).
        """
        for data in data_list:
            existing = self._find_existing(db, model_class, table, data)
            
            if existing:
                for key, value in data.items():
                    if hasattr(existing, key):
                        setattr(existing, key, value)
            else:
                db.add(model_class(**data))
    
    def _find_existing(self, db: Session, model_class: Type, table: str,
                       data: Dict) -> Optional[Any]:
        """
        Найти существующую запись для upsert.
        
        Args:
            db: Сессия БД
            model_class: Класс модели
            table: Имя таблицы
            data: Данные
            
        Returns:
            Существующая запись или None
        """
        if table == 'server_balance':
            return db.query(model_class).filter(
                model_class.server_id == data.get('server_id')
            ).first()
        
        elif table == 'strategy_cache':
            # Составной ключ: server_id + pack_number
            return db.query(model_class).filter(
                model_class.server_id == data.get('server_id'),
                model_class.pack_number == data.get('pack_number')
            ).first()
        
        elif table == 'moonbot_orders':
            # Для ордеров ищем по id если есть
            if 'id' in data:
                return db.query(model_class).filter(
                    model_class.id == data['id']
                ).first()
            # Или по moonbot_order_id + server_id
            elif 'moonbot_order_id' in data:
                return db.query(model_class).filter(
                    model_class.server_id == data.get('server_id'),
                    model_class.moonbot_order_id == data.get('moonbot_order_id')
                ).first()
        
        return None
    
    def _get_upsert_key(self, table: str) -> Optional[str]:
        """
        Получить ключевое поле для upsert.
        
        Args:
            table: Имя таблицы
            
        Returns:
            Имя ключевого поля или None
        """
        keys = {
            'server_balance': 'server_id',
            'moonbot_orders': 'id',
            'strategy_cache': 'server_id',  # Составной ключ server_id + pack_number
        }
        return keys.get(table)


