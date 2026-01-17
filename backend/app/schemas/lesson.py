from datetime import datetime

from pydantic import BaseModel, Field

from app.models.lesson import AttendanceStatus, LessonStatus


class LessonBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    teacher_id: int
    lesson_type_id: int
    scheduled_at: datetime
    meeting_url: str | None = None
    group_id: int | None = None


class LessonCreate(LessonBase):
    student_ids: list[int] = []  # If group_id is provided, students are auto-populated from group


class LessonUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    teacher_id: int | None = None
    lesson_type_id: int | None = None
    scheduled_at: datetime | None = None
    meeting_url: str | None = None
    group_id: int | None = None
    status: LessonStatus | None = None


class StudentInfo(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    attendance_status: AttendanceStatus
    charged: bool

    class Config:
        from_attributes = True


class AttendanceUpdate(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceBulkUpdate(BaseModel):
    attendances: list[AttendanceUpdate]


class LessonResponse(BaseModel):
    id: int
    title: str
    teacher_id: int
    teacher_name: str
    group_id: int | None
    group_name: str | None
    lesson_type_id: int
    lesson_type_name: str
    scheduled_at: datetime
    meeting_url: str | None
    status: LessonStatus
    students: list[StudentInfo]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LessonListResponse(BaseModel):
    items: list[LessonResponse]
    total: int


class ScheduleLesson(BaseModel):
    id: int
    title: str
    teacher_id: int
    teacher_name: str
    group_id: int | None
    group_name: str | None
    lesson_type_name: str
    scheduled_at: datetime
    status: LessonStatus
    students_count: int
