"""Add last_errors_viewed_at to user_settings

Revision ID: 20251205_errors_viewed
Revises: 20251204_charts
Create Date: 2025-12-05

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251205_errors_viewed'
down_revision = '20251204_charts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Добавляем столбец last_errors_viewed_at в таблицу user_settings
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Проверяем существование таблицы
    if 'user_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('user_settings')]
        
        # Добавляем столбец только если его нет
        if 'last_errors_viewed_at' not in columns:
            op.add_column('user_settings', 
                sa.Column('last_errors_viewed_at', sa.DateTime(), nullable=True)
            )


def downgrade() -> None:
    # Удаляем столбец при откате
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    if 'user_settings' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('user_settings')]
        
        if 'last_errors_viewed_at' in columns:
            op.drop_column('user_settings', 'last_errors_viewed_at')


