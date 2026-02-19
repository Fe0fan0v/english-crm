"""lowercase_emails_and_material_folders

Revision ID: 029
Revises: 028
Create Date: 2026-02-19 12:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "029_lowercase_emails_and_material_folders"
down_revision: Union[str, None] = "028_add_page_break_block_type"
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Normalize existing emails to lowercase
    op.execute("UPDATE users SET email = LOWER(TRIM(email))")

    # 2. Create material_folders table
    op.create_table(
        "material_folders",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # 3. Add folder_id to materials
    op.add_column(
        "materials",
        sa.Column("folder_id", sa.Integer(), sa.ForeignKey("material_folders.id"), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("materials", "folder_id")
    op.drop_table("material_folders")
