"""add_page_break_block_type

Revision ID: 028
Revises: 027
Create Date: 2026-02-18 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "028_add_page_break_block_type"
down_revision: Union[str, None] = "027_add_meeting_url_to_users"
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'page_break' value to exerciseblocktype enum
    op.execute("ALTER TYPE exerciseblocktype ADD VALUE IF NOT EXISTS 'page_break'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    pass
