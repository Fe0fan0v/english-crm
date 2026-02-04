"""add_course_topics

Revision ID: 023
Revises: 022
Create Date: 2026-02-04 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '023_add_course_topics'
down_revision: Union[str, None] = '022_add_vocabulary_block_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create course_topics table
    op.create_table(
        'course_topics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('section_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['section_id'], ['course_sections.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_course_topics_id', 'course_topics', ['id'])

    # Add topic_id to interactive_lessons
    op.add_column(
        'interactive_lessons',
        sa.Column('topic_id', sa.Integer(), nullable=True)
    )
    op.create_foreign_key(
        'fk_interactive_lessons_topic_id',
        'interactive_lessons',
        'course_topics',
        ['topic_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # Make section_id nullable (for backward compatibility)
    op.alter_column(
        'interactive_lessons',
        'section_id',
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade() -> None:
    # Make section_id not nullable again
    op.alter_column(
        'interactive_lessons',
        'section_id',
        existing_type=sa.Integer(),
        nullable=False
    )

    # Remove topic_id from interactive_lessons
    op.drop_constraint('fk_interactive_lessons_topic_id', 'interactive_lessons', type_='foreignkey')
    op.drop_column('interactive_lessons', 'topic_id')

    # Drop course_topics table
    op.drop_index('ix_course_topics_id', 'course_topics')
    op.drop_table('course_topics')
