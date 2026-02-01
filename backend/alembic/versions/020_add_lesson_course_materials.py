"""add_lesson_course_materials

Revision ID: 020
Revises: 019
Create Date: 2026-02-01 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '020_add_lesson_course_materials'
down_revision: Union[str, None] = '019_add_course_constructor'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create coursematerialtype enum
    coursematerialtype = postgresql.ENUM(
        'course', 'section', 'lesson',
        name='coursematerialtype'
    )
    coursematerialtype.create(op.get_bind(), checkfirst=True)

    # Create lesson_course_materials table
    op.create_table(
        'lesson_course_materials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lesson_id', sa.Integer(), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('material_type', postgresql.ENUM(
            'course', 'section', 'lesson',
            name='coursematerialtype', create_type=False
        ), nullable=False),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=True),
        sa.Column('section_id', sa.Integer(), sa.ForeignKey('course_sections.id', ondelete='CASCADE'), nullable=True),
        sa.Column('interactive_lesson_id', sa.Integer(), sa.ForeignKey('interactive_lessons.id', ondelete='CASCADE'), nullable=True),
        sa.Column('attached_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('attached_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Create indexes
    op.create_index('ix_lesson_course_materials_id', 'lesson_course_materials', ['id'])
    op.create_index('ix_lesson_course_materials_lesson_id', 'lesson_course_materials', ['lesson_id'])
    op.create_index('ix_lesson_course_materials_course_id', 'lesson_course_materials', ['course_id'])
    op.create_index('ix_lesson_course_materials_section_id', 'lesson_course_materials', ['section_id'])
    op.create_index('ix_lesson_course_materials_interactive_lesson_id', 'lesson_course_materials', ['interactive_lesson_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_lesson_course_materials_interactive_lesson_id', table_name='lesson_course_materials')
    op.drop_index('ix_lesson_course_materials_section_id', table_name='lesson_course_materials')
    op.drop_index('ix_lesson_course_materials_course_id', table_name='lesson_course_materials')
    op.drop_index('ix_lesson_course_materials_lesson_id', table_name='lesson_course_materials')
    op.drop_index('ix_lesson_course_materials_id', table_name='lesson_course_materials')

    # Drop table
    op.drop_table('lesson_course_materials')

    # Drop enum
    coursematerialtype = postgresql.ENUM(
        'course', 'section', 'lesson',
        name='coursematerialtype'
    )
    coursematerialtype.drop(op.get_bind(), checkfirst=True)
