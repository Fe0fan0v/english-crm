"""cleanup_standalone_hw_assignments

Revision ID: 037_cleanup_standalone_hw_assignments
Revises: 036_publish_all_lessons
Create Date: 2026-03-10 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "037_cleanup_standalone_hw_assignments"
down_revision: str = "036_publish_all_lessons"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Delete homework assignments that point to standalone lessons
    # (created by auto-assignment bug — standalone templates shouldn't be auto-assigned)
    op.execute("""
        DELETE FROM homework_assignments
        WHERE interactive_lesson_id IN (
            SELECT id FROM interactive_lessons WHERE is_standalone = true
        )
    """)

    # Delete legacy HomeworkTemplateItems that point to standalone lessons
    op.execute("""
        DELETE FROM homework_template_items
        WHERE interactive_lesson_id IN (
            SELECT id FROM interactive_lessons WHERE is_standalone = true
        )
    """)


def downgrade() -> None:
    pass
