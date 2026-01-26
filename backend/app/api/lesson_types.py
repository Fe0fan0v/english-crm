from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, TeacherUser, get_db
from app.models.lesson_type import LessonType
from app.schemas.lesson_type import (
    LessonTypeCreate,
    LessonTypeListResponse,
    LessonTypeResponse,
    LessonTypeUpdate,
)

router = APIRouter()


@router.get("", response_model=LessonTypeListResponse)
async def list_lesson_types(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: TeacherUser = None,
):
    """Get all lesson types. Available for teachers, managers, and admins."""
    query = select(LessonType)

    if search:
        query = query.where(LessonType.name.ilike(f"%{search}%"))

    query = query.order_by(LessonType.name)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Get items
    result = await db.execute(query)
    items = result.scalars().all()

    return LessonTypeListResponse(items=items, total=total or 0)


@router.get("/{lesson_type_id}", response_model=LessonTypeResponse)
async def get_lesson_type(
    lesson_type_id: int,
    db: AsyncSession = Depends(get_db),
    _: TeacherUser = None,
):
    """Get a specific lesson type. Available for teachers, managers, and admins."""
    result = await db.execute(select(LessonType).where(LessonType.id == lesson_type_id))
    lesson_type = result.scalar_one_or_none()

    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson type not found",
        )

    return lesson_type


@router.post("", response_model=LessonTypeResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson_type(
    data: LessonTypeCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Create a new lesson type."""
    # Check if name already exists
    existing = await db.execute(select(LessonType).where(LessonType.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lesson type with this name already exists",
        )

    lesson_type = LessonType(**data.model_dump())
    db.add(lesson_type)
    await db.commit()
    await db.refresh(lesson_type)

    return lesson_type


@router.put("/{lesson_type_id}", response_model=LessonTypeResponse)
async def update_lesson_type(
    lesson_type_id: int,
    data: LessonTypeUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update a lesson type."""
    result = await db.execute(select(LessonType).where(LessonType.id == lesson_type_id))
    lesson_type = result.scalar_one_or_none()

    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson type not found",
        )

    # Check if new name already exists (if changing name)
    if data.name and data.name != lesson_type.name:
        existing = await db.execute(
            select(LessonType).where(LessonType.name == data.name)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Lesson type with this name already exists",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson_type, field, value)

    await db.commit()
    await db.refresh(lesson_type)

    return lesson_type


@router.delete("/{lesson_type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson_type(
    lesson_type_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Delete a lesson type."""
    result = await db.execute(select(LessonType).where(LessonType.id == lesson_type_id))
    lesson_type = result.scalar_one_or_none()

    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson type not found",
        )

    # Check if lesson type is used in any lessons
    from app.models.lesson import Lesson

    lessons_count = await db.scalar(
        select(func.count())
        .select_from(Lesson)
        .where(Lesson.lesson_type_id == lesson_type_id)
    )

    if lessons_count and lessons_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete lesson type. It is used in {lessons_count} lesson(s).",
        )

    await db.delete(lesson_type)
    await db.commit()
