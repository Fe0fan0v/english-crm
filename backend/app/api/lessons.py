from datetime import datetime, timedelta, timezone
from typing import Annotated
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, ManagerUser, TeacherUser, get_db

logger = logging.getLogger(__name__)
from app.models.course import Course, CourseSection, CourseTopic, InteractiveLesson
from app.models.group import Group, GroupStudent
from app.models.lesson import AttendanceStatus, Lesson, LessonStatus, LessonStudent
from app.models.lesson_course_material import CourseMaterialType, LessonCourseMaterial
from app.models.lesson_material import LessonMaterial
from app.models.lesson_type import LessonType
from app.models.material import Material
from app.models.teacher_student import TeacherStudent
from app.models.user import User, UserRole
from app.schemas.lesson import (
    LessonCreate,
    LessonCreateBatch,
    LessonCreateBatchResponse,
    LessonListResponse,
    LessonMaterialAttach,
    LessonMaterialResponse,
    LessonResponse,
    LessonUpdate,
    ScheduleLesson,
    StudentInfo,
)
from app.schemas.lesson_course_material import (
    LessonCourseMaterialAttach,
    LessonCourseMaterialResponse,
)

# Lesson duration in minutes (used for conflict checking)
LESSON_DURATION_MINUTES = 60

router = APIRouter()


def normalize_datetime_to_utc(dt: datetime | None) -> datetime | None:
    """Convert timezone-aware datetime to UTC naive datetime."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def ensure_teacher_student_assignment(
    db: AsyncSession, teacher_id: int, student_id: int
) -> None:
    """Create TeacherStudent assignment if it doesn't exist."""
    result = await db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == teacher_id,
            TeacherStudent.student_id == student_id,
        )
    )
    if not result.scalar_one_or_none():
        assignment = TeacherStudent(teacher_id=teacher_id, student_id=student_id)
        db.add(assignment)


def build_lesson_response(lesson: Lesson) -> LessonResponse:
    """Build LessonResponse from Lesson model."""
    students = [
        StudentInfo(
            id=ls.student.id,
            name=ls.student.name,
            email=ls.student.email,
            phone=ls.student.phone,
            attendance_status=ls.attendance_status,
            charged=ls.charged,
        )
        for ls in lesson.students
    ]
    return LessonResponse(
        id=lesson.id,
        title=lesson.title,
        teacher_id=lesson.teacher_id,
        teacher_name=lesson.teacher.name,
        group_id=lesson.group_id,
        group_name=lesson.group.name if lesson.group else None,
        lesson_type_id=lesson.lesson_type_id,
        lesson_type_name=lesson.lesson_type.name,
        scheduled_at=lesson.scheduled_at,
        duration_minutes=lesson.duration_minutes,
        meeting_url=lesson.meeting_url,
        status=lesson.status,
        students=students,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
    )


