"""Add group_id to lessons table

Revision ID: 005_add_group_id_to_lessons
Revises: 004_add_level_lesson_type_payments
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '005_add_group_id_to_lessons'
down_revision: Union[str, None] = '004_add_level_lesson_type_payments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add group_id column to lessons table
    op.add_column(
        'lessons',
        sa.Column('group_id', sa.Integer(), nullable=True)
    )

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_lessons_group_id',
        'lessons',
        'groups',
        ['group_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # Add index for faster lookups
    op.create_index('ix_lessons_group_id', 'lessons', ['group_id'])


def downgrade() -> None:
    op.drop_index('ix_lessons_group_id', table_name='lessons')
    op.drop_constraint('fk_lessons_group_id', 'lessons', type_='foreignkey')
    op.drop_column('lessons', 'group_id')
