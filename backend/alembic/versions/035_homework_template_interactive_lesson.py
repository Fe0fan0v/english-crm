"""homework_template_interactive_lesson

Revision ID: 035_homework_template_interactive_lesson
Revises: 034_standalone_homework_lessons
Create Date: 2026-03-07 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "035_homework_template_interactive_lesson"
down_revision: Union[str, None] = "034_standalone_homework_lessons"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add interactive_lesson_id to homework_templates
    op.add_column(
        "homework_templates",
        sa.Column(
            "interactive_lesson_id",
            sa.Integer(),
            sa.ForeignKey("interactive_lessons.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_homework_templates_interactive_lesson",
        "homework_templates",
        ["interactive_lesson_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_homework_templates_interactive_lesson",
        table_name="homework_templates",
    )
    op.drop_column("homework_templates", "interactive_lesson_id")
