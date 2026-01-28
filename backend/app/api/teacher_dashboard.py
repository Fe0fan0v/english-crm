from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, ManagerUser, TeacherOnlyUser
from app.api.lessons import check_students_conflict, check_teacher_conflict
from app.models import (
    AttendanceStatus,
    Group,
    GroupStudent,
    Lesson,
    LessonMaterial,
    LessonStudent,
    LessonType,
    LevelLessonTypePayment,
    Notification,
    NotificationType,
    TeacherAvailability,
    Transaction,
    User,
)
from app.models.lesson import LessonStatus
from app.models.transaction import TransactionType
from app.schemas.dashboard import (
    TeacherDashboardResponse,
    TeacherGroupSummary,
    TeacherLesson,
    TeacherLessonStudent,
    TeacherStats,
    TeacherStudentInfo,
)
from app.schemas.lesson import (
    AttendanceBulkUpdate,
    LessonUpdate,
    TeacherLessonCreate,
)
from app.schemas.teacher_availability import (
    TeacherAvailabilityCreate,
    TeacherAvailabilityListResponse,
    TeacherAvailabilityResponse,
)

router = APIRouter()


def normalize_datetime_to_utc(dt: datetime | None) -> datetime | None:
    """Convert timezone-aware datetime to UTC naive datetime."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.get("/dashboard", response_model=TeacherDashboardResponse)
async def get_teacher_dashboard(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Get teacher dashboard data."""
    teacher_id = current_user.id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Count completed lessons this month
    lessons_conducted_result = await db.execute(
        select(func.count(Lesson.id)).where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.status == LessonStatus.COMPLETED,
                Lesson.scheduled_at >= month_start,
            )
        )
    )
    lessons_conducted = lessons_conducted_result.scalar() or 0

    # Get teacher's groups
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == teacher_id, Group.is_active))
        .options(selectinload(Group.students))
    )
    groups = groups_result.scalars().all()

    # Count unique students across all groups
    student_ids = set()
    for group in groups:
        for gs in group.students:
            student_ids.add(gs.student_id)
    students_count = len(student_ids)

    # Calculate workload (lessons this week / max possible lessons)
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    lessons_this_week_result = await db.execute(
        select(func.count(Lesson.id)).where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= week_start,
                Lesson.scheduled_at < week_end,
            )
        )
    )
    lessons_this_week = lessons_this_week_result.scalar() or 0
    # Assume max 40 lessons per week for 100% workload
    workload_percentage = min((lessons_this_week / 40) * 100, 100)

    # Get upcoming lessons
    upcoming_result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= now,
                Lesson.status == LessonStatus.SCHEDULED,
            )
        )
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
        .order_by(Lesson.scheduled_at)
        .limit(10)
    )
    upcoming_lessons = upcoming_result.scalars().all()

    # Build response
    stats = TeacherStats(
        lessons_conducted=lessons_conducted,
        workload_percentage=round(workload_percentage, 1),
        students_count=students_count,
        groups_count=len(groups),
    )

    groups_summary = [
        TeacherGroupSummary(
            id=g.id,
            name=g.name,
            students_count=len(g.students),
        )
        for g in groups
    ]

    lessons_list = []
    for lesson in upcoming_lessons:
        students = [
            TeacherLessonStudent(
                id=ls.student.id,
                name=ls.student.name,
                attendance_status=ls.attendance_status,
                charged=ls.charged,
            )
            for ls in lesson.students
        ]
        lessons_list.append(
            TeacherLesson(
                id=lesson.id,
                title=lesson.title,
                group_id=None,  # TODO: link lessons to groups
                group_name=None,
                lesson_type_id=lesson.lesson_type_id,
                lesson_type_name=lesson.lesson_type.name,
                lesson_type_price=lesson.lesson_type.price,
                scheduled_at=lesson.scheduled_at,
                duration_minutes=lesson.duration_minutes,
                meeting_url=lesson.meeting_url,
                status=lesson.status,
                students=students,
            )
        )

    return TeacherDashboardResponse(
        stats=stats,
        upcoming_lessons=lessons_list,
        groups=groups_summary,
    )


