"""add_homework_assignments

Revision ID: 031
Revises: 030
Create Date: 2026-02-26 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "031_add_homework_assignments"
down_revision: Union[str, None] = "030_add_drag_words_block_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create homeworkstatus enum
    op.execute("CREATE TYPE homeworkstatus AS ENUM ('pending', 'submitted', 'accepted')")

    # Create homework_assignments table
    op.create_table(
        "homework_assignments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "lesson_id",
            sa.Integer(),
            sa.ForeignKey("lessons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "interactive_lesson_id",
            sa.Integer(),
            sa.ForeignKey("interactive_lessons.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "student_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "assigned_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("pending", "submitted", "accepted", name="homeworkstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "assigned_at", sa.DateTime(), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("accepted_at", sa.DateTime(), nullable=True),
        sa.UniqueConstraint(
            "lesson_id",
            "interactive_lesson_id",
            "student_id",
            name="uq_homework_lesson_interactive_student",
        ),
    )


def downgrade() -> None:
    op.drop_table("homework_assignments")
    op.execute("DROP TYPE IF EXISTS homeworkstatus")
