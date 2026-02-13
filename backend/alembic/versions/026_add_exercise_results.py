"""add_exercise_results

Revision ID: 026
Revises: 025_add_vocabulary_words
Create Date: 2026-02-13 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '026_add_exercise_results'
down_revision: Union[str, None] = '025_add_vocabulary_words'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exercise_results',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('block_id', sa.Integer(), sa.ForeignKey('exercise_blocks.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('lesson_id', sa.Integer(), sa.ForeignKey('interactive_lessons.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('answer', JSONB(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('student_id', 'block_id', name='uq_exercise_result_student_block'),
    )


def downgrade() -> None:
    op.drop_table('exercise_results')