@router.get("/schedule", response_model=list[TeacherLesson])
async def get_teacher_schedule(
    db: DBSession,
    current_user: TeacherOnlyUser,
    date_from: datetime,
    date_to: datetime,
):
    """Get teacher's lesson schedule for a date range."""
    # Convert to UTC naive datetime for comparison with naive datetime in DB
    date_from_naive = normalize_datetime_to_utc(date_from)
    date_to_naive = normalize_datetime_to_utc(date_to)

    result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == current_user.id,
                Lesson.scheduled_at >= date_from_naive,
                Lesson.scheduled_at <= date_to_naive,
            )
        )
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
        .order_by(Lesson.scheduled_at)
    )
    lessons = result.scalars().all()

    return [
        TeacherLesson(
            id=lesson.id,
            title=lesson.title,
            group_id=None,
            group_name=None,
            lesson_type_id=lesson.lesson_type_id,
            lesson_type_name=lesson.lesson_type.name,
            lesson_type_price=lesson.lesson_type.price,
            scheduled_at=lesson.scheduled_at,
            duration_minutes=lesson.duration_minutes,
            meeting_url=lesson.meeting_url,
            status=lesson.status,
            students=[
                TeacherLessonStudent(
                    id=ls.student.id,
                    name=ls.student.name,
                    attendance_status=ls.attendance_status,
                    charged=ls.charged,
                )
                for ls in lesson.students
            ],
        )
        for lesson in lessons
    ]


@router.get("/groups", response_model=list[TeacherGroupSummary])
async def get_teacher_groups(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Get teacher's groups."""
    result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == current_user.id, Group.is_active))
        .options(selectinload(Group.students))
    )
    groups = result.scalars().all()

    return [
        TeacherGroupSummary(
            id=g.id,
            name=g.name,
            students_count=len(g.students),
        )
        for g in groups
    ]


@router.get("/students", response_model=list[TeacherStudentInfo])
async def get_teacher_students(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Get all students from teacher's groups and individual lessons."""
    # Get groups
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == current_user.id, Group.is_active))
        .options(selectinload(Group.students).selectinload(GroupStudent.student))
    )
    groups = groups_result.scalars().all()

    # Collect students with their groups
    students_map: dict[int, dict] = {}
    for group in groups:
        for gs in group.students:
            student = gs.student
            if student.id not in students_map:
                students_map[student.id] = {
                    "student": student,
                    "group_names": [],
                }
            students_map[student.id]["group_names"].append(group.name)

    # Also get students from individual lessons (not in groups)
    lessons_result = await db.execute(
        select(LessonStudent)
        .join(Lesson)
        .where(Lesson.teacher_id == current_user.id)
        .options(selectinload(LessonStudent.student))
    )
    lesson_students = lessons_result.scalars().all()

    for ls in lesson_students:
        student = ls.student
        if student and student.id not in students_map:
            students_map[student.id] = {
                "student": student,
                "group_names": [],
            }

    return [
        TeacherStudentInfo(
            id=data["student"].id,
            name=data["student"].name,
            email=data["student"].email,
            phone=data["student"].phone,
            balance=data["student"].balance,
            group_names=data["group_names"],
        )
        for data in students_map.values()
    ]


