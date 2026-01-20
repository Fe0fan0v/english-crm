"""add teacher availability table

Revision ID: 010_add_teacher_availability
Revises: 009_add_lesson_duration
Create Date: 2026-01-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '010_add_teacher_availability'
down_revision: Union[str, None] = '009_add_lesson_duration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create teacher_availability table
    op.create_table(
        'teacher_availability',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('teacher_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.String(20), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.ForeignKeyConstraint(['teacher_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_teacher_availability_id'), 'teacher_availability', ['id'], unique=False)
    op.create_index(op.f('ix_teacher_availability_teacher_id'), 'teacher_availability', ['teacher_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_teacher_availability_teacher_id'), table_name='teacher_availability')
    op.drop_index(op.f('ix_teacher_availability_id'), table_name='teacher_availability')
    op.drop_table('teacher_availability')
