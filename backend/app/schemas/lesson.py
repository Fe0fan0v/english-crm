from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.lesson import AttendanceStatus, LessonStatus


class LessonBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    teacher_id: int
    lesson_type_id: int
    scheduled_at: datetime
    duration_minutes: int = Field(default=60, ge=15, le=480)  # 15 min to 8 hours
    meeting_url: str | None = None
    group_id: int | None = None


class LessonCreate(LessonBase):
    student_ids: list[int] = []  # If group_id is provided, students are auto-populated from group


class LessonCreateBatch(BaseModel):
    """Schema for creating recurring lessons (batch creation)."""
    teacher_id: int
    lesson_type_id: int
    weekdays: list[str]  # ["monday", "wednesday", "friday"]
    time: str  # "10:00" or "10:00:00"
    start_date: date  # Start date for generating lessons
    weeks: int = Field(default=4, ge=1, le=12)  # Number of weeks to generate
    duration_minutes: int = Field(default=60, ge=15, le=480)
    group_id: int | None = None
    student_ids: list[int] = []


class LessonCreateBatchResponse(BaseModel):
    """Response for batch lesson creation."""
    created: list["ScheduleLesson"]
    conflicts: list[dict]  # List of conflicts that prevented lesson creation


class LessonUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    teacher_id: int | None = None
    lesson_type_id: int | None = None
    scheduled_at: datetime | None = None
    duration_minutes: int | None = Field(None, ge=15, le=480)
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
    duration_minutes: int
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
    duration_minutes: int
    status: LessonStatus
    students_count: int


# Update forward references
LessonCreateBatchResponse.model_rebuild()