@router.get("/my-students-for-lessons", response_model=list)
async def get_my_students_for_lessons(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """
    Get list of students for lesson creation (only students who had lessons with this teacher).
    Returns students in UserResponse format for SearchableSelect.
    """
    # Get unique student IDs from all lessons of this teacher
    result = await db.execute(
        select(LessonStudent.student_id)
        .join(Lesson)
        .where(Lesson.teacher_id == current_user.id)
        .distinct()
    )
    student_ids = [row[0] for row in result.all()]

    if not student_ids:
        return []

    # Get student details
    students_result = await db.execute(
        select(User).where(
            and_(
                User.id.in_(student_ids),
                User.is_active == True,
            )
        )
        .order_by(User.name)
    )
    students = students_result.scalars().all()

    # Return in UserResponse format
    from app.schemas.user import UserResponse
    return [UserResponse.model_validate(student) for student in students]


@router.get("/my-groups-for-lessons", response_model=list)
async def get_my_groups_for_lessons(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """
    Get list of groups for lesson creation (only groups where teacher teaches).
    """
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == current_user.id, Group.is_active))
        .order_by(Group.name)
    )
    groups = groups_result.scalars().all()

    # Return in simple format for SearchableSelect
    from app.schemas.group import GroupResponse
    return [GroupResponse.model_validate(group) for group in groups]


# ============ MANAGER ENDPOINTS (view teacher data) ============


@router.get("/dashboard/{teacher_id}", response_model=TeacherDashboardResponse)
async def get_teacher_dashboard_by_id(
    teacher_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Manager can view specific teacher's dashboard."""
    # Verify teacher exists
    teacher = await db.get(User, teacher_id)
    if not teacher or teacher.role.value != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Count completed lessons this month
    lessons_conducted_result = await db.execute(
        select(func.count(Lesson.id)).where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.status == LessonStatus.COMPLETED,
                Lesson.scheduled_at >= month_start,
            )
        )
    )
    lessons_conducted = lessons_conducted_result.scalar() or 0

    # Get teacher's groups
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == teacher_id, Group.is_active))
        .options(selectinload(Group.students))
    )
    groups = groups_result.scalars().all()

    # Count unique students across all groups
    student_ids = set()
    for group in groups:
        for gs in group.students:
            student_ids.add(gs.student_id)
    students_count = len(student_ids)

    # Calculate workload
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    lessons_this_week_result = await db.execute(
        select(func.count(Lesson.id)).where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= week_start,
                Lesson.scheduled_at < week_end,
            )
        )
    )
    lessons_this_week = lessons_this_week_result.scalar() or 0
    workload_percentage = min((lessons_this_week / 40) * 100, 100)

    # Get upcoming lessons
    upcoming_result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= now,
                Lesson.status == LessonStatus.SCHEDULED,
            )
        )
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
        .order_by(Lesson.scheduled_at)
        .limit(10)
    )
    upcoming_lessons = upcoming_result.scalars().all()

    # Build response
    stats = TeacherStats(
        lessons_conducted=lessons_conducted,
        workload_percentage=round(workload_percentage, 1),
        students_count=students_count,
        groups_count=len(groups),
    )

    groups_summary = [
        TeacherGroupSummary(
            id=g.id,
            name=g.name,
            students_count=len(g.students),
        )
        for g in groups
    ]

    lessons_list = []
    for lesson in upcoming_lessons:
        students = [
            TeacherLessonStudent(
                id=ls.student.id,
                name=ls.student.name,
                attendance_status=ls.attendance_status,
                charged=ls.charged,
            )
            for ls in lesson.students
        ]
        lessons_list.append(
            TeacherLesson(
                id=lesson.id,
                title=lesson.title,
                group_id=None,
                group_name=None,
                lesson_type_id=lesson.lesson_type_id,
                lesson_type_name=lesson.lesson_type.name,
                lesson_type_price=lesson.lesson_type.price,
                scheduled_at=lesson.scheduled_at,
                duration_minutes=lesson.duration_minutes,
                meeting_url=lesson.meeting_url,
                status=lesson.status,
                students=students,
            )
        )

    return TeacherDashboardResponse(
        stats=stats,
        upcoming_lessons=lessons_list,
        groups=groups_summary,
    )


