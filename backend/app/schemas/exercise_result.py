from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ExerciseResultSubmit(BaseModel):
    """Submit an answer for a single exercise block."""

    block_id: int
    answer: Any


class ExerciseResultResponse(BaseModel):
    """Single exercise result."""

    id: int
    student_id: int
    block_id: int
    lesson_id: int
    answer: Any
    is_correct: bool | None = None
    details: dict[str, Any] | None = None
    updated_at: datetime

    class Config:
        from_attributes = True


class LessonResultsResponse(BaseModel):
    """Student's own results for a lesson."""

    lesson_id: int
    results: list[ExerciseResultResponse]
    score: int
    total: int
    answered: int


class StudentLessonSummary(BaseModel):
    """Summary of one student's results for a lesson."""

    student_id: int
    student_name: str
    score: int
    total: int
    answered: int
    total_blocks: int
    last_activity: datetime | None = None


class LessonStudentResultsResponse(BaseModel):
    """List of students' summaries for a lesson."""

    lesson_id: int
    lesson_title: str
    students: list[StudentLessonSummary]


class StudentBlockResult(BaseModel):
    """A student's answer for a specific block."""

    block_id: int
    block_type: str
    block_title: str | None = None
    block_content: dict[str, Any]
    answer: Any | None = None
    is_correct: bool | None = None
    updated_at: datetime | None = None


class StudentLessonDetailResponse(BaseModel):
    """Detailed student results for a lesson (all blocks)."""

    student_id: int
    student_name: str
    lesson_id: int
    lesson_title: str
    score: int
    total: int
    blocks: list[StudentBlockResult]