async def check_teacher_conflict(
    db: AsyncSession,
    teacher_id: int,
    scheduled_at: datetime,
    exclude_lesson_id: int | None = None,
) -> Lesson | None:
    """Check if teacher has a conflicting lesson at the given time."""
    lesson_start = scheduled_at
    lesson_end = scheduled_at + timedelta(minutes=LESSON_DURATION_MINUTES)

    query = select(Lesson).where(
        and_(
            Lesson.teacher_id == teacher_id,
            Lesson.status != LessonStatus.CANCELLED,
            # Check for overlap: existing lesson overlaps with new lesson time
            Lesson.scheduled_at < lesson_end,
            Lesson.scheduled_at + timedelta(minutes=LESSON_DURATION_MINUTES)
            > lesson_start,
        )
    )

    if exclude_lesson_id:
        query = query.where(Lesson.id != exclude_lesson_id)

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def check_students_conflict(
    db: AsyncSession,
    student_ids: list[int],
    scheduled_at: datetime,
    exclude_lesson_id: int | None = None,
) -> list[dict]:
    """Check if any students have conflicting lessons at the given time."""
    if not student_ids:
        return []

    lesson_start = scheduled_at
    lesson_end = scheduled_at + timedelta(minutes=LESSON_DURATION_MINUTES)

    # Find lessons that overlap with the given time
    query = (
        select(Lesson)
        .where(
            and_(
                Lesson.status != LessonStatus.CANCELLED,
                Lesson.scheduled_at < lesson_end,
                Lesson.scheduled_at + timedelta(minutes=LESSON_DURATION_MINUTES)
                > lesson_start,
            )
        )
        .options(selectinload(Lesson.students).selectinload(LessonStudent.student))
    )

    if exclude_lesson_id:
        query = query.where(Lesson.id != exclude_lesson_id)

    result = await db.execute(query)
    conflicting_lessons = result.scalars().all()

    # Check which students are in conflicting lessons
    conflicts = []
    for lesson in conflicting_lessons:
        for ls in lesson.students:
            if ls.student_id in student_ids:
                conflicts.append(
                    {
                        "student_id": ls.student_id,
                        "student_name": ls.student.name,
                        "conflicting_lesson": lesson.title,
                        "conflicting_time": lesson.scheduled_at.isoformat(),
                    }
                )

    return conflicts


# Weekday mapping for batch creation
WEEKDAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def generate_lesson_dates(
    start_date: datetime,
    weekdays: list[str],
    weeks: int,
    time_str: str,
) -> list[datetime]:
    """Generate list of lesson datetimes for given weekdays over specified weeks."""
    dates = []
    # Parse time
    time_parts = time_str.split(":")
    hour = int(time_parts[0])
    minute = int(time_parts[1]) if len(time_parts) > 1 else 0

    # Convert start_date to date if it's datetime
    if isinstance(start_date, datetime):
        base_date = start_date.date()
    else:
        base_date = start_date

    for weekday_name in weekdays:
        weekday_num = WEEKDAY_MAP.get(weekday_name.lower())
        if weekday_num is None:
            continue

        # Find first occurrence of this weekday on or after start_date
        days_until_weekday = (weekday_num - base_date.weekday()) % 7
        first_occurrence = base_date + timedelta(days=days_until_weekday)

        # Generate dates for all weeks
        for week in range(weeks):
            lesson_date = first_occurrence + timedelta(weeks=week)
            lesson_datetime = datetime(
                lesson_date.year,
                lesson_date.month,
                lesson_date.day,
                hour,
                minute,
            )
            dates.append(lesson_datetime)

    # Sort by date
    dates.sort()
    return dates


