from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, TeacherOnlyUser, ManagerUser
from app.api.lessons import check_teacher_conflict, check_students_conflict
from app.models import (
    AttendanceStatus,
    Group,
    GroupStudent,
    Lesson,
    LessonStudent,
    LessonType,
    LevelLessonTypePayment,
    Notification,
    NotificationType,
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
from app.schemas.lesson import AttendanceBulkUpdate, LessonCreate, LessonUpdate

router = APIRouter()


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
        .where(and_(Group.teacher_id == teacher_id, Group.is_active == True))
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
    result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == current_user.id,
                Lesson.scheduled_at >= date_from,
                Lesson.scheduled_at <= date_to,
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
        .where(and_(Group.teacher_id == current_user.id, Group.is_active == True))
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
    """Get all students from teacher's groups."""
    # Get groups
    groups_result = await db.execute(
        select(Group)
        .where(and_(Group.teacher_id == current_user.id, Group.is_active == True))
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
        .where(and_(Group.teacher_id == teacher_id, Group.is_active == True))
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
    # Verify teacher exists
    teacher = await db.get(User, teacher_id)
    if not teacher or teacher.role.value != "teacher":
        raise HTTPException(status_code=404, detail="Teacher not found")

    result = await db.execute(
        select(Lesson)
        .where(
            and_(
                Lesson.teacher_id == teacher_id,
                Lesson.scheduled_at >= date_from,
                Lesson.scheduled_at <= date_to,
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
        .where(and_(Group.teacher_id == teacher_id, Group.is_active == True))
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


@router.post("/lessons", response_model=TeacherLesson, status_code=status.HTTP_201_CREATED)
async def create_teacher_lesson(
    data: LessonCreate,
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
    teacher_conflict = await check_teacher_conflict(db, current_user.id, data.scheduled_at)
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

    # Check students conflicts
    if student_ids:
        student_conflicts = await check_students_conflict(db, student_ids, data.scheduled_at)
        if student_conflicts:
            conflict_details = ", ".join(
                f"{c['student_name']}"
                for c in student_conflicts[:3]
            )
            more = f" и ещё {len(student_conflicts) - 3}" if len(student_conflicts) > 3 else ""
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
                    f"{c['student_name']}"
                    for c in student_conflicts[:3]
                )
                more = f" и ещё {len(student_conflicts) - 3}" if len(student_conflicts) > 3 else ""
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
            message=f"Урок \"{lesson.title}\" ({formatted_date}) был отменён преподавателем.",
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

        old_status = lesson_student.attendance_status
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
                )
                db.add(transaction)
                lesson_student.charged = True

                # Check for low balance and create notification
                LOW_BALANCE_THRESHOLD = Decimal("5000")
                if student.balance < LOW_BALANCE_THRESHOLD:
                    if student.balance < 0:
                        notification_message = f"Ваш баланс стал отрицательным: {student.balance:,.0f} тг. Пожалуйста, пополните баланс."
                    else:
                        notification_message = f"Ваш баланс низкий: {student.balance:,.0f} тг. Рекомендуем пополнить баланс."

                    notification = Notification(
                        user_id=student.id,
                        type=NotificationType.LOW_BALANCE.value,
                        title="Низкий баланс",
                        message=notification_message,
                        data={"balance": str(student.balance)},
                    )
                    db.add(notification)

                # Pay teacher based on student's level and lesson type
                if student.level_id and teacher:
                    # Look up payment amount from matrix
                    payment_result = await db.execute(
                        select(LevelLessonTypePayment).where(
                            and_(
                                LevelLessonTypePayment.level_id == student.level_id,
                                LevelLessonTypePayment.lesson_type_id == lesson_type_id,
                            )
                        )
                    )
                    payment_config = payment_result.scalar_one_or_none()

                    if payment_config:
                        teacher_payment = payment_config.teacher_payment
                        teacher.balance += teacher_payment

                        # Create teacher transaction (credit)
                        teacher_transaction = Transaction(
                            user_id=teacher.id,
                            amount=teacher_payment,
                            type=TransactionType.CREDIT,
                            lesson_id=lesson_id,
                            description=f"Оплата за урок: {lesson.title} ({student.name})",
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
                )
                db.add(transaction)
                lesson_student.charged = False

                # Reverse teacher payment
                if student.level_id and teacher:
                    payment_result = await db.execute(
                        select(LevelLessonTypePayment).where(
                            and_(
                                LevelLessonTypePayment.level_id == student.level_id,
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
