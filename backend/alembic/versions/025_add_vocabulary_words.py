"""add_vocabulary_words

Revision ID: 025
Revises: 024
Create Date: 2026-02-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '025_add_vocabulary_words'
down_revision: Union[str, None] = '024_add_topic_to_lesson_course_materials'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'vocabulary_words',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('english', sa.String(255), nullable=False),
        sa.Column('translation', sa.String(255), nullable=False),
        sa.Column('transcription', sa.String(255), nullable=True),
        sa.Column('example', sa.Text(), nullable=True),
        sa.Column('added_by_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('vocabulary_words')
