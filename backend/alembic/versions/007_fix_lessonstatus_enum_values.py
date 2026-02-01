"""fix lessonstatus enum values to lowercase

Revision ID: 007_fix_lessonstatus_enum
Revises: 006_add_notifications
Create Date: 2026-01-20

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '007_fix_lessonstatus_enum'
down_revision: Union[str, None] = '006_add_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # PostgreSQL allows renaming enum values with ALTER TYPE
    # Convert uppercase values to lowercase if they exist
    # If enum was created with lowercase values (from initial migration), skip
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'SCHEDULED' AND enumtypid = 'lessonstatus'::regtype) THEN
                ALTER TYPE lessonstatus RENAME VALUE 'SCHEDULED' TO 'scheduled';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COMPLETED' AND enumtypid = 'lessonstatus'::regtype) THEN
                ALTER TYPE lessonstatus RENAME VALUE 'COMPLETED' TO 'completed';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'CANCELLED' AND enumtypid = 'lessonstatus'::regtype) THEN
                ALTER TYPE lessonstatus RENAME VALUE 'CANCELLED' TO 'cancelled';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'NO_SHOW' AND enumtypid = 'lessonstatus'::regtype) THEN
                ALTER TYPE lessonstatus RENAME VALUE 'NO_SHOW' TO 'no_show';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Convert back to uppercase
    op.execute("ALTER TYPE lessonstatus RENAME VALUE 'scheduled' TO 'SCHEDULED'")
    op.execute("ALTER TYPE lessonstatus RENAME VALUE 'completed' TO 'COMPLETED'")
    op.execute("ALTER TYPE lessonstatus RENAME VALUE 'cancelled' TO 'CANCELLED'")
    op.execute("ALTER TYPE lessonstatus RENAME VALUE 'no_show' TO 'NO_SHOW'")
