"""add_default_whatsapp_setting

Revision ID: 016
Revises: 015
Create Date: 2026-01-25 14:35:16.322335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '016'
down_revision: Union[str, None] = '015'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insert default whatsapp_manager_phone setting if it doesn't exist
    op.execute("""
        INSERT INTO settings (key, value, created_at, updated_at)
        SELECT 'whatsapp_manager_phone', '+77001234567', NOW(), NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM settings WHERE key = 'whatsapp_manager_phone'
        )
    """)


def downgrade() -> None:
    # Remove the default setting
    op.execute("DELETE FROM settings WHERE key = 'whatsapp_manager_phone'")
