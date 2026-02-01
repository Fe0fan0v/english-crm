"""fix userrole enum values to lowercase

Revision ID: 008_fix_userrole_enum
Revises: 007_fix_lessonstatus_enum
Create Date: 2026-01-20

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '008_fix_userrole_enum'
down_revision: Union[str, None] = '007_fix_lessonstatus_enum'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Convert uppercase values to lowercase if they exist
    # If enum was created with lowercase values (from initial migration), skip
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ADMIN' AND enumtypid = 'userrole'::regtype) THEN
                ALTER TYPE userrole RENAME VALUE 'ADMIN' TO 'admin';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'MANAGER' AND enumtypid = 'userrole'::regtype) THEN
                ALTER TYPE userrole RENAME VALUE 'MANAGER' TO 'manager';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TEACHER' AND enumtypid = 'userrole'::regtype) THEN
                ALTER TYPE userrole RENAME VALUE 'TEACHER' TO 'teacher';
            END IF;
            IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'STUDENT' AND enumtypid = 'userrole'::regtype) THEN
                ALTER TYPE userrole RENAME VALUE 'STUDENT' TO 'student';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # Convert back to uppercase
    op.execute("ALTER TYPE userrole RENAME VALUE 'admin' TO 'ADMIN'")
    op.execute("ALTER TYPE userrole RENAME VALUE 'manager' TO 'MANAGER'")
    op.execute("ALTER TYPE userrole RENAME VALUE 'teacher' TO 'TEACHER'")
    op.execute("ALTER TYPE userrole RENAME VALUE 'student' TO 'STUDENT'")
