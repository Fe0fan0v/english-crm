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
    # Create homeworkstatus enum only if it doesn't already exist
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_type WHERE typname = 'homeworkstatus'")
    )
    if not result.fetchone():
        op.execute("CREATE TYPE homeworkstatus AS ENUM ('pending', 'submitted', 'accepted')")

    # Create homework_assignments table using raw SQL to avoid
    # SQLAlchemy sa.Enum auto-creating the type (fails with asyncpg if exists)
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS homework_assignments (
            id SERIAL PRIMARY KEY,
            lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
            interactive_lesson_id INTEGER NOT NULL REFERENCES interactive_lessons(id) ON DELETE CASCADE,
            student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status homeworkstatus NOT NULL DEFAULT 'pending',
            assigned_at TIMESTAMP NOT NULL DEFAULT now(),
            submitted_at TIMESTAMP,
            accepted_at TIMESTAMP,
            CONSTRAINT uq_homework_lesson_interactive_student
                UNIQUE (lesson_id, interactive_lesson_id, student_id)
        )
    """))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_homework_assignments_lesson_id ON homework_assignments (lesson_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_homework_assignments_interactive_lesson_id ON homework_assignments (interactive_lesson_id)"))
    op.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_homework_assignments_student_id ON homework_assignments (student_id)"))


def downgrade() -> None:
    op.drop_table("homework_assignments")
    op.execute("DROP TYPE IF EXISTS homeworkstatus")
