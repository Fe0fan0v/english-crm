"""add_block_title

Revision ID: 021
Revises: 020
Create Date: 2026-02-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '021_add_block_title'
down_revision: Union[str, None] = '020_add_lesson_course_materials'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add title column to exercise_blocks table
    op.add_column(
        'exercise_blocks',
        sa.Column('title', sa.String(255), nullable=True)
    )


def downgrade() -> None:
    # Remove title column from exercise_blocks table
    op.drop_column('exercise_blocks', 'title')
