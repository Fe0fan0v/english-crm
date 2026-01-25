"""add_lesson_materials_table

Revision ID: 015_add_lesson_materials
Revises: 014_add_news_table
Create Date: 2026-01-25

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "015_add_lesson_materials"
down_revision: Union[str, None] = "014_add_news_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create lesson_materials table
    op.create_table(
        "lesson_materials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lesson_id", sa.Integer(), nullable=False),
        sa.Column("material_id", sa.Integer(), nullable=False),
        sa.Column("attached_by", sa.Integer(), nullable=False),
        sa.Column(
            "attached_at",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["lesson_id"], ["lessons.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["material_id"], ["materials.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["attached_by"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lesson_id", "material_id", name="uq_lesson_material"),
    )
    op.create_index(
        op.f("ix_lesson_materials_id"), "lesson_materials", ["id"], unique=False
    )
    op.create_index(
        op.f("ix_lesson_materials_lesson_id"),
        "lesson_materials",
        ["lesson_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_lesson_materials_material_id"),
        "lesson_materials",
        ["material_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lesson_materials_material_id"), table_name="lesson_materials"
    )
    op.drop_index(op.f("ix_lesson_materials_lesson_id"), table_name="lesson_materials")
    op.drop_index(op.f("ix_lesson_materials_id"), table_name="lesson_materials")
    op.drop_table("lesson_materials")
