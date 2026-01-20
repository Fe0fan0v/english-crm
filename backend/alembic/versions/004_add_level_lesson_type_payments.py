"""Add level_lesson_type_payments table

Revision ID: 004_add_level_lesson_type_payments
Revises: 003_add_group_messages
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '004_add_level_lesson_type_payments'
down_revision: Union[str, None] = '003_add_group_messages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create level_lesson_type_payments table
    # This table stores the payment amount for teachers
    # for each combination of level and lesson type
    op.create_table(
        'level_lesson_type_payments',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('level_id', sa.Integer(), nullable=False),
        sa.Column('lesson_type_id', sa.Integer(), nullable=False),
        sa.Column('teacher_payment', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['level_id'], ['levels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lesson_type_id'], ['lesson_types.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('level_id', 'lesson_type_id', name='uq_level_lesson_type')
    )

    # Create indexes for faster lookups
    op.create_index('ix_level_lesson_type_payments_level_id', 'level_lesson_type_payments', ['level_id'])
    op.create_index('ix_level_lesson_type_payments_lesson_type_id', 'level_lesson_type_payments', ['lesson_type_id'])


def downgrade() -> None:
    op.drop_index('ix_level_lesson_type_payments_lesson_type_id', table_name='level_lesson_type_payments')
    op.drop_index('ix_level_lesson_type_payments_level_id', table_name='level_lesson_type_payments')
    op.drop_table('level_lesson_type_payments')
