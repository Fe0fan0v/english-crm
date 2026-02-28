"""add_homework_templates

Revision ID: 032_add_homework_templates
Revises: 031_add_homework_assignments
Create Date: 2026-02-28 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "032_add_homework_templates"
down_revision: Union[str, None] = "031_add_homework_assignments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "homework_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column(
            "course_id",
            sa.Integer(),
            sa.ForeignKey("courses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_homework_templates_course_id", "homework_templates", ["course_id"])

    op.create_table(
        "homework_template_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "template_id",
            sa.Integer(),
            sa.ForeignKey("homework_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "interactive_lesson_id",
            sa.Integer(),
            sa.ForeignKey("interactive_lessons.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "template_id",
            "interactive_lesson_id",
            name="uq_template_interactive_lesson",
        ),
    )
    op.create_index(
        "ix_homework_template_items_template_id",
        "homework_template_items",
        ["template_id"],
    )


def downgrade() -> None:
    op.drop_table("homework_template_items")
    op.drop_table("homework_templates")
