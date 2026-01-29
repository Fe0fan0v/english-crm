"""
Import individual teacher-student assignments from Excel file.

This script creates direct TeacherStudent assignments for individual students.

Usage:
    python -m scripts.import_individual_assignments
"""

import asyncio
import sys
from pathlib import Path

import openpyxl
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import async_session_maker
from app.models.user import User, UserRole
from app.models.teacher_student import TeacherStudent


async def import_individual_assignments(session: AsyncSession, file_path: str) -> int:
    """Create direct teacher-student assignments from Individuals file."""
    print(f"\n=== Importing individual teacher-student assignments from {file_path} ===")

    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    created = 0
    skipped = 0
    errors = []

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        teacher_email, student_email = row[:2]

        if not teacher_email or not student_email:
            continue

        teacher_email = str(teacher_email).strip().lower()
        student_email = str(student_email).strip().lower()

        if '@' not in teacher_email or '@' not in student_email:
            continue

        try:
            # Find teacher
            teacher_result = await session.execute(
                select(User).where(User.email == teacher_email)
            )
            teacher = teacher_result.scalar_one_or_none()

            if not teacher:
                errors.append(f"Row {i}: Teacher not found: {teacher_email}")
                continue

            # Find student
            student_result = await session.execute(
                select(User).where(User.email == student_email)
            )
            student = student_result.scalar_one_or_none()

            if not student:
                errors.append(f"Row {i}: Student not found: {student_email}")
                continue

            # Check if assignment already exists
            existing_result = await session.execute(
                select(TeacherStudent).where(
                    TeacherStudent.teacher_id == teacher.id,
                    TeacherStudent.student_id == student.id,
                )
            )
            existing = existing_result.scalar_one_or_none()

            if existing:
                skipped += 1
                continue

            # Create direct teacher-student assignment
            assignment = TeacherStudent(
                teacher_id=teacher.id,
                student_id=student.id,
            )
            session.add(assignment)
            created += 1

        except Exception as e:
            errors.append(f"Row {i}: {teacher_email} -> {student_email} - {e}")

    wb.close()

    print(f"  Created: {created} individual teacher-student assignments")
    print(f"  Skipped (already exist): {skipped}")
    if errors:
        print(f"  Errors/Warnings: {len(errors)}")
        for err in errors[:10]:
            print(f"    {err}")
        if len(errors) > 10:
            print(f"    ... and {len(errors) - 10} more errors")

    return created


async def main():
    """Main import function."""
    print("=" * 60)
    print("Starting individual assignments import...")
    print("=" * 60)

    # File path (mounted in Docker container)
    individuals_file = "/data/Индивиды.xlsx"

    # Check file exists
    if not Path(individuals_file).exists():
        print(f"ERROR: File not found: {individuals_file}")
        return

    async with async_session_maker() as session:
        try:
            # Import individual assignments
            created = await import_individual_assignments(session, individuals_file)

            # Commit all changes
            await session.commit()

            print("\n" + "=" * 60)
            print("Import completed successfully!")
            print("=" * 60)
            print(f"  Total assignments created: {created}")

        except Exception as e:
            await session.rollback()
            print(f"\nERROR: Import failed: {e}")
            import traceback
            traceback.print_exc()
            raise


if __name__ == "__main__":
    asyncio.run(main())
