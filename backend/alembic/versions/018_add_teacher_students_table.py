"""add_teacher_students_table

Revision ID: 018
Revises: 017
Create Date: 2026-01-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '018_add_teacher_students_table'
down_revision: Union[str, None] = '017_trans_created_by'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create teacher_students table for direct teacher-student assignments
    op.create_table(
        'teacher_students',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('teacher_id', 'student_id', name='uq_teacher_student'),
    )

    # Create indexes for better query performance
    op.create_index('ix_teacher_students_teacher_id', 'teacher_students', ['teacher_id'])
    op.create_index('ix_teacher_students_student_id', 'teacher_students', ['student_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_teacher_students_student_id', table_name='teacher_students')
    op.drop_index('ix_teacher_students_teacher_id', table_name='teacher_students')

    # Drop table
    op.drop_table('teacher_students')
