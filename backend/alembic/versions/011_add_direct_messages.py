"""Add direct_messages table

Revision ID: 011
Revises: 010
Create Date: 2026-01-21
"""
from alembic import op
import sqlalchemy as sa


revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "direct_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recipient_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_direct_messages_id", "direct_messages", ["id"])
    op.create_index("ix_direct_messages_sender_id", "direct_messages", ["sender_id"])
    op.create_index("ix_direct_messages_recipient_id", "direct_messages", ["recipient_id"])
    op.create_index("ix_direct_messages_created_at", "direct_messages", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_direct_messages_created_at", table_name="direct_messages")
    op.drop_index("ix_direct_messages_recipient_id", table_name="direct_messages")
    op.drop_index("ix_direct_messages_sender_id", table_name="direct_messages")
    op.drop_index("ix_direct_messages_id", table_name="direct_messages")
    op.drop_table("direct_messages")
