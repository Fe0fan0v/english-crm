from datetime import datetime

from pydantic import BaseModel


class LiveSessionCreate(BaseModel):
    lesson_id: int
    interactive_lesson_id: int


class LiveSessionResponse(BaseModel):
    lesson_id: int
    interactive_lesson_id: int
    teacher_id: int
    student_ids: list[int]
    teacher_name: str
    created_at: datetime
    teacher_connected: bool
    students_connected: int


class LiveSessionActiveCheck(BaseModel):
    active: bool
    lesson_id: int | None = None
    interactive_lesson_id: int | None = None
    teacher_name: str | None = None
