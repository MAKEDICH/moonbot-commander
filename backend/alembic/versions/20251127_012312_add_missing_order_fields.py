"""add_missing_order_fields_and_change_types

Revision ID: 20251127_012312
Revises: 08ce99df2c3c
Create Date: 2025-11-27 01:23:12

Добавляет:
- 30+ отсутствующих полей в таблицу moonbot_orders
- Изменяет типы buy_date, close_date с DateTime на Integer
- Изменяет тип base_currency с VARCHAR на Integer
- Конвертирует существующие данные
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import sqlite
from datetime import datetime


# revision identifiers, used by Alembic.
revision = '20251127_012312'
down_revision = '08ce99df2c3c'
branch_labels = None
depends_on = None


def upgrade():
    """Применение миграции"""
    
    # Получаем соединение для выполнения SQL запросов
    conn = op.get_bind()
    
    # === ШАГ 1: Добавляем новые поля ===
    
    # МЕТАДАННЫЕ И ИСТОЧНИКИ
    op.add_column('moonbot_orders', sa.Column('source', sa.Integer(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('channel', sa.Integer(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('channel_name', sa.String(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('comment', sa.Text(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('strategy_id', sa.Integer(), nullable=True))
    
    # ФАЙЛЫ И СОСТОЯНИЕ
    op.add_column('moonbot_orders', sa.Column('fname', sa.String(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('deleted', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('emulator', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('imp', sa.Integer(), nullable=True, server_default='0'))
    
    # РЫНОЧНЫЕ ДАННЫЕ
    op.add_column('moonbot_orders', sa.Column('bought_q', sa.Float(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('btc_1h_delta', sa.Float(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('btc_24h_delta', sa.Float(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('btc_5m_delta', sa.Float(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('dbtc_1m', sa.Float(), nullable=True))
    
    # PUMP & DUMP
    op.add_column('moonbot_orders', sa.Column('pump_1h', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('dump_1h', sa.Float(), nullable=True, server_default='0'))
    
    # ДЕТАЛЬНЫЕ ДЕЛЬТЫ
    op.add_column('moonbot_orders', sa.Column('d24h', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('d3h', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('d1h', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('d15m', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('d5m', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('d1m', sa.Float(), nullable=True, server_default='0'))
    
    # ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ
    op.add_column('moonbot_orders', sa.Column('price_bug', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('vd1m', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('lev', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('moonbot_orders', sa.Column('bvsv_ratio', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('is_short', sa.Integer(), nullable=True, server_default='0'))
    
    # ОБЪЁМЫ
    op.add_column('moonbot_orders', sa.Column('hvol', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('hvolf', sa.Float(), nullable=True, server_default='0'))
    op.add_column('moonbot_orders', sa.Column('dvol', sa.Float(), nullable=True, server_default='0'))
    
    # ВРЕМЕННЫЕ МЕТКИ
    op.add_column('moonbot_orders', sa.Column('sell_set_date', sa.Integer(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('bot_name', sa.String(), nullable=True))
    
    # Добавляем индекс для bot_name
    op.create_index(op.f('ix_moonbot_orders_bot_name'), 'moonbot_orders', ['bot_name'], unique=False)
    
    # === ШАГ 2: Изменяем типы существующих полей ===
    
    # Добавляем временные колонки для хранения конвертированных данных
    op.add_column('moonbot_orders', sa.Column('buy_date_int', sa.Integer(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('close_date_int', sa.Integer(), nullable=True))
    op.add_column('moonbot_orders', sa.Column('base_currency_int', sa.Integer(), nullable=True))
    
    # Конвертируем существующие данные
    # buy_date: DateTime → timestamp
    conn.execute(sa.text("""
        UPDATE moonbot_orders 
        SET buy_date_int = CAST(strftime('%s', buy_date) AS INTEGER)
        WHERE buy_date IS NOT NULL
    """))
    
    # close_date: DateTime → timestamp
    conn.execute(sa.text("""
        UPDATE moonbot_orders 
        SET close_date_int = CAST(strftime('%s', close_date) AS INTEGER)
        WHERE close_date IS NOT NULL AND close_date != '1970-01-01 00:00:00'
    """))
    
    # Устанавливаем 0 для открытых ордеров
    conn.execute(sa.text("""
        UPDATE moonbot_orders 
        SET close_date_int = 0
        WHERE close_date IS NULL OR close_date = '1970-01-01 00:00:00'
    """))
    
    # base_currency: String → Integer (0=USDT, 1=BTC)
    # Примечание: Конвертируем строковые значения в integer enum
    conn.execute(sa.text("""
        UPDATE moonbot_orders 
        SET base_currency_int = CASE 
            WHEN UPPER(base_currency) = 'USDT' THEN 0
            WHEN UPPER(base_currency) = 'BTC' THEN 1
            WHEN UPPER(base_currency) = 'TRY' THEN 2
            WHEN UPPER(base_currency) = 'EUR' THEN 3
            WHEN UPPER(base_currency) = 'BUSD' THEN 4
            ELSE 0
        END
        WHERE base_currency IS NOT NULL
    """))
    
    # Синхронизируем emulator с is_emulator
    conn.execute(sa.text("""
        UPDATE moonbot_orders 
        SET emulator = CASE WHEN is_emulator = 1 THEN 1 ELSE 0 END
    """))
    
    # SQLite не поддерживает ALTER COLUMN напрямую, поэтому создаём новую таблицу
    # с правильной структурой и копируем данные
    
    # Создаём временную таблицу с новой структурой
    op.create_table('moonbot_orders_new',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=False),
        sa.Column('moonbot_order_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('buy_price', sa.Float(), nullable=True),
        sa.Column('sell_price', sa.Float(), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('spent_btc', sa.Float(), nullable=True),
        sa.Column('gained_btc', sa.Float(), nullable=True),
        sa.Column('profit_btc', sa.Float(), nullable=True),
        sa.Column('profit_percent', sa.Float(), nullable=True),
        sa.Column('sell_reason', sa.Text(), nullable=True),
        sa.Column('strategy', sa.String(), nullable=True),
        
        # Новые типы для временных меток
        sa.Column('buy_date', sa.Integer(), nullable=True),
        sa.Column('sell_set_date', sa.Integer(), nullable=True),
        sa.Column('close_date', sa.Integer(), nullable=True),
        
        # Новый тип для base_currency
        sa.Column('base_currency', sa.Integer(), nullable=True),
        
        # Метаданные и источники
        sa.Column('source', sa.Integer(), nullable=True),
        sa.Column('channel', sa.Integer(), nullable=True),
        sa.Column('channel_name', sa.String(), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('strategy_id', sa.Integer(), nullable=True),
        
        # Расширенные метрики
        sa.Column('is_emulator', sa.Boolean(), nullable=True),
        sa.Column('emulator', sa.Integer(), nullable=True),
        sa.Column('signal_type', sa.String(), nullable=True),
        sa.Column('safety_orders_used', sa.Integer(), nullable=True),
        sa.Column('latency', sa.Integer(), nullable=True),
        sa.Column('ping', sa.Integer(), nullable=True),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('bought_so', sa.Integer(), nullable=True),
        sa.Column('btc_in_delta', sa.Float(), nullable=True),
        sa.Column('price_blow', sa.Boolean(), nullable=True),
        sa.Column('daily_vol', sa.String(), nullable=True),
        sa.Column('ex_order_id', sa.String(), nullable=True),
        
        # Файлы и состояние
        sa.Column('fname', sa.String(), nullable=True),
        sa.Column('deleted', sa.Integer(), nullable=True),
        sa.Column('imp', sa.Integer(), nullable=True),
        
        # Рыночные данные
        sa.Column('bought_q', sa.Float(), nullable=True),
        sa.Column('btc_1h_delta', sa.Float(), nullable=True),
        sa.Column('btc_24h_delta', sa.Float(), nullable=True),
        sa.Column('btc_5m_delta', sa.Float(), nullable=True),
        sa.Column('dbtc_1m', sa.Float(), nullable=True),
        sa.Column('exchange_1h_delta', sa.Float(), nullable=True),
        sa.Column('exchange_24h_delta', sa.Float(), nullable=True),
        
        # Pump & Dump
        sa.Column('pump_1h', sa.Float(), nullable=True),
        sa.Column('dump_1h', sa.Float(), nullable=True),
        
        # Детальные дельты
        sa.Column('d24h', sa.Float(), nullable=True),
        sa.Column('d3h', sa.Float(), nullable=True),
        sa.Column('d1h', sa.Float(), nullable=True),
        sa.Column('d15m', sa.Float(), nullable=True),
        sa.Column('d5m', sa.Float(), nullable=True),
        sa.Column('d1m', sa.Float(), nullable=True),
        
        # Технические параметры
        sa.Column('price_bug', sa.Float(), nullable=True),
        sa.Column('vd1m', sa.Float(), nullable=True),
        sa.Column('lev', sa.Integer(), nullable=True),
        sa.Column('bvsv_ratio', sa.Float(), nullable=True),
        sa.Column('is_short', sa.Integer(), nullable=True),
        
        # Объёмы
        sa.Column('hvol', sa.Float(), nullable=True),
        sa.Column('hvolf', sa.Float(), nullable=True),
        sa.Column('dvol', sa.Float(), nullable=True),
        
        # Временные метки (наши)
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        
        # Дополнительные
        sa.Column('created_from_update', sa.Boolean(), nullable=True),
        sa.Column('bot_name', sa.String(), nullable=True),
        
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Копируем данные из старой таблицы в новую
    conn.execute(sa.text("""
        INSERT INTO moonbot_orders_new 
        SELECT 
            id, server_id, moonbot_order_id, symbol, buy_price, sell_price, quantity, status,
            spent_btc, gained_btc, profit_btc, profit_percent, sell_reason, strategy,
            buy_date_int AS buy_date,
            sell_set_date,
            close_date_int AS close_date,
            base_currency_int AS base_currency,
            source, channel, channel_name, comment, strategy_id,
            is_emulator, emulator, signal_type, safety_orders_used, latency, ping, task_id,
            bought_so, btc_in_delta, price_blow, daily_vol, ex_order_id,
            fname, deleted, imp,
            bought_q, btc_1h_delta, btc_24h_delta, btc_5m_delta, dbtc_1m,
            exchange_1h_delta, exchange_24h_delta,
            pump_1h, dump_1h,
            d24h, d3h, d1h, d15m, d5m, d1m,
            price_bug, vd1m, lev, bvsv_ratio, is_short,
            hvol, hvolf, dvol,
            opened_at, closed_at, created_at, updated_at,
            created_from_update, bot_name
        FROM moonbot_orders
    """))
    
    # Удаляем старую таблицу
    op.drop_table('moonbot_orders')
    
    # Переименовываем новую таблицу
    op.rename_table('moonbot_orders_new', 'moonbot_orders')
    
    # Создаём индексы
    op.create_index(op.f('ix_moonbot_orders_moonbot_order_id'), 'moonbot_orders', ['moonbot_order_id'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_symbol'), 'moonbot_orders', ['symbol'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_status'), 'moonbot_orders', ['status'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_is_emulator'), 'moonbot_orders', ['is_emulator'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_bot_name'), 'moonbot_orders', ['bot_name'], unique=False)
    op.create_index('idx_server_order', 'moonbot_orders', ['server_id', 'moonbot_order_id'], unique=True)


def downgrade():
    """Откат миграции"""
    
    # Создаём таблицу со старой структурой
    op.create_table('moonbot_orders_old',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('server_id', sa.Integer(), nullable=False),
        sa.Column('moonbot_order_id', sa.Integer(), nullable=False),
        sa.Column('symbol', sa.String(), nullable=False),
        sa.Column('buy_price', sa.Float(), nullable=True),
        sa.Column('sell_price', sa.Float(), nullable=True),
        sa.Column('quantity', sa.Float(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('spent_btc', sa.Float(), nullable=True),
        sa.Column('gained_btc', sa.Float(), nullable=True),
        sa.Column('profit_btc', sa.Float(), nullable=True),
        sa.Column('profit_percent', sa.Float(), nullable=True),
        sa.Column('sell_reason', sa.Text(), nullable=True),
        sa.Column('strategy', sa.String(), nullable=True),
        sa.Column('close_date', sa.DateTime(), nullable=True),  # Обратно DateTime
        sa.Column('is_emulator', sa.Boolean(), nullable=True),
        sa.Column('signal_type', sa.String(), nullable=True),
        sa.Column('base_currency', sa.String(), nullable=True),  # Обратно String
        sa.Column('safety_orders_used', sa.Integer(), nullable=True),
        sa.Column('latency', sa.Integer(), nullable=True),
        sa.Column('ping', sa.Integer(), nullable=True),
        sa.Column('task_id', sa.Integer(), nullable=True),
        sa.Column('exchange_1h_delta', sa.Float(), nullable=True),
        sa.Column('exchange_24h_delta', sa.Float(), nullable=True),
        sa.Column('bought_so', sa.Integer(), nullable=True),
        sa.Column('btc_in_delta', sa.Float(), nullable=True),
        sa.Column('price_blow', sa.Boolean(), nullable=True),
        sa.Column('daily_vol', sa.String(), nullable=True),
        sa.Column('ex_order_id', sa.String(), nullable=True),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_from_update', sa.Boolean(), nullable=True),
        sa.Column('buy_date', sa.DateTime(), nullable=True),  # Обратно DateTime
        sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Копируем данные обратно с конвертацией типов
    conn = op.get_bind()
    conn.execute(sa.text("""
        INSERT INTO moonbot_orders_old 
        SELECT 
            id, server_id, moonbot_order_id, symbol, buy_price, sell_price, quantity, status,
            spent_btc, gained_btc, profit_btc, profit_percent, sell_reason, strategy,
            datetime(close_date, 'unixepoch') AS close_date,
            is_emulator, signal_type,
            CASE base_currency
                WHEN 0 THEN 'USDT'
                WHEN 1 THEN 'BTC'
                WHEN 2 THEN 'TRY'
                WHEN 3 THEN 'EUR'
                WHEN 4 THEN 'BUSD'
                ELSE 'USDT'
            END AS base_currency,
            safety_orders_used, latency, ping, task_id, exchange_1h_delta, exchange_24h_delta,
            bought_so, btc_in_delta, price_blow, daily_vol, ex_order_id,
            opened_at, closed_at, created_at, updated_at, created_from_update,
            datetime(buy_date, 'unixepoch') AS buy_date
        FROM moonbot_orders
    """))
    
    # Удаляем новую таблицу
    op.drop_table('moonbot_orders')
    
    # Переименовываем старую таблицу
    op.rename_table('moonbot_orders_old', 'moonbot_orders')
    
    # Восстанавливаем индексы
    op.create_index(op.f('ix_moonbot_orders_moonbot_order_id'), 'moonbot_orders', ['moonbot_order_id'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_symbol'), 'moonbot_orders', ['symbol'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_status'), 'moonbot_orders', ['status'], unique=False)
    op.create_index(op.f('ix_moonbot_orders_is_emulator'), 'moonbot_orders', ['is_emulator'], unique=False)
    op.create_index('idx_server_order', 'moonbot_orders', ['server_id', 'moonbot_order_id'], unique=True)

