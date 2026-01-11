from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, get_db
from app.models.lesson import Lesson, LessonStatus, LessonStudent
from app.models.lesson_type import LessonType
from app.models.user import User
from app.models.level import Level
from app.schemas.report import (
    ReportRequest,
    StudentReportRow,
    TeacherReport,
    TeacherReportResponse,
)

router = APIRouter()


@router.post("/teachers", response_model=TeacherReportResponse)
async def generate_teacher_report(
    data: ReportRequest,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Generate report of lessons grouped by teachers for a date range."""

    # Convert dates to datetime for comparison
    date_from_dt = datetime.combine(data.date_from, time.min)
    date_to_dt = datetime.combine(data.date_to, time.max)

    # Get all completed lessons in the date range with related data
    query = (
        select(Lesson)
        .options(
            selectinload(Lesson.teacher).selectinload(User.level),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(
            and_(
                Lesson.scheduled_at >= date_from_dt,
                Lesson.scheduled_at <= date_to_dt,
                Lesson.status == LessonStatus.COMPLETED,
            )
        )
        .order_by(Lesson.teacher_id, Lesson.scheduled_at)
    )

    result = await db.execute(query)
    lessons = result.scalars().all()

    # Group lessons by teacher, then by student and lesson type
    teacher_data: dict[int, dict] = defaultdict(lambda: {
        "teacher_name": "",
        "students": defaultdict(lambda: defaultdict(lambda: {
            "count": 0,
            "payment": Decimal("0"),
        }))
    })

    for lesson in lessons:
        teacher_id = lesson.teacher_id
        teacher = lesson.teacher
        lesson_type = lesson.lesson_type

        teacher_data[teacher_id]["teacher_name"] = teacher.name

        # Calculate teacher payment based on level percentage
        # Default to 50% if no level set
        teacher_percentage = Decimal("50")
        if teacher.level:
            teacher_percentage = teacher.level.teacher_percentage

        lesson_price = lesson_type.price
        teacher_payment = lesson_price * teacher_percentage / 100

        # Add data for each student in the lesson
        for lesson_student in lesson.students:
            if lesson_student.attended:
                student = lesson_student.student
                student_key = (student.id, student.name)
                lesson_type_key = lesson_type.name

                teacher_data[teacher_id]["students"][student_key][lesson_type_key]["count"] += 1
                teacher_data[teacher_id]["students"][student_key][lesson_type_key]["payment"] += teacher_payment

    # Build response
    teachers_list: list[TeacherReport] = []
    grand_total = Decimal("0")

    for teacher_id, data in teacher_data.items():
        rows: list[StudentReportRow] = []
        teacher_total = Decimal("0")

        for (student_id, student_name), lesson_types in data["students"].items():
            for lesson_type_name, stats in lesson_types.items():
                row = StudentReportRow(
                    student_name=student_name,
                    lesson_type=lesson_type_name,
                    lessons_count=stats["count"],
                    teacher_payment=stats["payment"],
                )
                rows.append(row)
                teacher_total += stats["payment"]

        if rows:
            teachers_list.append(TeacherReport(
                teacher_id=teacher_id,
                teacher_name=data["teacher_name"],
                rows=rows,
                total=teacher_total,
            ))
            grand_total += teacher_total

    return TeacherReportResponse(
        teachers=teachers_list,
        grand_total=grand_total,
        date_from=data.date_from,
        date_to=data.date_to,
    )
