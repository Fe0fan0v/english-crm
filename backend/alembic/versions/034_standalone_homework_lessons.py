"""standalone_homework_lessons

Revision ID: 034_standalone_homework_lessons
Revises: 033_add_sentence_choice_block_type
Create Date: 2026-03-01 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "034_standalone_homework_lessons"
down_revision: Union[str, None] = "033_add_sentence_choice_block_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "interactive_lessons",
        sa.Column("is_standalone", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index(
        "ix_interactive_lessons_standalone",
        "interactive_lessons",
        ["is_standalone", "created_by_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_interactive_lessons_standalone", table_name="interactive_lessons")
    op.drop_column("interactive_lessons", "is_standalone")