@router.post("/batch", response_model=LessonCreateBatchResponse)
async def create_lessons_batch(
    data: LessonCreateBatch,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """
    Create recurring lessons for specified weekdays over multiple weeks.

    Returns list of created lessons and any conflicts that prevented creation.
    """
    # Verify teacher exists
    teacher = await db.get(User, data.teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Преподаватель не найден",
        )

    # Verify lesson type exists
    lesson_type = await db.get(LessonType, data.lesson_type_id)
    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип занятия не найден",
        )

    # Verify group exists if provided
    group = None
    if data.group_id:
        group = await db.get(Group, data.group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Группа не найдена",
            )

    # Collect student IDs (from group if provided, otherwise from request)
    student_ids = list(data.student_ids)
    if data.group_id:
        group_students_result = await db.execute(
            select(GroupStudent).where(GroupStudent.group_id == data.group_id)
        )
        group_students = group_students_result.scalars().all()
        group_student_ids = [gs.student_id for gs in group_students]
        student_ids = list(set(student_ids + group_student_ids))

    # Validate that at least one student is assigned
    if not student_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо выбрать хотя бы одного ученика",
        )

    # Validate weekdays
    if not data.weekdays:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо выбрать хотя бы один день недели",
        )

    invalid_weekdays = [w for w in data.weekdays if w.lower() not in WEEKDAY_MAP]
    if invalid_weekdays:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимые дни недели: {', '.join(invalid_weekdays)}",
        )

    # Generate all lesson dates
    lesson_dates = generate_lesson_dates(
        data.start_date,
        data.weekdays,
        data.weeks,
        data.time,
    )

    if not lesson_dates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось сформировать расписание",
        )

    # Create teacher-student assignments for all students (do this once)
    for student_id in student_ids:
        await ensure_teacher_student_assignment(db, data.teacher_id, student_id)

    created_lessons = []
    conflicts = []

    for scheduled_at in lesson_dates:
        # Check teacher conflict
        teacher_conflict = await check_teacher_conflict(
            db, data.teacher_id, scheduled_at
        )
        if teacher_conflict:
            conflicts.append(
                {
                    "date": scheduled_at.isoformat(),
                    "reason": f"Преподаватель занят ({teacher_conflict.title})",
                }
            )
            continue

        # Check students conflicts
        student_conflicts = await check_students_conflict(db, student_ids, scheduled_at)
        if student_conflicts:
            conflict_names = ", ".join(
                set(c["student_name"] for c in student_conflicts[:3])
            )
            conflicts.append(
                {
                    "date": scheduled_at.isoformat(),
                    "reason": f"Ученики заняты: {conflict_names}",
                }
            )
            continue

        # Create lesson
        lesson = Lesson(
            title=lesson_type.name,
            teacher_id=data.teacher_id,
            group_id=data.group_id,
            lesson_type_id=data.lesson_type_id,
            scheduled_at=scheduled_at,
            duration_minutes=data.duration_minutes,
            status=LessonStatus.SCHEDULED,
        )
        db.add(lesson)
        await db.flush()

        # Add students
        for student_id in student_ids:
            student = await db.get(User, student_id)
            if student:
                lesson_student = LessonStudent(
                    lesson_id=lesson.id,
                    student_id=student_id,
                    attendance_status=AttendanceStatus.PENDING,
                    charged=False,
                )
                db.add(lesson_student)

        created_lessons.append(lesson)

    await db.commit()

    # Reload lessons with relationships to build response
    created_schedule_lessons = []
    for lesson in created_lessons:
        result = await db.execute(
            select(Lesson)
            .options(
                selectinload(Lesson.teacher),
                selectinload(Lesson.group),
                selectinload(Lesson.lesson_type),
                selectinload(Lesson.students),
            )
            .where(Lesson.id == lesson.id)
        )
        loaded_lesson = result.scalar_one()
        created_schedule_lessons.append(
            ScheduleLesson(
                id=loaded_lesson.id,
                title=loaded_lesson.title,
                teacher_id=loaded_lesson.teacher_id,
                teacher_name=loaded_lesson.teacher.name,
                group_id=loaded_lesson.group_id,
                group_name=loaded_lesson.group.name if loaded_lesson.group else None,
                lesson_type_name=loaded_lesson.lesson_type.name,
                scheduled_at=loaded_lesson.scheduled_at,
                duration_minutes=loaded_lesson.duration_minutes,
                status=loaded_lesson.status,
                students_count=len(loaded_lesson.students),
            )
        )

    return LessonCreateBatchResponse(
        created=created_schedule_lessons,
        conflicts=conflicts,
    )


