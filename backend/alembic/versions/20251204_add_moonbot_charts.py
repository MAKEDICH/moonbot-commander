"""Add moonbot_charts table

Revision ID: 20251204_charts
Revises: 20251127_012312_add_missing_order_fields
Create Date: 2025-12-04

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251204_charts'
down_revision = '20251127_012312_add_missing_order_fields'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаём таблицу moonbot_charts если она не существует
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'moonbot_charts' not in inspector.get_table_names():
        op.create_table(
            'moonbot_charts',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('server_id', sa.Integer(), nullable=False),
            sa.Column('order_db_id', sa.Integer(), nullable=False),
            sa.Column('market_name', sa.String(), nullable=True),
            sa.Column('market_currency', sa.String(), nullable=True),
            sa.Column('pump_channel', sa.String(), nullable=True),
            sa.Column('start_time', sa.DateTime(), nullable=True),
            sa.Column('end_time', sa.DateTime(), nullable=True),
            sa.Column('session_profit', sa.Float(), nullable=True),
            sa.Column('chart_data', sa.Text(), nullable=True),
            sa.Column('raw_data', sa.Text(), nullable=True),
            sa.Column('received_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['server_id'], ['servers.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('ix_moonbot_charts_id', 'moonbot_charts', ['id'], unique=False)
        op.create_index('ix_moonbot_charts_server_order', 'moonbot_charts', ['server_id', 'order_db_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_moonbot_charts_server_order', table_name='moonbot_charts')
    op.drop_index('ix_moonbot_charts_id', table_name='moonbot_charts')
    op.drop_table('moonbot_charts')



