from datetime import datetime

from pydantic import BaseModel


class HomeworkAssign(BaseModel):
    """Assign an interactive lesson as homework to lesson students."""

    interactive_lesson_id: int
    student_ids: list[int] | None = None  # None = all students of the lesson


class HomeworkAssignmentResponse(BaseModel):
    """Single homework assignment (teacher view)."""

    id: int
    lesson_id: int
    lesson_title: str
    interactive_lesson_id: int
    interactive_lesson_title: str
    student_id: int
    student_name: str
    status: str  # pending / in_progress / submitted / accepted
    progress: int
    total_blocks: int
    assigned_at: datetime
    submitted_at: datetime | None = None
    accepted_at: datetime | None = None


class StudentHomeworkItem(BaseModel):
    """A single homework item (student view)."""

    id: int
    lesson_title: str
    interactive_lesson_id: int
    interactive_lesson_title: str
    teacher_name: str
    status: str  # pending / in_progress / submitted / accepted
    progress: int
    total_blocks: int
    assigned_at: datetime
