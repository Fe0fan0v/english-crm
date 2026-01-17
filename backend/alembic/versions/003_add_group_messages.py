"""add group_messages table for group chat

Revision ID: 003_add_group_messages
Revises: 002_attendance_status
Create Date: 2026-01-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '003_add_group_messages'
down_revision: Union[str, None] = '002_attendance_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create group_messages table
    op.create_table(
        'group_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_group_messages_id'), 'group_messages', ['id'], unique=False)
    op.create_index(op.f('ix_group_messages_group_id'), 'group_messages', ['group_id'], unique=False)
    op.create_index(op.f('ix_group_messages_created_at'), 'group_messages', ['created_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_group_messages_created_at'), table_name='group_messages')
    op.drop_index(op.f('ix_group_messages_group_id'), table_name='group_messages')
    op.drop_index(op.f('ix_group_messages_id'), table_name='group_messages')
    op.drop_table('group_messages')
