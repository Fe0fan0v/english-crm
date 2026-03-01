"""add_sentence_choice_block_type

Revision ID: 033_add_sentence_choice_block_type
Revises: 032_add_homework_templates
Create Date: 2026-03-01 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "033_add_sentence_choice_block_type"
down_revision: Union[str, None] = "032_add_homework_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE exerciseblocktype ADD VALUE IF NOT EXISTS 'sentence_choice'")


def downgrade() -> None:
    pass  # Cannot remove enum values in PostgreSQL
