"""CRUD API for standalone homework lessons (not part of any course)."""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, TeacherUser
from app.models.course import ExerciseBlock, InteractiveLesson

router = APIRouter()


class StandaloneLessonCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class StandaloneLessonUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class StandaloneLessonResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    is_standalone: bool = True
    created_by_id: int
    created_at: str
    updated_at: str
    blocks_count: int = 0

    class Config:
        from_attributes = True


@router.get("/", response_model=list[StandaloneLessonResponse])
async def list_standalone_lessons(
    current_user: TeacherUser,
    db: DBSession,
):
    """List standalone lessons created by the current teacher."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(
            InteractiveLesson.is_standalone == True,
            InteractiveLesson.created_by_id == current_user.id,
        )
        .options(selectinload(InteractiveLesson.blocks))
        .order_by(InteractiveLesson.updated_at.desc())
    )
    lessons = result.scalars().all()

    return [
        StandaloneLessonResponse(
            id=lesson.id,
            title=lesson.title,
            description=lesson.description,
            is_standalone=True,
            created_by_id=lesson.created_by_id,
            created_at=lesson.created_at.isoformat(),
            updated_at=lesson.updated_at.isoformat(),
            blocks_count=len(lesson.blocks),
        )
        for lesson in lessons
    ]


@router.post(
    "/",
    response_model=StandaloneLessonResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_standalone_lesson(
    data: StandaloneLessonCreate,
    current_user: TeacherUser,
    db: DBSession,
):
    """Create a new standalone lesson for homework."""
    lesson = InteractiveLesson(
        title=data.title,
        description=data.description,
        topic_id=None,
        section_id=None,
        is_standalone=True,
        is_published=True,
        created_by_id=current_user.id,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)

    return StandaloneLessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description,
        is_standalone=True,
        created_by_id=lesson.created_by_id,
        created_at=lesson.created_at.isoformat(),
        updated_at=lesson.updated_at.isoformat(),
        blocks_count=0,
    )


@router.put("/{lesson_id}", response_model=StandaloneLessonResponse)
async def update_standalone_lesson(
    lesson_id: int,
    data: StandaloneLessonUpdate,
    current_user: TeacherUser,
    db: DBSession,
):
    """Update a standalone lesson."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(
            InteractiveLesson.id == lesson_id,
            InteractiveLesson.is_standalone == True,
        )
        .options(selectinload(InteractiveLesson.blocks))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.created_by_id != current_user.id and current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    if data.title is not None:
        lesson.title = data.title
    if data.description is not None:
        lesson.description = data.description

    await db.commit()
    await db.refresh(lesson)

    return StandaloneLessonResponse(
        id=lesson.id,
        title=lesson.title,
        description=lesson.description,
        is_standalone=True,
        created_by_id=lesson.created_by_id,
        created_at=lesson.created_at.isoformat(),
        updated_at=lesson.updated_at.isoformat(),
        blocks_count=len(lesson.blocks),
    )


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_standalone_lesson(
    lesson_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Delete a standalone lesson."""
    lesson = await db.get(InteractiveLesson, lesson_id)

    if not lesson or not lesson.is_standalone:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if lesson.created_by_id != current_user.id and current_user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(lesson)
    await db.commit()
