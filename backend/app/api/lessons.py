from datetime import datetime, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import ManagerUser, get_db
from app.models.lesson import Lesson, LessonStatus, LessonStudent
from app.models.lesson_type import LessonType
from app.models.user import User
from app.schemas.lesson import (
    LessonCreate,
    LessonUpdate,
    LessonResponse,
    LessonListResponse,
    StudentInfo,
    ScheduleLesson,
)

router = APIRouter()


def build_lesson_response(lesson: Lesson) -> LessonResponse:
    """Build LessonResponse from Lesson model."""
    students = [
        StudentInfo(
            id=ls.student.id,
            name=ls.student.name,
            email=ls.student.email,
            phone=ls.student.phone,
            attended=ls.attended,
        )
        for ls in lesson.students
    ]
    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        teacher_id=lesson.teacher_id,
        teacher_name=lesson.teacher.name,
        lesson_type_id=lesson.lesson_type_id,
        lesson_type_name=lesson.lesson_type.name,
        scheduled_at=lesson.scheduled_at,
        meeting_url=lesson.meeting_url,
        status=lesson.status,
        students=students,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
    )


@router.get("", response_model=LessonListResponse)
async def list_lessons(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    teacher_id: int | None = None,
    status_filter: LessonStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get lessons with filters."""
    query = select(Lesson).options(
        selectinload(Lesson.teacher),
        selectinload(Lesson.lesson_type),
        selectinload(Lesson.students).selectinload(LessonStudent.student),
    )

    # Apply filters
    conditions = []
    if date_from:
        conditions.append(Lesson.scheduled_at >= date_from)
    if date_to:
        conditions.append(Lesson.scheduled_at <= date_to)
    if teacher_id:
        conditions.append(Lesson.teacher_id == teacher_id)
    if status_filter:
        conditions.append(Lesson.status == status_filter)

    if conditions:
        query = query.where(and_(*conditions))

    query = query.order_by(Lesson.scheduled_at.desc())

    # Count total
    count_query = select(func.count()).select_from(Lesson)
    if conditions:
        count_query = count_query.where(and_(*conditions))
    total = await db.scalar(count_query) or 0

    # Paginate
    query = query.offset((page - 1) * size).limit(size)

    result = await db.execute(query)
    lessons = result.scalars().all()

    items = [build_lesson_response(lesson) for lesson in lessons]

    return LessonListResponse(items=items, total=total)


@router.get("/schedule")
async def get_schedule(
    date_from: datetime,
    date_to: datetime,
    teacher_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get lessons for schedule view."""
    query = select(Lesson).options(
        selectinload(Lesson.teacher),
        selectinload(Lesson.lesson_type),
        selectinload(Lesson.students),
    )

    conditions = [
        Lesson.scheduled_at >= date_from,
        Lesson.scheduled_at <= date_to,
    ]
    if teacher_id:
        conditions.append(Lesson.teacher_id == teacher_id)

    query = query.where(and_(*conditions)).order_by(Lesson.scheduled_at)

    result = await db.execute(query)
    lessons = result.scalars().all()

    return [
        ScheduleLesson(
            id=lesson.id,
            title=lesson.title,
            teacher_id=lesson.teacher_id,
            teacher_name=lesson.teacher.name,
            lesson_type_name=lesson.lesson_type.name,
            scheduled_at=lesson.scheduled_at,
            status=lesson.status,
            students_count=len(lesson.students),
        )
        for lesson in lessons
    ]


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get a specific lesson."""
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )

    return build_lesson_response(lesson)


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Create a new lesson."""
    # Verify teacher exists
    teacher = await db.get(User, data.teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher not found",
        )

    # Verify lesson type exists
    lesson_type = await db.get(LessonType, data.lesson_type_id)
    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lesson type not found",
        )

    # Create lesson
    lesson = Lesson(
        title=data.title,
        teacher_id=data.teacher_id,
        lesson_type_id=data.lesson_type_id,
        scheduled_at=data.scheduled_at,
        meeting_url=data.meeting_url,
        status=LessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    # Add students
    for student_id in data.student_ids:
        student = await db.get(User, student_id)
        if student:
            lesson_student = LessonStudent(
                lesson_id=lesson.id,
                student_id=student_id,
                attended=False,
            )
            db.add(lesson_student)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(Lesson.id == lesson.id)
    )
    lesson = result.scalar_one()

    return build_lesson_response(lesson)


@router.put("/{lesson_id}", response_model=LessonResponse)
async def update_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Update a lesson."""
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)

    await db.commit()
    await db.refresh(lesson)

    return build_lesson_response(lesson)


@router.delete("/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Delete a lesson."""
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lesson not found",
        )

    await db.delete(lesson)
    await db.commit()


@router.post("/{lesson_id}/attendance")
async def update_attendance(
    lesson_id: int,
    student_id: int,
    attended: bool,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Update student attendance for a lesson."""
    result = await db.execute(
        select(LessonStudent).where(
            LessonStudent.lesson_id == lesson_id,
            LessonStudent.student_id == student_id,
        )
    )
    lesson_student = result.scalar_one_or_none()

    if not lesson_student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found in this lesson",
        )

    lesson_student.attended = attended
    await db.commit()

    return {"success": True}
