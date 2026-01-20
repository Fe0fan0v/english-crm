from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.lesson import AttendanceStatus, LessonStatus


# Admin/Manager Dashboard
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


# Teacher Dashboard
class TeacherStats(BaseModel):
    lessons_conducted: int
    workload_percentage: float
    students_count: int
    groups_count: int


class TeacherGroupSummary(BaseModel):
    id: int
    name: str
    students_count: int


class TeacherLessonStudent(BaseModel):
    id: int
    name: str
    attendance_status: AttendanceStatus
    charged: bool


class TeacherLesson(BaseModel):
    id: int
    title: str
    group_id: int | None
    group_name: str | None
    lesson_type_id: int
    lesson_type_name: str
    lesson_type_price: Decimal
    scheduled_at: datetime
    duration_minutes: int
    meeting_url: str | None
    status: LessonStatus
    students: list[TeacherLessonStudent]


class TeacherDashboardResponse(BaseModel):
    stats: TeacherStats
    upcoming_lessons: list[TeacherLesson]
    groups: list[TeacherGroupSummary]


class TeacherStudentInfo(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    balance: Decimal
    group_names: list[str]


# Student Dashboard
class StudentStats(BaseModel):
    balance: Decimal
    upcoming_lessons_count: int
    groups_count: int


class StudentGroupSummary(BaseModel):
    id: int
    name: str
    teacher_name: str | None
    has_unread_messages: bool = False


class StudentLessonInfo(BaseModel):
    id: int
    title: str
    scheduled_at: datetime
    teacher_name: str
    lesson_type_name: str
    meeting_url: str | None
    status: LessonStatus
    group_name: str | None


class StudentDashboardResponse(BaseModel):
    stats: StudentStats
    upcoming_lessons: list[StudentLessonInfo]
    groups: list[StudentGroupSummary]


class StudentMaterialInfo(BaseModel):
    id: int
    title: str
    file_url: str
    granted_at: datetime


class StudentTestInfo(BaseModel):
    id: int
    title: str
    granted_at: datetime