@router.get("/schedule/{teacher_id}", response_model=list[TeacherLesson])
async def get_teacher_schedule_by_id(
    teacher_id: int,
    db: DBSession,
    current_user: ManagerUser,
    date_from: datetime,
    date_to: datetime,
):
    """Manager can view specific teacher's schedule."""
    # Convert to UTC naive datetime for comparison with naive datetime in DB
    date_from_naive = normalize_datetime_to_utc(date_from)
    date_to_naive = normalize_datetime_to_utc(date_to)

    # Verify teacher exists
    teacher = await db.get(User, teacher_id)
    if not teacher or teacher.role.value != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")

    result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= date_from_naive,
                Lesson.scheduled_at <= date_to_naive,
            )
        )
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
        .order_by(Lesson.scheduled_at)
    )
    lessons = result.scalars().all()

    return [
        TeacherLesson(
            id=lesson.id,
            title=lesson.title,
            group_id=None,
            group_name=None,
            lesson_type_id=lesson.lesson_type_id,
            lesson_type_name=lesson.lesson_type.name,
            lesson_type_price=lesson.lesson_type.price,
            scheduled_at=lesson.scheduled_at,
            duration_minutes=lesson.duration_minutes,
            meeting_url=lesson.meeting_url,
            status=lesson.status,
            students=[
                TeacherLessonStudent(
                    id=ls.student.id,
                    name=ls.student.name,
                    attendance_status=ls.attendance_status,
                    charged=ls.charged,
                )
                for ls in lesson.students
            ],
        )
        for lesson in lessons
    ]


@router.get("/students/{teacher_id}", response_model=list[TeacherStudentInfo])
async def get_teacher_students_by_id(
    teacher_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Manager can view specific teacher's students."""
    # Verify teacher exists
    teacher = await db.get(User, teacher_id)
    if not teacher or teacher.role.value != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")

    # Get groups
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == teacher_id, Group.is_active))
        .options(selectinload(Group.students).selectinload(GroupStudent.student))
    )
    groups = groups_result.scalars().all()

    # Collect students with their groups
    students_map: dict[int, dict] = {}
    for group in groups:
        for gs in group.students:
            student = gs.student
            if student.id not in students_map:
                students_map[student.id] = {
                    "student": student,
                    "group_names": [],
                }
            students_map[student.id]["group_names"].append(group.name)

    # Also get students from individual lessons (not in groups)
    lessons_result = await db.execute(
        select(LessonStudent)
        .join(Lesson)
        .where(Lesson.teacher_id == teacher_id)
        .options(selectinload(LessonStudent.student))
    )
    lesson_students = lessons_result.scalars().all()

    for ls in lesson_students:
        student = ls.student
        if student and student.id not in students_map:
            students_map[student.id] = {
                "student": student,
                "group_names": [],
            }

    return [
        TeacherStudentInfo(
            id=data["student"].id,
            name=data["student"].name,
            email=data["student"].email,
            phone=data["student"].phone,
            balance=data["student"].balance,
            group_names=data["group_names"],
        )
        for data in students_map.values()
    ]


# ============ TEACHER LESSON ENDPOINTS ============


