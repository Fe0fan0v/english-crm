"""add_created_by_to_transactions

Revision ID: 017
Revises: 016
Create Date: 2026-01-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '017_add_created_by_to_transactions'
down_revision: Union[str, None] = '016_add_default_whatsapp_setting'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add created_by_id column to transactions table
    op.add_column(
        'transactions',
        sa.Column('created_by_id', sa.Integer(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_transactions_created_by_id_users',
        'transactions',
        'users',
        ['created_by_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Create index for better query performance
    op.create_index(
        'ix_transactions_created_by_id',
        'transactions',
        ['created_by_id']
    )


def downgrade() -> None:
    # Drop index
    op.drop_index('ix_transactions_created_by_id', table_name='transactions')

    # Drop foreign key
    op.drop_constraint(
        'fk_transactions_created_by_id_users',
        'transactions',
        type_='foreignkey'
    )

    # Drop column
    op.drop_column('transactions', 'created_by_id')
