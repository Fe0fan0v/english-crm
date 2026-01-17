from datetime import datetime

from fastapi import APIRouter
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, StudentOnlyUser
from app.models import (
    Group,
    GroupStudent,
    Lesson,
    LessonStudent,
    Material,
    MaterialAccess,
    Test,
    TestAccess,
    User,
)
from app.models.lesson import LessonStatus
from app.schemas.dashboard import (
    StudentDashboardResponse,
    StudentGroupSummary,
    StudentLessonInfo,
    StudentMaterialInfo,
    StudentStats,
    StudentTestInfo,
)

router = APIRouter()


@router.get("/dashboard", response_model=StudentDashboardResponse)
async def get_student_dashboard(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Get student dashboard data."""
    student_id = current_user.id
    now = datetime.utcnow()

    # Get student's groups
    groups_result = await db.execute(
        select(GroupStudent)
        .where(GroupStudent.student_id == student_id)
        .options(
            selectinload(GroupStudent.group).selectinload(Group.teacher)
        )
    )
    group_students = groups_result.scalars().all()

    active_groups = [
        gs for gs in group_students if gs.group.is_active
    ]

    # Get upcoming lessons count
    lessons_result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == student_id)
        .options(selectinload(LessonStudent.lesson))
    )
    lesson_students = lessons_result.scalars().all()

    upcoming_count = sum(
        1 for ls in lesson_students
        if ls.lesson.scheduled_at >= now and ls.lesson.status == LessonStatus.SCHEDULED
    )

    # Build stats
    stats = StudentStats(
        balance=current_user.balance,
        upcoming_lessons_count=upcoming_count,
        groups_count=len(active_groups),
    )

    # Build groups list
    groups_list = [
        StudentGroupSummary(
            id=gs.group.id,
            name=gs.group.name,
            teacher_name=gs.group.teacher.name if gs.group.teacher else None,
            has_unread_messages=False,  # TODO: implement unread tracking
        )
        for gs in active_groups
    ]

    # Get upcoming lessons (next 10)
    upcoming_lessons_result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == student_id)
        .options(
            selectinload(LessonStudent.lesson)
            .selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson)
            .selectinload(Lesson.lesson_type),
        )
    )
    all_lesson_students = upcoming_lessons_result.scalars().all()

    upcoming_lessons = sorted(
        [
            ls for ls in all_lesson_students
            if ls.lesson.scheduled_at >= now and ls.lesson.status == LessonStatus.SCHEDULED
        ],
        key=lambda ls: ls.lesson.scheduled_at,
    )[:10]

    lessons_list = [
        StudentLessonInfo(
            id=ls.lesson.id,
            title=ls.lesson.title,
            scheduled_at=ls.lesson.scheduled_at,
            teacher_name=ls.lesson.teacher.name,
            lesson_type_name=ls.lesson.lesson_type.name,
            meeting_url=ls.lesson.meeting_url,
            status=ls.lesson.status,
            group_name=None,  # TODO: link lessons to groups
        )
        for ls in upcoming_lessons
    ]

    return StudentDashboardResponse(
        stats=stats,
        upcoming_lessons=lessons_list,
        groups=groups_list,
    )


@router.get("/schedule", response_model=list[StudentLessonInfo])
async def get_student_schedule(
    db: DBSession,
    current_user: StudentOnlyUser,
    date_from: datetime,
    date_to: datetime,
):
    """Get student's lesson schedule for a date range."""
    result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == current_user.id)
        .options(
            selectinload(LessonStudent.lesson)
            .selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson)
            .selectinload(Lesson.lesson_type),
        )
    )
    lesson_students = result.scalars().all()

    lessons_in_range = [
        ls for ls in lesson_students
        if date_from <= ls.lesson.scheduled_at <= date_to
    ]

    return [
        StudentLessonInfo(
            id=ls.lesson.id,
            title=ls.lesson.title,
            scheduled_at=ls.lesson.scheduled_at,
            teacher_name=ls.lesson.teacher.name,
            lesson_type_name=ls.lesson.lesson_type.name,
            meeting_url=ls.lesson.meeting_url,
            status=ls.lesson.status,
            group_name=None,
        )
        for ls in sorted(lessons_in_range, key=lambda ls: ls.lesson.scheduled_at)
    ]


@router.get("/groups", response_model=list[StudentGroupSummary])
async def get_student_groups(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Get student's groups."""
    result = await db.execute(
        select(GroupStudent)
        .where(GroupStudent.student_id == current_user.id)
        .options(
            selectinload(GroupStudent.group).selectinload(Group.teacher)
        )
    )
    group_students = result.scalars().all()

    return [
        StudentGroupSummary(
            id=gs.group.id,
            name=gs.group.name,
            teacher_name=gs.group.teacher.name if gs.group.teacher else None,
            has_unread_messages=False,
        )
        for gs in group_students
        if gs.group.is_active
    ]


@router.get("/materials", response_model=list[StudentMaterialInfo])
async def get_student_materials(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Get materials accessible to the student."""
    result = await db.execute(
        select(MaterialAccess)
        .where(
            and_(
                MaterialAccess.student_id == current_user.id,
                MaterialAccess.revoked_at.is_(None),
            )
        )
        .options(selectinload(MaterialAccess.material))
    )
    accesses = result.scalars().all()

    return [
        StudentMaterialInfo(
            id=access.material.id,
            title=access.material.title,
            file_url=access.material.file_url,
            granted_at=access.granted_at,
        )
        for access in accesses
    ]


@router.get("/tests", response_model=list[StudentTestInfo])
async def get_student_tests(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Get tests accessible to the student."""
    result = await db.execute(
        select(TestAccess)
        .where(
            and_(
                TestAccess.student_id == current_user.id,
                TestAccess.revoked_at.is_(None),
            )
        )
        .options(selectinload(TestAccess.test))
    )
    accesses = result.scalars().all()

    return [
        StudentTestInfo(
            id=access.test.id,
            title=access.test.title,
            granted_at=access.granted_at,
        )
        for access in accesses
    ]