@router.get("/lessons/{lesson_id}", response_model=TeacherLesson)
async def get_teacher_lesson(
    lesson_id: int,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Get specific lesson details for the teacher."""
    result = await db.execute(
        select(Lesson)
        .where(and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id))
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return TeacherLesson(
        id=lesson.id,
        title=lesson.title,
        group_id=None,
        group_name=None,
        lesson_type_id=lesson.lesson_type_id,
        lesson_type_name=lesson.lesson_type.name,
        lesson_type_price=lesson.lesson_type.price,
        scheduled_at=lesson.scheduled_at,
        duration_minutes=lesson.duration_minutes,
        meeting_url=lesson.meeting_url,
        status=lesson.status,
        students=[
            TeacherLessonStudent(
                id=ls.student.id,
                name=ls.student.name,
                attendance_status=ls.attendance_status,
                charged=ls.charged,
            )
            for ls in lesson.students
        ],
    )


@router.post(
    "/lessons", response_model=TeacherLesson, status_code=status.HTTP_201_CREATED
)
async def create_teacher_lesson(
    data: TeacherLessonCreate,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Create a new lesson for the teacher with conflict checking and group support."""
    # Verify lesson type exists
    lesson_type = await db.get(LessonType, data.lesson_type_id)
    if not lesson_type:
        raise HTTPException(status_code=400, detail="Тип занятия не найден")

    # Verify group exists if provided
    group = None
    if data.group_id:
        group = await db.get(Group, data.group_id)
        if not group:
            raise HTTPException(status_code=400, detail="Группа не найдена")
        # Verify teacher owns this group
        if group.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="Это не ваша группа")

    # Check teacher conflict
    teacher_conflict = await check_teacher_conflict(
        db, current_user.id, data.scheduled_at
    )
    if teacher_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"У вас уже есть урок в это время: {teacher_conflict.title}",
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
                f"{c['student_name']}" for c in student_conflicts[:3]
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

    # Create lesson with teacher as owner
    lesson = Lesson(
        title=data.title,
        teacher_id=current_user.id,
        group_id=data.group_id,
        lesson_type_id=data.lesson_type_id,
        scheduled_at=data.scheduled_at,
        duration_minutes=data.duration_minutes,
        meeting_url=data.meeting_url,
        status=LessonStatus.SCHEDULED,
    )
    db.add(lesson)
    await db.flush()

    # Add students
    for student_id in student_ids:
        student = await db.get(User, student_id)
        if student and student.role.value == "student" and student.is_active:
            lesson_student = LessonStudent(
                lesson_id=lesson.id,
                student_id=student_id,
                attendance_status=AttendanceStatus.PENDING,
                charged=False,
            )
            db.add(lesson_student)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Lesson)
        .where(Lesson.id == lesson.id)
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
            selectinload(Lesson.group),
        )
    )
    lesson = result.scalar_one()

    return TeacherLesson(
        id=lesson.id,
        title=lesson.title,
        group_id=lesson.group_id,
        group_name=lesson.group.name if lesson.group else None,
        lesson_type_id=lesson.lesson_type_id,
        lesson_type_name=lesson.lesson_type.name,
        lesson_type_price=lesson.lesson_type.price,
        scheduled_at=lesson.scheduled_at,
        duration_minutes=lesson.duration_minutes,
        meeting_url=lesson.meeting_url,
        status=lesson.status,
        students=[
            TeacherLessonStudent(
                id=ls.student.id,
                name=ls.student.name,
                attendance_status=ls.attendance_status,
                charged=ls.charged,
            )
            for ls in lesson.students
        ],
    )


@router.put("/lessons/{lesson_id}", response_model=TeacherLesson)
async def update_teacher_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Update a lesson (only teacher's own lessons) with conflict checking."""
    result = await db.execute(
        select(Lesson)
        .where(and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id))
        .options(selectinload(Lesson.students))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    # Check for conflicts if time is changing
    if data.scheduled_at is not None and data.scheduled_at != lesson.scheduled_at:
        # Check teacher conflict
        teacher_conflict = await check_teacher_conflict(
            db, current_user.id, data.scheduled_at, exclude_lesson_id=lesson_id
        )
        if teacher_conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"У вас уже есть урок в это время: {teacher_conflict.title}",
            )

        # Check students conflicts
        student_ids = [ls.student_id for ls in lesson.students]
        if student_ids:
            student_conflicts = await check_students_conflict(
                db, student_ids, data.scheduled_at, exclude_lesson_id=lesson_id
            )
            if student_conflicts:
                conflict_details = ", ".join(
                    f"{c['student_name']}" for c in student_conflicts[:3]
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

    # Update allowed fields
    if data.title is not None:
        lesson.title = data.title
    if data.scheduled_at is not None:
        lesson.scheduled_at = data.scheduled_at
    if data.meeting_url is not None:
        lesson.meeting_url = data.meeting_url
    if data.status is not None:
        lesson.status = data.status

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(Lesson)
        .where(Lesson.id == lesson_id)
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
    )
    lesson = result.scalar_one()

    return TeacherLesson(
        id=lesson.id,
        title=lesson.title,
        group_id=None,
        group_name=None,
        lesson_type_id=lesson.lesson_type_id,
        lesson_type_name=lesson.lesson_type.name,
        lesson_type_price=lesson.lesson_type.price,
        scheduled_at=lesson.scheduled_at,
        duration_minutes=lesson.duration_minutes,
        meeting_url=lesson.meeting_url,
        status=lesson.status,
        students=[
            TeacherLessonStudent(
                id=ls.student.id,
                name=ls.student.name,
                attendance_status=ls.attendance_status,
                charged=ls.charged,
            )
            for ls in lesson.students
        ],
    )


