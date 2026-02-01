"""initial_schema

Revision ID: 000_initial_schema
Revises:
Create Date: 2026-02-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '000_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums using raw SQL with IF NOT EXISTS
    # Note: attendancestatus is created in migration 002
    op.execute("DO $$ BEGIN CREATE TYPE userrole AS ENUM ('admin', 'manager', 'teacher', 'student'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE lessonstatus AS ENUM ('scheduled', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE materialaccess AS ENUM ('all', 'student', 'teacher'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE testaccess AS ENUM ('all', 'student', 'teacher'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create levels table
    op.create_table(
        'levels',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_levels_id', 'levels', ['id'])

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', postgresql.ENUM('admin', 'manager', 'teacher', 'student', name='userrole', create_type=False), nullable=False, server_default='student'),
        sa.Column('level_id', sa.Integer(), sa.ForeignKey('levels.id'), nullable=True),
        sa.Column('photo_url', sa.String(500), nullable=True),
        sa.Column('balance', sa.Numeric(10, 2), default=0.00),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Create transactions table (created_by_id added in migration 017)
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_transactions_id', 'transactions', ['id'])
    op.create_index('ix_transactions_user_id', 'transactions', ['user_id'])

    # Create lesson_types table
    op.create_table(
        'lesson_types',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('default_price', sa.Numeric(10, 2), default=0.00),
        sa.Column('default_teacher_payment', sa.Numeric(10, 2), default=0.00),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_lesson_types_id', 'lesson_types', ['id'])

    # Create lessons table (group_id added in 005, duration_minutes added in 009)
    op.create_table(
        'lessons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('lesson_type_id', sa.Integer(), sa.ForeignKey('lesson_types.id'), nullable=False),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(), nullable=False),
        sa.Column('status', postgresql.ENUM('scheduled', 'completed', 'cancelled', name='lessonstatus', create_type=False), nullable=False, server_default='scheduled'),
        sa.Column('meeting_url', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_lessons_id', 'lessons', ['id'])
    op.create_index('ix_lessons_teacher_id', 'lessons', ['teacher_id'])
    op.create_index('ix_lessons_scheduled_at', 'lessons', ['scheduled_at'])

    # Create lesson_students table (without attendance_status - added in migration 002)
    op.create_table(
        'lesson_students',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('lesson_id', sa.Integer(), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('attended', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('price', sa.Numeric(10, 2), default=0.00),
        sa.Column('teacher_payment', sa.Numeric(10, 2), default=0.00),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_lesson_students_id', 'lesson_students', ['id'])
    op.create_index('ix_lesson_students_lesson_id', 'lesson_students', ['lesson_id'])
    op.create_index('ix_lesson_students_student_id', 'lesson_students', ['student_id'])

    # Create materials table
    op.create_table(
        'materials',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('access', postgresql.ENUM('all', 'student', 'teacher', name='materialaccess', create_type=False), nullable=False, server_default='all'),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_materials_id', 'materials', ['id'])

    # Create tests table
    op.create_table(
        'tests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('url', sa.String(500), nullable=False),
        sa.Column('access', postgresql.ENUM('all', 'student', 'teacher', name='testaccess', create_type=False), nullable=False, server_default='all'),
        sa.Column('created_by_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_tests_id', 'tests', ['id'])

    # Create initial admin user (password: admin123)
    op.execute("""
        INSERT INTO users (name, email, password_hash, role, is_active)
        VALUES ('Администратор', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNi/1WNNZH6c.', 'admin', true)
    """)


def downgrade() -> None:
    # Drop tables
    op.drop_table('tests')
    op.drop_table('materials')
    op.drop_table('lesson_students')
    op.drop_table('lessons')
    op.drop_table('lesson_types')
    op.drop_table('transactions')
    op.drop_table('users')
    op.drop_table('levels')

    # Drop enums
    op.execute('DROP TYPE IF EXISTS testaccess')
    op.execute('DROP TYPE IF EXISTS materialaccess')
    op.execute('DROP TYPE IF EXISTS attendancestatus')
    op.execute('DROP TYPE IF EXISTS lessonstatus')
    op.execute('DROP TYPE IF EXISTS userrole')
