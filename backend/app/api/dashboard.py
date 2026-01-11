from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import ManagerUser, get_db
from app.models.user import User, UserRole
from app.models.lesson import Lesson, LessonStatus, LessonStudent
from app.models.lesson_type import LessonType
from app.schemas.dashboard import (
    DashboardStats,
    DashboardCharts,
    ChartDataPoint,
    UpcomingLesson,
    DashboardResponse,
)

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get dashboard statistics and charts."""

    # Get stats
    # Total balance of all students
    balance_result = await db.execute(
        select(func.coalesce(func.sum(User.balance), 0)).where(
            User.role == UserRole.STUDENT,
            User.is_active == True,
        )
    )
    total_balance = balance_result.scalar() or Decimal("0")

    # Students count
    students_result = await db.execute(
        select(func.count()).where(
            User.role == UserRole.STUDENT,
            User.is_active == True,
        )
    )
    students_count = students_result.scalar() or 0

    # Teachers count
    teachers_result = await db.execute(
        select(func.count()).where(
            User.role == UserRole.TEACHER,
            User.is_active == True,
        )
    )
    teachers_count = teachers_result.scalar() or 0

    # Lessons this month
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    lessons_result = await db.execute(
        select(func.count()).where(
            Lesson.scheduled_at >= month_start,
            Lesson.status == LessonStatus.COMPLETED,
        )
    )
    lessons_this_month = lessons_result.scalar() or 0

    stats = DashboardStats(
        total_balance=total_balance,
        students_count=students_count,
        teachers_count=teachers_count,
        lessons_this_month=lessons_this_month,
    )

    # Get charts data (last 30 days)
    thirty_days_ago = now - timedelta(days=30)

    # Lessons per day
    lessons_query = await db.execute(
        select(
            func.date(Lesson.scheduled_at).label("date"),
            func.count().label("count"),
        )
        .where(
            Lesson.scheduled_at >= thirty_days_ago,
            Lesson.status == LessonStatus.COMPLETED,
        )
        .group_by(func.date(Lesson.scheduled_at))
        .order_by(func.date(Lesson.scheduled_at))
    )
    lessons_by_day = {str(row.date): row.count for row in lessons_query.all()}

    # Income per day (sum of lesson prices)
    income_query = await db.execute(
        select(
            func.date(Lesson.scheduled_at).label("date"),
            func.coalesce(func.sum(LessonType.price), 0).label("income"),
        )
        .join(LessonType, Lesson.lesson_type_id == LessonType.id)
        .where(
            Lesson.scheduled_at >= thirty_days_ago,
            Lesson.status == LessonStatus.COMPLETED,
        )
        .group_by(func.date(Lesson.scheduled_at))
        .order_by(func.date(Lesson.scheduled_at))
    )
    income_by_day = {str(row.date): row.income for row in income_query.all()}

    # Build chart data for last 30 days
    lessons_chart = []
    income_chart = []
    for i in range(30):
        day = (thirty_days_ago + timedelta(days=i)).date()
        day_str = str(day)
        lessons_chart.append(ChartDataPoint(
            date=day.strftime("%d.%m"),
            value=lessons_by_day.get(day_str, 0),
        ))
        income_chart.append(ChartDataPoint(
            date=day.strftime("%d.%m"),
            value=income_by_day.get(day_str, Decimal("0")),
        ))

    charts = DashboardCharts(
        lessons_chart=lessons_chart,
        income_chart=income_chart,
    )

    # Get upcoming lessons (next 7 days)
    week_ahead = now + timedelta(days=7)
    upcoming_query = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(
            Lesson.scheduled_at >= now,
            Lesson.scheduled_at <= week_ahead,
            Lesson.status == LessonStatus.SCHEDULED,
        )
        .order_by(Lesson.scheduled_at)
        .limit(10)
    )
    upcoming_lessons_raw = upcoming_query.scalars().all()

    upcoming_lessons = [
        UpcomingLesson(
            id=lesson.id,
            title=lesson.title,
            scheduled_at=lesson.scheduled_at.isoformat(),
            teacher_name=lesson.teacher.name,
            student_names=[ls.student.name for ls in lesson.students],
            meeting_url=lesson.meeting_url,
        )
        for lesson in upcoming_lessons_raw
    ]

    return DashboardResponse(
        stats=stats,
        charts=charts,
        upcoming_lessons=upcoming_lessons,
    )
