from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, TeacherOnlyUser
from app.models import (
    AttendanceStatus,
    Group,
    GroupStudent,
    Lesson,
    LessonStudent,
    LessonType,
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
    """Create a new lesson for the teacher."""
    # Verify lesson type exists
    lesson_type = await db.get(LessonType, data.lesson_type_id)
    if not lesson_type:
        raise HTTPException(status_code=400, detail="Invalid lesson type")

    # Create lesson with teacher as owner
    lesson = Lesson(
        title=data.title,
        teacher_id=current_user.id,
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


@router.put("/lessons/{lesson_id}", response_model=TeacherLesson)
async def update_teacher_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: DBSession,
    current_user: TeacherOnlyUser,
):
    """Update a lesson (only teacher's own lessons)."""
    result = await db.execute(
        select(Lesson).where(
            and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id)
        )
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

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
    """Cancel a lesson (sets status to cancelled)."""
    result = await db.execute(
        select(Lesson).where(
            and_(Lesson.id == lesson_id, Lesson.teacher_id == current_user.id)
        )
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    lesson.status = LessonStatus.CANCELLED
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
    - present: Student attended, balance is charged
    - absent_excused: Student absent with valid excuse, NO charge
    - absent_unexcused: Student absent without excuse, balance is charged
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

    # Get lesson price
    price = lesson.lesson_type.price

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
            # Charge student
            student = await db.get(User, attendance.student_id)
            if student:
                student.balance -= price

                # Create transaction
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
