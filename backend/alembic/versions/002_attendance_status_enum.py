"""change attended to attendance_status enum

Revision ID: 002_attendance_status
Revises: 001_add_groups
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '002_attendance_status'
down_revision: Union[str, None] = '001_add_groups'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type
    attendance_status_enum = sa.Enum(
        'pending', 'present', 'absent_excused', 'absent_unexcused',
        name='attendancestatus'
    )
    attendance_status_enum.create(op.get_bind(), checkfirst=True)

    # Add new column attendance_status
    op.add_column(
        'lesson_students',
        sa.Column(
            'attendance_status',
            sa.Enum('pending', 'present', 'absent_excused', 'absent_unexcused', name='attendancestatus'),
            nullable=True
        )
    )

    # Add charged column to track if student was charged for the lesson
    op.add_column(
        'lesson_students',
        sa.Column('charged', sa.Boolean(), nullable=False, server_default='false')
    )

    # Migrate existing data: attended=True -> 'present', attended=False -> 'pending'
    op.execute("""
        UPDATE lesson_students
        SET attendance_status = CASE
            WHEN attended = true THEN 'present'::attendancestatus
            ELSE 'pending'::attendancestatus
        END
    """)

    # Make attendance_status non-nullable
    op.alter_column('lesson_students', 'attendance_status', nullable=False)

    # Drop the old attended column
    op.drop_column('lesson_students', 'attended')


def downgrade() -> None:
    # Add back the attended column
    op.add_column(
        'lesson_students',
        sa.Column('attended', sa.Boolean(), nullable=False, server_default='false')
    )

    # Migrate data back: present -> True, everything else -> False
    op.execute("""
        UPDATE lesson_students
        SET attended = CASE
            WHEN attendance_status = 'present' THEN true
            ELSE false
        END
    """)

    # Drop attendance_status column
    op.drop_column('lesson_students', 'attendance_status')

    # Drop charged column
    op.drop_column('lesson_students', 'charged')

    # Drop the enum type
    op.execute("DROP TYPE IF EXISTS attendancestatus")
