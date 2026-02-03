"""add_vocabulary_block_type

Revision ID: 022
Revises: 021
Create Date: 2026-02-03 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '022_add_vocabulary_block_type'
down_revision: Union[str, None] = '021_add_block_title'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'vocabulary' value to exerciseblocktype enum
    op.execute("ALTER TYPE exerciseblocktype ADD VALUE IF NOT EXISTS 'vocabulary'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # This would require recreating the enum type
    pass