@router.get("", response_model=LessonListResponse)
async def list_lessons(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    teacher_id: int | None = None,
    group_id: int | None = None,
    status_filter: LessonStatus | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get lessons with filters."""
    # Convert to UTC naive datetime for comparison with naive datetime in DB
    date_from_naive = normalize_datetime_to_utc(date_from)
    date_to_naive = normalize_datetime_to_utc(date_to)

    query = select(Lesson).options(
        selectinload(Lesson.teacher),
        selectinload(Lesson.group),
        selectinload(Lesson.lesson_type),
        selectinload(Lesson.students).selectinload(LessonStudent.student),
    )

    # Apply filters
    conditions = []
    if date_from_naive:
        conditions.append(Lesson.scheduled_at >= date_from_naive)
    if date_to_naive:
        conditions.append(Lesson.scheduled_at <= date_to_naive)
    if teacher_id:
        conditions.append(Lesson.teacher_id == teacher_id)
    if group_id:
        conditions.append(Lesson.group_id == group_id)
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
    group_id: int | None = None,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Get lessons for schedule view."""
    # Convert to UTC naive datetime for comparison with naive datetime in DB
    date_from_naive = normalize_datetime_to_utc(date_from)
    date_to_naive = normalize_datetime_to_utc(date_to)

    query = select(Lesson).options(
        selectinload(Lesson.teacher),
        selectinload(Lesson.group),
        selectinload(Lesson.lesson_type),
        selectinload(Lesson.students),
    )

    conditions = [
        Lesson.scheduled_at >= date_from_naive,
        Lesson.scheduled_at <= date_to_naive,
    ]
    if teacher_id:
        conditions.append(Lesson.teacher_id == teacher_id)
    if group_id:
        conditions.append(Lesson.group_id == group_id)

    query = query.where(and_(*conditions)).order_by(Lesson.scheduled_at)

    result = await db.execute(query)
    lessons = result.scalars().all()

    # Auto-complete lessons that have ended
    now = datetime.utcnow()
    lessons_to_complete = []
    for lesson in lessons:
        if lesson.status == LessonStatus.SCHEDULED:
            lesson_end = lesson.scheduled_at + timedelta(
                minutes=lesson.duration_minutes
            )
            if now >= lesson_end:
                lesson.status = LessonStatus.COMPLETED
                lessons_to_complete.append(lesson)

    if lessons_to_complete:
        await db.commit()

    return [
        ScheduleLesson(
            id=lesson.id,
            title=lesson.title,
            teacher_id=lesson.teacher_id,
            teacher_name=lesson.teacher.name,
            group_id=lesson.group_id,
            group_name=lesson.group.name if lesson.group else None,
            lesson_type_name=lesson.lesson_type.name,
            scheduled_at=lesson.scheduled_at,
            duration_minutes=lesson.duration_minutes,
            status=lesson.status,
            students_count=len(lesson.students),
        )
        for lesson in lessons
    ]


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    _: TeacherUser = None,
):
    """Get a specific lesson."""
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.group),
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

    # Auto-complete lesson if ended
    if lesson.status == LessonStatus.SCHEDULED:
        now = datetime.utcnow()
        lesson_end = lesson.scheduled_at + timedelta(minutes=lesson.duration_minutes)
        if now >= lesson_end:
            lesson.status = LessonStatus.COMPLETED
            await db.commit()
            await db.refresh(lesson)

    return build_lesson_response(lesson)


