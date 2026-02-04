"""add_topic_to_lesson_course_materials

Revision ID: 024
Revises: 023
Create Date: 2026-02-04 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '024_add_topic_to_lesson_course_materials'
down_revision: Union[str, None] = '023_add_course_topics'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add topic_id column to lesson_course_materials
    op.add_column(
        'lesson_course_materials',
        sa.Column('topic_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_lesson_course_materials_topic_id',
        'lesson_course_materials',
        'course_topics',
        ['topic_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Update enum to include 'topic'
    # PostgreSQL requires altering the enum type
    op.execute("ALTER TYPE coursematerialtype ADD VALUE IF NOT EXISTS 'topic'")


def downgrade() -> None:
    # Remove foreign key and column
    op.drop_constraint('fk_lesson_course_materials_topic_id', 'lesson_course_materials', type_='foreignkey')
    op.drop_column('lesson_course_materials', 'topic_id')

    # Note: PostgreSQL does not support removing enum values easily
    # You would need to recreate the enum type without 'topic'
    # For simplicity, we'll leave the enum value in downgrade
