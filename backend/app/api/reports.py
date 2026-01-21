from collections import defaultdict
from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, ManagerUser
from app.models.lesson import AttendanceStatus, Lesson, LessonStatus, LessonStudent
from app.models.lesson_type import LessonType
from app.models.level_lesson_type_payment import LevelLessonTypePayment
from app.models.user import User
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
    db: DBSession,
    current_user: ManagerUser,
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
        lesson_price = lesson_type.price

        # Add data for each student in the lesson
        for lesson_student in lesson.students:
            if lesson_student.attendance_status == AttendanceStatus.PRESENT:
                student = lesson_student.student
                student_key = (student.id, student.name)
                lesson_type_key = lesson_type.name

                # Calculate teacher payment based on student's level and lesson type
                teacher_payment = Decimal("0")
                if student.level_id:
                    # Look up payment from matrix
                    payment_result = await db.execute(
                        select(LevelLessonTypePayment).where(
                            and_(
                                LevelLessonTypePayment.level_id == student.level_id,
                                LevelLessonTypePayment.lesson_type_id == lesson_type.id,
                            )
                        )
                    )
                    payment_config = payment_result.scalar_one_or_none()
                    if payment_config:
                        teacher_payment = payment_config.teacher_payment

                # Fallback: 50% of lesson price if no matrix config
                if teacher_payment == Decimal("0"):
                    teacher_payment = lesson_price * Decimal("0.5")

                teacher_data[teacher_id]["students"][student_key][lesson_type_key]["count"] += 1
                teacher_data[teacher_id]["students"][student_key][lesson_type_key]["payment"] += teacher_payment

    # Build response
    teachers_list: list[TeacherReport] = []
    grand_total = Decimal("0")

    for teacher_id, teacher_info in teacher_data.items():
        rows: list[StudentReportRow] = []
        teacher_total = Decimal("0")

        for (student_id, student_name), lesson_types in teacher_info["students"].items():
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
                teacher_name=teacher_info["teacher_name"],
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
