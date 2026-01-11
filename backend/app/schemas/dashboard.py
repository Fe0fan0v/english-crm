from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardStats(BaseModel):
    total_balance: Decimal
    students_count: int
    teachers_count: int
    lessons_this_month: int


class ChartDataPoint(BaseModel):
    date: str
    value: int | Decimal


class DashboardCharts(BaseModel):
    lessons_chart: list[ChartDataPoint]
    income_chart: list[ChartDataPoint]


class UpcomingLesson(BaseModel):
    id: int
    title: str
    scheduled_at: str
    teacher_name: str
    student_names: list[str]
    meeting_url: str | None


class DashboardResponse(BaseModel):
    stats: DashboardStats
    charts: DashboardCharts
    upcoming_lessons: list[UpcomingLesson]
