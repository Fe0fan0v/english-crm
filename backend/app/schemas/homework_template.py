from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HomeworkTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    course_id: int
    source_lesson_id: int | None = None
    # Legacy: still accepted for backward compat but ignored for new flow
    interactive_lesson_ids: list[int] = Field(default_factory=list)


class HomeworkTemplateUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    interactive_lesson_ids: list[int] | None = None


class HomeworkAssignedLesson(BaseModel):
    lesson_id: int
    scheduled_at: datetime
    lesson_type_name: str
    student_count: int


class HomeworkTemplateResponse(BaseModel):
    id: int
    title: str
    course_id: int
    course_title: str
    source_lesson_id: int | None = None
    source_lesson_title: str | None = None
    interactive_lesson_id: int | None = None
    blocks_count: int = 0
    created_by: int
    creator_name: str
    created_at: datetime
    items: list[dict[str, Any]] = []
    assigned_lessons: list[HomeworkAssignedLesson] = []
