"""add source_lesson_id to homework_templates

Revision ID: 038_add_source_lesson_to_homework_templates
Revises: 037_cleanup_standalone_hw_assignments
Create Date: 2026-03-13
"""
from alembic import op
import sqlalchemy as sa

revision = "038_add_source_lesson_to_homework_templates"
down_revision = "037_cleanup_standalone_hw_assignments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "homework_templates",
        sa.Column("source_lesson_id", sa.Integer(), nullable=True),
    )
    op.create_index(
        op.f("ix_homework_templates_source_lesson_id"),
        "homework_templates",
        ["source_lesson_id"],
    )
    op.create_foreign_key(
        "fk_homework_templates_source_lesson_id",
        "homework_templates",
        "interactive_lessons",
        ["source_lesson_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_homework_templates_source_lesson_id",
        "homework_templates",
        type_="foreignkey",
    )
    op.drop_index(
        op.f("ix_homework_templates_source_lesson_id"),
        table_name="homework_templates",
    )
    op.drop_column("homework_templates", "source_lesson_id")
