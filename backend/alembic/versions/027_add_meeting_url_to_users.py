"""add_meeting_url_to_users

Revision ID: 027_add_meeting_url_to_users
Revises: 026_add_exercise_results
Create Date: 2026-02-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "027_add_meeting_url_to_users"
down_revision: Union[str, None] = "026_add_exercise_results"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("meeting_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "meeting_url")
