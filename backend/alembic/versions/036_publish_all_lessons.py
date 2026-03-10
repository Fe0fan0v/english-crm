"""publish_all_lessons

Revision ID: 036_publish_all_lessons
Revises: 035_homework_template_interactive_lesson
Create Date: 2026-03-10 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "036_publish_all_lessons"
down_revision: str = "035_homework_template_interactive_lesson"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Publish all unpublished interactive lessons
    op.execute("UPDATE interactive_lessons SET is_published = true WHERE is_published = false")


def downgrade() -> None:
    pass