@router.post("", response_model=LessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """Create a new lesson with conflict checking and group support."""
    # Verify teacher exists
    teacher = await db.get(User, data.teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Преподаватель не найден",
        )

    # Verify lesson type exists
    lesson_type = await db.get(LessonType, data.lesson_type_id)
    if not lesson_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Тип занятия не найден",
        )

    # Verify group exists if provided
    group = None
    if data.group_id:
        group = await db.get(Group, data.group_id)
        if not group:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Группа не найдена",
            )

    # Check teacher conflict
    teacher_conflict = await check_teacher_conflict(
        db, data.teacher_id, data.scheduled_at
    )
    if teacher_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Преподаватель уже занят в это время (урок: {teacher_conflict.title})",
        )

    # Collect student IDs (from group if provided, otherwise from request)
    student_ids = list(data.student_ids)
    if data.group_id:
        # Auto-populate students from group
        group_students_result = await db.execute(
            select(GroupStudent).where(GroupStudent.group_id == data.group_id)
        )
        group_students = group_students_result.scalars().all()
        group_student_ids = [gs.student_id for gs in group_students]
        # Merge with any additional students from request
        student_ids = list(set(student_ids + group_student_ids))

    # Validate that at least one student is assigned
    if not student_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо выбрать хотя бы одного ученика",
        )

    # Check students conflicts
    if student_ids:
        student_conflicts = await check_students_conflict(
            db, student_ids, data.scheduled_at
        )
        if student_conflicts:
            conflict_details = ", ".join(
                f"{c['student_name']} ({c['conflicting_lesson']})"
                for c in student_conflicts[:3]  # Show first 3 conflicts
            )
            more = (
                f" и ещё {len(student_conflicts) - 3}"
                if len(student_conflicts) > 3
                else ""
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ученики уже заняты в это время: {conflict_details}{more}",
            )

    # Create lesson
    lesson = Lesson(
        title=data.title,
        teacher_id=data.teacher_id,
        group_id=data.group_id,
        lesson_type_id=data.lesson_type_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        meeting_url=data.meeting_url,
        status=LessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    # Add students and create teacher-student assignments
    for student_id in student_ids:
        student = await db.get(User, student_id)
        if student:
            lesson_student = LessonStudent(
                lesson_id=lesson.id,
                student_id=student_id,
                attendance_status=AttendanceStatus.PENDING,
                charged=False,
            )
            db.add(lesson_student)
            # Create teacher-student assignment for chat access
            await ensure_teacher_student_assignment(db, data.teacher_id, student_id)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.group),
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
    """Update a lesson with conflict checking."""
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.group),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Урок не найден",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Check for conflicts if time or teacher is changing
    new_scheduled_at = update_data.get("scheduled_at", lesson.scheduled_at)
    new_teacher_id = update_data.get("teacher_id", lesson.teacher_id)

    if new_scheduled_at != lesson.scheduled_at or new_teacher_id != lesson.teacher_id:
        # Check teacher conflict
        teacher_conflict = await check_teacher_conflict(
            db, new_teacher_id, new_scheduled_at, exclude_lesson_id=lesson_id
        )
        if teacher_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Преподаватель уже занят в это время (урок: {teacher_conflict.title})",
            )

        # Check students conflicts
        student_ids = [ls.student_id for ls in lesson.students]
        if student_ids:
            student_conflicts = await check_students_conflict(
                db, student_ids, new_scheduled_at, exclude_lesson_id=lesson_id
            )
            if student_conflicts:
                conflict_details = ", ".join(
                    f"{c['student_name']} ({c['conflicting_lesson']})"
                    for c in student_conflicts[:3]
                )
                more = (
                    f" и ещё {len(student_conflicts) - 3}"
                    if len(student_conflicts) > 3
                    else ""
                )
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Ученики уже заняты в это время: {conflict_details}{more}",
                )

    for field, value in update_data.items():
        setattr(lesson, field, value)

    await db.commit()
    await db.refresh(lesson)

    # Reload with all relationships
    result = await db.execute(
        select(Lesson)
        .options(
            selectinload(Lesson.teacher),
            selectinload(Lesson.group),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.students).selectinload(LessonStudent.student),
        )
        .where(Lesson.id == lesson_id)
    )
    lesson = result.scalar_one()

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
    attendance_status: AttendanceStatus,
    db: AsyncSession = Depends(get_db),
    _: ManagerUser = None,
):
    """
    Update student attendance for a lesson (manager endpoint).

    Note: This is a simplified endpoint for managers. For full attendance
    management with automatic balance deduction, use the teacher dashboard API.
    """
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

    lesson_student.attendance_status = attendance_status
    await db.commit()

    return {"success": True}


