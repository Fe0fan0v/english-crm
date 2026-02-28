from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class HomeworkTemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    course_id: int
    interactive_lesson_ids: list[int] = Field(default_factory=list)


class HomeworkTemplateUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    interactive_lesson_ids: list[int] | None = None


class HomeworkTemplateResponse(BaseModel):
    id: int
    title: str
    course_id: int
    course_title: str
    created_by: int
    creator_name: str
    created_at: datetime
    items: list[dict[str, Any]] = []
