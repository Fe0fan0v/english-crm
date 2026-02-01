"""add_course_constructor

Revision ID: 019
Revises: 018
Create Date: 2026-02-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '019_add_course_constructor'
down_revision: Union[str, None] = '018_add_teacher_students_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create exerciseblocktype enum
    exerciseblocktype = postgresql.ENUM(
        'text', 'video', 'audio', 'image', 'article', 'divider',
        'teaching_guide', 'remember', 'table',
        'fill_gaps', 'test', 'true_false', 'word_order', 'matching',
        'image_choice', 'flashcards', 'essay',
        name='exerciseblocktype'
    )
    exerciseblocktype.create(op.get_bind(), checkfirst=True)

    # Create courses table
    op.create_table(
        'courses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cover_url', sa.String(500), nullable=True),
        sa.Column('is_published', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_courses_id', 'courses', ['id'])
    op.create_index('ix_courses_created_by_id', 'courses', ['created_by_id'])
    op.create_index('ix_courses_is_published', 'courses', ['is_published'])

    # Create course_sections table
    op.create_table(
        'course_sections',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_course_sections_id', 'course_sections', ['id'])
    op.create_index('ix_course_sections_course_id', 'course_sections', ['course_id'])

    # Create interactive_lessons table
    op.create_table(
        'interactive_lessons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('section_id', sa.Integer(), sa.ForeignKey('course_sections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('position', sa.Integer(), default=0, nullable=False),
        sa.Column('is_published', sa.Boolean(), default=False, nullable=False),
        sa.Column('is_homework', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_interactive_lessons_id', 'interactive_lessons', ['id'])
    op.create_index('ix_interactive_lessons_section_id', 'interactive_lessons', ['section_id'])
    op.create_index('ix_interactive_lessons_created_by_id', 'interactive_lessons', ['created_by_id'])

    # Create exercise_blocks table
    op.create_table(
        'exercise_blocks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lesson_id', sa.Integer(), sa.ForeignKey('interactive_lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('block_type', postgresql.ENUM(
            'text', 'video', 'audio', 'image', 'article', 'divider',
            'teaching_guide', 'remember', 'table',
            'fill_gaps', 'test', 'true_false', 'word_order', 'matching',
            'image_choice', 'flashcards', 'essay',
            name='exerciseblocktype', create_type=False
        ), nullable=False),
        sa.Column('content', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('position', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_exercise_blocks_id', 'exercise_blocks', ['id'])
    op.create_index('ix_exercise_blocks_lesson_id', 'exercise_blocks', ['lesson_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_exercise_blocks_lesson_id', table_name='exercise_blocks')
    op.drop_index('ix_exercise_blocks_id', table_name='exercise_blocks')
    op.drop_index('ix_interactive_lessons_created_by_id', table_name='interactive_lessons')
    op.drop_index('ix_interactive_lessons_section_id', table_name='interactive_lessons')
    op.drop_index('ix_interactive_lessons_id', table_name='interactive_lessons')
    op.drop_index('ix_course_sections_course_id', table_name='course_sections')
    op.drop_index('ix_course_sections_id', table_name='course_sections')
    op.drop_index('ix_courses_is_published', table_name='courses')
    op.drop_index('ix_courses_created_by_id', table_name='courses')
    op.drop_index('ix_courses_id', table_name='courses')

    # Drop tables
    op.drop_table('exercise_blocks')
    op.drop_table('interactive_lessons')
    op.drop_table('course_sections')
    op.drop_table('courses')

    # Drop enum
    exerciseblocktype = postgresql.ENUM(
        'text', 'video', 'audio', 'image', 'article', 'divider',
        'teaching_guide', 'remember', 'table',
        'fill_gaps', 'test', 'true_false', 'word_order', 'matching',
        'image_choice', 'flashcards', 'essay',
        name='exerciseblocktype'
    )
    exerciseblocktype.drop(op.get_bind(), checkfirst=True)