@router.get("/{lesson_id}/materials", response_model=list[LessonMaterialResponse])
async def get_lesson_materials(
    lesson_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Get materials attached to a lesson (accessible by teacher, students, admin, manager)"""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    # Check permissions
    if current_user.role not in ["admin", "manager"]:
        if lesson.teacher_id != current_user.id:
            # Check if user is a student in this lesson
            stmt = select(LessonStudent).where(
                LessonStudent.lesson_id == lesson_id,
                LessonStudent.student_id == current_user.id,
            )
            result = await db.execute(stmt)
            if not result.scalar_one_or_none():
                raise HTTPException(403, "Not authorized")

    # Get materials
    stmt = (
        select(LessonMaterial)
        .options(
            selectinload(LessonMaterial.material), selectinload(LessonMaterial.attacher)
        )
        .where(LessonMaterial.lesson_id == lesson_id)
        .order_by(LessonMaterial.attached_at.desc())
    )
    result = await db.execute(stmt)
    lesson_materials = result.scalars().all()

    return [
        LessonMaterialResponse(
            id=lm.material.id,
            title=lm.material.title,
            file_url=lm.material.file_url,
            attached_at=lm.attached_at,
            attached_by=lm.attached_by,
            attacher_name=lm.attacher.name,
        )
        for lm in lesson_materials
    ]


@router.post("/{lesson_id}/materials")
async def attach_material_to_lesson(
    lesson_id: int,
    data: LessonMaterialAttach,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Attach material to a lesson (only lesson teacher, admin, manager)"""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    # Check permissions
    if current_user.role not in ["admin", "manager"]:
        if lesson.teacher_id != current_user.id:
            raise HTTPException(403, "Only lesson teacher can attach materials")

    # Check if material exists
    material = await db.get(Material, data.material_id)
    if not material:
        raise HTTPException(404, "Material not found")

    # Check if material is already attached
    stmt = select(LessonMaterial).where(
        LessonMaterial.lesson_id == lesson_id,
        LessonMaterial.material_id == data.material_id,
    )
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(400, "Material already attached to this lesson")

    # Create the association
    lesson_material = LessonMaterial(
        lesson_id=lesson_id, material_id=data.material_id, attached_by=current_user.id
    )
    db.add(lesson_material)
    await db.commit()

    return {"message": "Material attached successfully"}


@router.delete("/{lesson_id}/materials/{material_id}")
async def detach_material_from_lesson(
    lesson_id: int,
    material_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """Detach material from a lesson (only lesson teacher, admin, manager)"""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    # Check permissions
    if current_user.role not in ["admin", "manager"]:
        if lesson.teacher_id != current_user.id:
            raise HTTPException(403, "Only lesson teacher can detach materials")

    # Find and delete the association
    stmt = select(LessonMaterial).where(
        LessonMaterial.lesson_id == lesson_id, LessonMaterial.material_id == material_id
    )
    result = await db.execute(stmt)
    lesson_material = result.scalar_one_or_none()

    if not lesson_material:
        raise HTTPException(404, "Material not attached to this lesson")

    await db.delete(lesson_material)
    await db.commit()

    return {"message": "Material detached successfully"}


# ============== Course Materials ==============


@router.get("/{lesson_id}/course-materials", response_model=list[LessonCourseMaterialResponse])
async def get_lesson_course_materials(
    lesson_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: CurrentUser,
):
    """
    Get course materials attached to a lesson.
    For students: only shows if they have attendance_status == PRESENT.
    For teachers/admin/manager: shows all.
    """
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    # Check permissions for students
    if current_user.role == UserRole.STUDENT:
        # Check if student is in this lesson with PRESENT status
        stmt = select(LessonStudent).where(
            LessonStudent.lesson_id == lesson_id,
            LessonStudent.student_id == current_user.id,
            LessonStudent.attendance_status == AttendanceStatus.PRESENT,
        )
        result = await db.execute(stmt)
        if not result.scalar_one_or_none():
            # Return empty list if student is not present
            return []
    elif current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        # Teacher can only see their own lessons
        if lesson.teacher_id != current_user.id:
            raise HTTPException(403, "Not authorized")

    # Get course materials
    stmt = (
        select(LessonCourseMaterial)
        .where(LessonCourseMaterial.lesson_id == lesson_id)
        .options(
            selectinload(LessonCourseMaterial.course),
            selectinload(LessonCourseMaterial.section).selectinload(CourseSection.course),
            selectinload(LessonCourseMaterial.topic).selectinload(CourseTopic.section).selectinload(CourseSection.course),
            selectinload(LessonCourseMaterial.interactive_lesson),
            selectinload(LessonCourseMaterial.attacher),
        )
        .order_by(LessonCourseMaterial.attached_at.desc())
    )
    result = await db.execute(stmt)
    materials = result.scalars().all()

    return [
        LessonCourseMaterialResponse(
            id=m.id,
            material_type=m.material_type,
            # Get course_id from direct link or through section/topic relationship
            course_id=m.course_id or (m.section.course_id if m.section else None) or (m.topic.section.course_id if m.topic else None),
            course_title=m.course.title if m.course else (m.section.course.title if m.section else (m.topic.section.course.title if m.topic else None)),
            section_id=m.section_id,
            section_title=m.section.title if m.section else None,
            topic_id=m.topic_id,
            topic_title=m.topic.title if m.topic else None,
            interactive_lesson_id=m.interactive_lesson_id,
            interactive_lesson_title=m.interactive_lesson.title if m.interactive_lesson else None,
            attached_at=m.attached_at,
            attached_by=m.attached_by,
            attacher_name=m.attacher.name if m.attacher else "",
        )
        for m in materials
    ]


@router.post("/{lesson_id}/course-materials", response_model=LessonCourseMaterialResponse)
async def attach_course_material(
    lesson_id: int,
    data: LessonCourseMaterialAttach,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: TeacherUser,
):
    """
    Attach course material to a lesson.
    Can attach:
    - Whole course (material_type='course', course_id=X)
    - Section (material_type='section', section_id=X)
    - Topic (material_type='topic', topic_id=X)
    - Interactive lesson (material_type='lesson', interactive_lesson_id=X)
    """
    try:
        logger.info(f"Attaching material to lesson {lesson_id}: type={data.material_type}, course_id={data.course_id}, section_id={data.section_id}, topic_id={data.topic_id}, interactive_lesson_id={data.interactive_lesson_id}")

        lesson = await db.get(Lesson, lesson_id)
        if not lesson:
            raise HTTPException(404, "Lesson not found")

        # Check permissions - teacher can only attach to their own lessons
        if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
            if lesson.teacher_id != current_user.id:
                raise HTTPException(403, "Only lesson teacher can attach materials")

        # Validate that the referenced material exists and is published
        if data.material_type == CourseMaterialType.COURSE:
            course = await db.get(Course, data.course_id)
            if not course:
                raise HTTPException(404, "Course not found")
            if not course.is_published:
                raise HTTPException(400, "Course is not published")
        elif data.material_type == CourseMaterialType.SECTION:
            result = await db.execute(
                select(CourseSection)
                .where(CourseSection.id == data.section_id)
                .options(selectinload(CourseSection.course))
            )
            section = result.scalar_one_or_none()
            if not section:
                raise HTTPException(404, "Section not found")
            if not section.course.is_published:
                raise HTTPException(400, "Course is not published")
        elif data.material_type == CourseMaterialType.TOPIC:
            result = await db.execute(
                select(CourseTopic)
                .where(CourseTopic.id == data.topic_id)
                .options(
                    selectinload(CourseTopic.section).selectinload(CourseSection.course)
                )
            )
            topic = result.scalar_one_or_none()
            if not topic:
                raise HTTPException(404, "Topic not found")
            if not topic.section.course.is_published:
                raise HTTPException(400, "Course is not published")
        elif data.material_type == CourseMaterialType.LESSON:
            result = await db.execute(
                select(InteractiveLesson)
                .where(InteractiveLesson.id == data.interactive_lesson_id)
                .options(
                    selectinload(InteractiveLesson.section)
                    .selectinload(CourseSection.course),
                    selectinload(InteractiveLesson.topic)
                    .selectinload(CourseTopic.section)
                    .selectinload(CourseSection.course),
                )
            )
            interactive_lesson = result.scalar_one_or_none()
            if not interactive_lesson:
                raise HTTPException(404, "Interactive lesson not found")
            if not interactive_lesson.is_published:
                raise HTTPException(400, "Interactive lesson is not published")
            # Get course via section or topic path
            if interactive_lesson.section:
                course_obj = interactive_lesson.section.course
            elif interactive_lesson.topic:
                course_obj = interactive_lesson.topic.section.course
            else:
                raise HTTPException(404, "Interactive lesson has no section or topic")
            if not course_obj.is_published:
                raise HTTPException(400, "Course is not published")

        # Check for duplicates
        stmt = select(LessonCourseMaterial).where(
            LessonCourseMaterial.lesson_id == lesson_id,
            LessonCourseMaterial.material_type == data.material_type,
        )
        if data.material_type == CourseMaterialType.COURSE:
            stmt = stmt.where(LessonCourseMaterial.course_id == data.course_id)
        elif data.material_type == CourseMaterialType.SECTION:
            stmt = stmt.where(LessonCourseMaterial.section_id == data.section_id)
        elif data.material_type == CourseMaterialType.TOPIC:
            stmt = stmt.where(LessonCourseMaterial.topic_id == data.topic_id)
        elif data.material_type == CourseMaterialType.LESSON:
            stmt = stmt.where(LessonCourseMaterial.interactive_lesson_id == data.interactive_lesson_id)

        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise HTTPException(400, "This material is already attached to the lesson")

        # Create the attachment
        material = LessonCourseMaterial(
            lesson_id=lesson_id,
            material_type=data.material_type,
            course_id=data.course_id if data.material_type == CourseMaterialType.COURSE else None,
            section_id=data.section_id if data.material_type == CourseMaterialType.SECTION else None,
            topic_id=data.topic_id if data.material_type == CourseMaterialType.TOPIC else None,
            interactive_lesson_id=data.interactive_lesson_id if data.material_type == CourseMaterialType.LESSON else None,
            attached_by=current_user.id,
        )
        db.add(material)
        await db.commit()
        await db.refresh(material)

        # Load relationships for response
        result = await db.execute(
            select(LessonCourseMaterial)
            .where(LessonCourseMaterial.id == material.id)
            .options(
                selectinload(LessonCourseMaterial.course),
                selectinload(LessonCourseMaterial.section),
                selectinload(LessonCourseMaterial.topic),
                selectinload(LessonCourseMaterial.interactive_lesson),
                selectinload(LessonCourseMaterial.attacher),
            )
        )
        material = result.scalar_one()

        logger.info(f"Successfully attached material {material.id} to lesson {lesson_id}")

        return LessonCourseMaterialResponse(
            id=material.id,
            material_type=material.material_type,
            course_id=material.course_id,
            course_title=material.course.title if material.course else None,
            section_id=material.section_id,
            section_title=material.section.title if material.section else None,
            topic_id=material.topic_id,
            topic_title=material.topic.title if material.topic else None,
            interactive_lesson_id=material.interactive_lesson_id,
            interactive_lesson_title=material.interactive_lesson.title if material.interactive_lesson else None,
            attached_at=material.attached_at,
            attached_by=material.attached_by,
            attacher_name=material.attacher.name if material.attacher else "",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Error attaching material to lesson {lesson_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{lesson_id}/course-materials/{material_id}")
async def detach_course_material(
    lesson_id: int,
    material_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: TeacherUser,
):
    """Detach course material from a lesson."""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(404, "Lesson not found")

    # Check permissions
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        if lesson.teacher_id != current_user.id:
            raise HTTPException(403, "Only lesson teacher can detach materials")

    # Find and delete
    stmt = select(LessonCourseMaterial).where(
        LessonCourseMaterial.id == material_id,
        LessonCourseMaterial.lesson_id == lesson_id,
    )
    result = await db.execute(stmt)
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(404, "Material not attached to this lesson")

    await db.delete(material)
    await db.commit()

    return {"message": "Course material detached successfully"}
