"""Add file_url to messages

Revision ID: 012_add_file_url_to_messages
Revises: 011_add_direct_messages
Create Date: 2026-01-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "012_add_file_url_to_messages"
down_revision = "011_add_direct_messages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add file_url to group_messages
    op.add_column(
        "group_messages",
        sa.Column("file_url", sa.String(500), nullable=True),
    )

    # Add file_url to direct_messages
    op.add_column(
        "direct_messages",
        sa.Column("file_url", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("direct_messages", "file_url")
    op.drop_column("group_messages", "file_url")
