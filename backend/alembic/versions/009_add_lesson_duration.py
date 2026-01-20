"""add lesson duration_minutes field

Revision ID: 009_add_lesson_duration
Revises: 008_fix_userrole_enum
Create Date: 2026-01-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '009_add_lesson_duration'
down_revision: Union[str, None] = '008_fix_userrole_enum'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add duration_minutes column with default value of 60
    op.add_column(
        'lessons',
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='60')
    )


def downgrade() -> None:
    op.drop_column('lessons', 'duration_minutes')