@router.delete("/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_teacher_lesson(
    lesson_id: int,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Cancel a lesson (sets status to cancelled) and notify students."""
    result = await db.execute(
        select(Lesson)
        .where(and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id))
        .options(selectinload(Lesson.students))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.status = LessonStatus.CANCELLED

    # Notify all students about the cancellation
    formatted_date = lesson.scheduled_at.strftime("%d.%m.%Y %H:%M")
    for lesson_student in lesson.students:
        notification = Notification(
            user_id=lesson_student.student_id,
            type=NotificationType.LESSON_CANCELLED.value,
            title="Урок отменён",
            message=f'Урок "{lesson.title}" ({formatted_date}) был отменён преподавателем.',
            data={"lesson_id": lesson_id},
        )
        db.add(notification)

    await db.commit()


@router.post("/lessons/{lesson_id}/attendance")
async def mark_attendance(
    lesson_id: int,
    data: AttendanceBulkUpdate,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """
    Mark attendance for a lesson.

    Attendance statuses and their effects:
    - present: Student attended, student balance is charged, teacher gets paid
    - absent_excused: Student absent with valid excuse, NO charge
    - absent_unexcused: Student absent without excuse, student balance is charged, teacher gets paid
    """
    # Verify lesson belongs to this teacher
    result = await db.execute(
        select(Lesson)
        .where(and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id))
        .options(selectinload(Lesson.lesson_type))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Get lesson price (for student)
    price = lesson.lesson_type.price
    lesson_type_id = lesson.lesson_type_id

    # Get the teacher
    teacher = await db.get(User, current_user.id)

    for attendance in data.attendances:
        # Get lesson_student record
        ls_result = await db.execute(
            select(LessonStudent).where(
                and_(
                    LessonStudent.lesson_id == lesson_id,
                    LessonStudent.student_id == attendance.student_id,
                )
            )
        )
        lesson_student = ls_result.scalar_one_or_none()

        if not lesson_student:
            continue

        new_status = attendance.status
        was_charged = lesson_student.charged

        # Update attendance status
        lesson_student.attendance_status = new_status

        # Determine if we should charge
        should_charge = new_status in [
            AttendanceStatus.PRESENT,
            AttendanceStatus.ABSENT_UNEXCUSED,
        ]

        if should_charge and not was_charged:
            # Get student with their level
            student = await db.get(User, attendance.student_id)
            if student:
                # Check if student has sufficient balance (cannot go negative)
                if student.balance >= price:
                    # Charge student
                    student.balance -= price

                    # Create student transaction (debit)
                    description = (
                        f"Урок: {lesson.title}"
                        if new_status == AttendanceStatus.PRESENT
                        else f"Неявка без уважительной причины: {lesson.title}"
                    )
                    transaction = Transaction(
                        user_id=attendance.student_id,
                        amount=price,
                        type=TransactionType.DEBIT,
                        lesson_id=lesson_id,
                        description=description,
                        created_by_id=current_user.id,
                    )
                    db.add(transaction)
                    lesson_student.charged = True

                    # Check for low balance and create notification
                    LOW_BALANCE_THRESHOLD = Decimal("5000")
                    if student.balance < LOW_BALANCE_THRESHOLD:
                        if student.balance == 0:
                            notification_message = (
                                "Ваш баланс равен 0. Пожалуйста, "
                                "пополните баланс для продолжения занятий."
                            )
                        else:
                            notification_message = (
                                f"Ваш баланс низкий: {student.balance:,.0f} тг. "
                                "Рекомендуем пополнить баланс."
                            )

                        notification = Notification(
                            user_id=student.id,
                            type=NotificationType.LOW_BALANCE.value,
                            title="Низкий баланс",
                            message=notification_message,
                            data={"balance": str(student.balance)},
                        )
                        db.add(notification)
                else:
                    # Insufficient balance - create notification but don't charge
                    message = (
                        f"Не удалось списать оплату за урок '{lesson.title}'. "
                        f"Баланс: {student.balance:,.0f} тг, "
                        f"стоимость: {price:,.0f} тг."
                    )
                    notification = Notification(
                        user_id=student.id,
                        type=NotificationType.LOW_BALANCE.value,
                        title="Недостаточно средств",
                        message=message,
                        data={"balance": str(student.balance), "price": str(price)},
                    )
                    db.add(notification)
                    # Note: lesson_student.charged stays False

                # Pay teacher only if student was actually charged
                if teacher and lesson_student.charged:
                    teacher_payment = None

                    # Try to look up payment amount from matrix
                    if teacher.level_id:
                        payment_result = await db.execute(
                            select(LevelLessonTypePayment).where(
                                and_(
                                    LevelLessonTypePayment.level_id == teacher.level_id,
                                    LevelLessonTypePayment.lesson_type_id
                                    == lesson_type_id,
                                )
                            )
                        )
                        payment_config = payment_result.scalar_one_or_none()
                        if payment_config:
                            teacher_payment = payment_config.teacher_payment

                    # Fallback: 50% of lesson price if no matrix config
                    if teacher_payment is None:
                        teacher_payment = price * Decimal("0.5")

                    teacher.balance += teacher_payment

                    # Create teacher transaction (credit)
                    teacher_transaction = Transaction(
                        user_id=teacher.id,
                        amount=teacher_payment,
                        type=TransactionType.CREDIT,
                        lesson_id=lesson_id,
                        description=f"Оплата за урок: {lesson.title} ({student.name})",
                        created_by_id=current_user.id,
                    )
                    db.add(teacher_transaction)

        elif not should_charge and was_charged:
            # Refund student (status changed from charged to excused)
            student = await db.get(User, attendance.student_id)
            if student:
                student.balance += price

                # Create refund transaction
                transaction = Transaction(
                    user_id=attendance.student_id,
                    amount=price,
                    type=TransactionType.CREDIT,
                    lesson_id=lesson_id,
                    description=f"Возврат за урок (уважительная причина): {lesson.title}",
                    created_by_id=current_user.id,
                )
                db.add(transaction)
                lesson_student.charged = False

                # Reverse teacher payment
                if teacher and teacher.level_id:
                    payment_result = await db.execute(
                        select(LevelLessonTypePayment).where(
                            and_(
                                LevelLessonTypePayment.level_id == teacher.level_id,
                                LevelLessonTypePayment.lesson_type_id == lesson_type_id,
                            )
                        )
                    )
                    payment_config = payment_result.scalar_one_or_none()

                    if payment_config:
                        teacher_payment = payment_config.teacher_payment
                        teacher.balance -= teacher_payment

                        # Create teacher debit transaction (reversal)
                        teacher_transaction = Transaction(
                            user_id=teacher.id,
                            amount=teacher_payment,
                            type=TransactionType.DEBIT,
                            lesson_id=lesson_id,
                            description=f"Отмена оплаты за урок: {lesson.title} ({student.name})",
                            created_by_id=current_user.id,
                        )
                        db.add(teacher_transaction)

    # Mark lesson as completed if all students have been marked
    all_marked_result = await db.execute(
        select(LessonStudent).where(
            and_(
                LessonStudent.lesson_id == lesson_id,
                LessonStudent.attendance_status == AttendanceStatus.PENDING,
            )
        )
    )
    pending_students = all_marked_result.scalars().all()
    if not pending_students:
        lesson.status = LessonStatus.COMPLETED

    await db.commit()

    return {"success": True}


# ============ TEACHER AVAILABILITY ENDPOINTS ============


@router.get("/availability", response_model=TeacherAvailabilityListResponse)
async def get_my_availability(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Get teacher's own availability slots."""
    result = await db.execute(
        select(TeacherAvailability)
        .where(TeacherAvailability.teacher_id == current_user.id)
        .order_by(TeacherAvailability.day_of_week, TeacherAvailability.start_time)
    )
    items = result.scalars().all()

    return TeacherAvailabilityListResponse(items=items)


@router.post(
    "/availability",
    response_model=TeacherAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_availability(
    data: TeacherAvailabilityCreate,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Create a new availability slot for the teacher."""
    from datetime import time as time_type

    start_time = time_type.fromisoformat(data.start_time)
    end_time = time_type.fromisoformat(data.end_time)

    if start_time >= end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Время начала должно быть раньше времени окончания",
        )

    availability = TeacherAvailability(
        teacher_id=current_user.id,
        day_of_week=data.day_of_week.value,
        start_time=start_time,
        end_time=end_time,
    )
    db.add(availability)
    await db.commit()
    await db.refresh(availability)

    return availability


@router.delete(
    "/availability/{availability_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_availability(
    availability_id: int,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Delete an availability slot."""
    result = await db.execute(
        select(TeacherAvailability).where(
            and_(
                TeacherAvailability.id == availability_id,
                TeacherAvailability.teacher_id == current_user.id,
            )
        )
    )
    availability = result.scalar_one_or_none()

    if not availability:
        raise HTTPException(status_code=404, detail="Слот не найден")

    await db.delete(availability)
    await db.commit()


@router.get(
    "/availability/{teacher_id}",
    response_model=TeacherAvailabilityListResponse,
)
async def get_teacher_availability(
    teacher_id: int,
    db: DBSession,
    current_user: ManagerUser,
):
    """Manager can view specific teacher's availability."""
    # Verify teacher exists
    teacher = await db.get(User, teacher_id)
    if not teacher or teacher.role.value != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")

    result = await db.execute(
        select(TeacherAvailability)
        .where(TeacherAvailability.teacher_id == teacher_id)
        .order_by(TeacherAvailability.day_of_week, TeacherAvailability.start_time)
    )
    items = result.scalars().all()

    return TeacherAvailabilityListResponse(items=items)


# ============ TEACHER LESSONS WITH MATERIALS ============


@router.get("/lessons-with-materials")
async def get_teacher_lessons_with_materials(
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """
    Get teacher's lessons with materials.
    Shows all lessons (past and future) with attached materials.
    """
    # Get teacher's lessons
    result = await db.execute(
        select(Lesson)
        .where(Lesson.teacher_id == current_user.id)
        .options(
            selectinload(Lesson.students).selectinload(LessonStudent.student),
            selectinload(Lesson.lesson_type),
        )
        .order_by(Lesson.scheduled_at.desc())
    )
    lessons = result.scalars().all()

    # Get materials for each lesson
    lessons_with_materials = []
    for lesson in lessons:
        # Get materials for this lesson
        materials_result = await db.execute(
            select(LessonMaterial)
            .where(LessonMaterial.lesson_id == lesson.id)
            .options(selectinload(LessonMaterial.material))
        )
        lesson_materials = materials_result.scalars().all()

        materials_list = [
            {
                "id": lm.material.id,
                "title": lm.material.title,
                "file_url": lm.material.file_url,
            }
            for lm in lesson_materials
        ]

        # Get student names
        student_names = [ls.student.name for ls in lesson.students if ls.student]

        lessons_with_materials.append(
            {
                "id": lesson.id,
                "title": lesson.title,
                "scheduled_at": lesson.scheduled_at.isoformat(),
                "lesson_type_name": lesson.lesson_type.name,
                "meeting_url": lesson.meeting_url,
                "status": lesson.status.value,
                "group_id": lesson.group_id,
                "students": student_names,
                "materials": materials_list,
            }
        )

    return lessons_with_materials
