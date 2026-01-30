"""
Script to check difference between Excel file and database students.

Usage:
    python -m scripts.check_students_diff
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


async def analyze_students(session: AsyncSession, file_path: str):
    """Analyze students from Excel file vs database."""
    print(f"\n=== Analyzing students from {file_path} ===\n")

    wb = openpyxl.load_workbook(file_path)
    ws = wb.active

    # Collect all emails from Excel
    excel_emails = set()
    excel_data = []
    empty_rows = 0
    invalid_emails = 0

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), 2):
        name, email, login, phone, balance, password = row[:6] if len(row) >= 6 else (row + (None,) * 6)[:6]

        if not email:
            empty_rows += 1
            continue

        email = str(email).strip().lower()

        if '@' not in email:
            invalid_emails += 1
            print(f"  Row {i}: Invalid email (no @): {email}")
            continue

        excel_data.append({
            'row': i,
            'name': name,
            'email': email,
            'phone': phone,
            'balance': balance,
        })
        excel_emails.add(email)

    wb.close()

    print(f"Excel file stats:")
    print(f"  Total rows (excluding header): {len(excel_data) + empty_rows + invalid_emails}")
    print(f"  Valid emails: {len(excel_emails)}")
    print(f"  Empty rows: {empty_rows}")
    print(f"  Invalid emails: {invalid_emails}")
    print(f"  Unique emails: {len(excel_emails)}")

    # Check for duplicates in Excel
    seen_emails = {}
    duplicates = []
    for item in excel_data:
        email = item['email']
        if email in seen_emails:
            duplicates.append((seen_emails[email], item['row'], email))
        else:
            seen_emails[email] = item['row']

    if duplicates:
        print(f"\n  Duplicate emails in Excel ({len(duplicates)}):")
        for first_row, dup_row, email in duplicates[:10]:
            print(f"    {email}: rows {first_row} and {dup_row}")
        if len(duplicates) > 10:
            print(f"    ... and {len(duplicates) - 10} more")

    # Get all students from database
    result = await session.execute(
        select(User).where(User.role == UserRole.STUDENT)
    )
    db_students = result.scalars().all()

    db_emails = {s.email.lower() for s in db_students}
    db_active_count = sum(1 for s in db_students if s.is_active)
    db_inactive_count = sum(1 for s in db_students if not s.is_active)

    print(f"\nDatabase stats:")
    print(f"  Total students: {len(db_students)}")
    print(f"  Active: {db_active_count}")
    print(f"  Inactive: {db_inactive_count}")

    # Find missing students (in Excel but not in DB)
    missing_in_db = excel_emails - db_emails
    extra_in_db = db_emails - excel_emails

    print(f"\nComparison:")
    print(f"  In Excel but not in DB: {len(missing_in_db)}")
    print(f"  In DB but not in Excel: {len(extra_in_db)}")

    if missing_in_db:
        print(f"\n  Missing students (first 20):")
        for email in list(missing_in_db)[:20]:
            # Find the row in Excel
            for item in excel_data:
                if item['email'] == email:
                    print(f"    Row {item['row']}: {item['name']} <{email}>")
                    break

    if extra_in_db:
        print(f"\n  Extra students in DB (first 10):")
        for email in list(extra_in_db)[:10]:
            for s in db_students:
                if s.email.lower() == email:
                    print(f"    ID {s.id}: {s.name} <{email}> (active={s.is_active})")
                    break

    # Check if missing students exist with different role
    if missing_in_db:
        print(f"\n  Checking if missing emails exist with different role...")
        for email in missing_in_db:
            result = await session.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            if user:
                print(f"    {email}: found as {user.role.value} (ID={user.id})")


async def main():
    """Main function."""
    print("=" * 60)
    print("Checking students difference...")
    print("=" * 60)

    # File path (mounted in Docker container)
    students_file = "/data/База ученики.xlsx"

    # Check file exists
    if not Path(students_file).exists():
        print(f"ERROR: File not found: {students_file}")
        return

    async with async_session_maker() as session:
        await analyze_students(session, students_file)


if __name__ == "__main__":
    asyncio.run(main())
