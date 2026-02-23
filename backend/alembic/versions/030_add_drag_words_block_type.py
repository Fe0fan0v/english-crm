"""add_drag_words_block_type

Revision ID: 030
Revises: 029
Create Date: 2026-02-23 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "030_add_drag_words_block_type"
down_revision: Union[str, None] = "029_lowercase_emails_and_material_folders"
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'drag_words' value to exerciseblocktype enum
    op.execute("ALTER TYPE exerciseblocktype ADD VALUE IF NOT EXISTS 'drag_words'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass
