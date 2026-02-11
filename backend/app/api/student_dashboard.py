from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, StudentOnlyUser
from app.models import (
    AttendanceStatus,
    Group,
    GroupStudent,
    Lesson,
    LessonCourseMaterial,
    LessonMaterial,
    LessonStudent,
    MaterialAccess,
    TestAccess,
)
from app.models.course import Course, CourseSection, CourseTopic, InteractiveLesson
from app.models.lesson import LessonStatus
from app.schemas.dashboard import (
    StudentDashboardResponse,
    StudentGroupSummary,
    StudentLessonInfo,
    StudentMaterialInfo,
    StudentStats,
    StudentTestInfo,
)
from app.schemas.lesson_course_material import (
    StudentCourseMaterialView,
    StudentLessonItem,
    StudentSectionItem,
    StudentTopicItem,
)

router = APIRouter()


def normalize_datetime_to_utc(dt: datetime | None) -> datetime | None:
    """Convert timezone-aware datetime to UTC naive datetime."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


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
        .options(selectinload(GroupStudent.group).selectinload(Group.teacher))
    )
    group_students = groups_result.scalars().all()

    active_groups = [gs for gs in group_students if gs.group.is_active]

    # Get upcoming lessons count
    lessons_result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == student_id)
        .options(selectinload(LessonStudent.lesson))
    )
    lesson_students = lessons_result.scalars().all()

    upcoming_count = sum(
        1
        for ls in lesson_students
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
            teacher_id=gs.group.teacher.id if gs.group.teacher else None,
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
            selectinload(LessonStudent.lesson).selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson).selectinload(Lesson.lesson_type),
        )
    )
    all_lesson_students = upcoming_lessons_result.scalars().all()

    upcoming_lessons = sorted(
        [
            ls
            for ls in all_lesson_students
            if ls.lesson.scheduled_at >= now
            and ls.lesson.status == LessonStatus.SCHEDULED
        ],
        key=lambda ls: ls.lesson.scheduled_at,
    )[:10]

    lessons_list = [
        StudentLessonInfo(
            id=ls.lesson.id,
            title=ls.lesson.title,
            scheduled_at=ls.lesson.scheduled_at,
            teacher_id=ls.lesson.teacher.id,
            teacher_name=ls.lesson.teacher.name,
            lesson_type_name=ls.lesson.lesson_type.name,
            lesson_price=ls.lesson.lesson_type.price,
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
    # Convert to UTC naive datetime for comparison with naive datetime in DB
    date_from_naive = normalize_datetime_to_utc(date_from)
    date_to_naive = normalize_datetime_to_utc(date_to)

    result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == current_user.id)
        .options(
            selectinload(LessonStudent.lesson).selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson).selectinload(Lesson.lesson_type),
        )
    )
    lesson_students = result.scalars().all()

    lessons_in_range = [
        ls
        for ls in lesson_students
        if date_from_naive <= ls.lesson.scheduled_at <= date_to_naive
    ]

    return [
        StudentLessonInfo(
            id=ls.lesson.id,
            title=ls.lesson.title,
            scheduled_at=ls.lesson.scheduled_at,
            teacher_id=ls.lesson.teacher.id,
            teacher_name=ls.lesson.teacher.name,
            lesson_type_name=ls.lesson.lesson_type.name,
            lesson_price=ls.lesson.lesson_type.price,
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
        .options(selectinload(GroupStudent.group).selectinload(Group.teacher))
    )
    group_students = result.scalars().all()

    return [
        StudentGroupSummary(
            id=gs.group.id,
            name=gs.group.name,
            teacher_id=gs.group.teacher.id if gs.group.teacher else None,
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


@router.get("/lessons-with-materials")
async def get_student_lessons_with_materials(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """
    Get student's lessons with materials.
    Only shows lessons that:
    - Have started (scheduled_at <= now)
    - Are not older than 30 days (scheduled_at >= now - 30 days)
    - Have materials attached
    """
    now = datetime.utcnow()
    one_month_ago = now - timedelta(days=30)

    # Get student's lessons
    result = await db.execute(
        select(LessonStudent)
        .where(LessonStudent.student_id == current_user.id)
        .options(
            selectinload(LessonStudent.lesson).selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson).selectinload(Lesson.lesson_type),
        )
    )
    lesson_students = result.scalars().all()

    # Filter lessons: started and within last month
    filtered_lessons = [
        ls for ls in lesson_students if one_month_ago <= ls.lesson.scheduled_at <= now
    ]

    # Get materials for each lesson
    lessons_with_materials = []
    for ls in filtered_lessons:
        # Get materials for this lesson
        materials_result = await db.execute(
            select(LessonMaterial)
            .where(LessonMaterial.lesson_id == ls.lesson.id)
            .options(selectinload(LessonMaterial.material))
        )
        lesson_materials = materials_result.scalars().all()

        if lesson_materials:  # Only include lessons with materials
            materials_list = [
                {
                    "id": lm.material.id,
                    "title": lm.material.title,
                    "file_url": lm.material.file_url,
                }
                for lm in lesson_materials
            ]

            lessons_with_materials.append(
                {
                    "id": ls.lesson.id,
                    "title": ls.lesson.title,
                    "scheduled_at": ls.lesson.scheduled_at.isoformat(),
                    "teacher_name": ls.lesson.teacher.name,
                    "lesson_type_name": ls.lesson.lesson_type.name,
                    "meeting_url": ls.lesson.meeting_url,
                    "materials": materials_list,
                }
            )

    # Sort by scheduled_at descending (newest first)
    lessons_with_materials.sort(key=lambda x: x["scheduled_at"], reverse=True)

    return lessons_with_materials


@router.get("/course-materials")
async def get_student_course_materials(
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """
    Get course materials for student's lessons.
    Only shows materials from lessons where:
    - Student has attendance_status == PRESENT
    - Lesson has started (scheduled_at <= now)
    - Lesson is not older than 30 days
    """
    now = datetime.utcnow()
    one_month_ago = now - timedelta(days=30)

    # Get student's lesson participations with PRESENT status
    result = await db.execute(
        select(LessonStudent)
        .where(
            LessonStudent.student_id == current_user.id,
            LessonStudent.attendance_status == AttendanceStatus.PRESENT,
        )
        .options(
            selectinload(LessonStudent.lesson).selectinload(Lesson.teacher),
            selectinload(LessonStudent.lesson).selectinload(Lesson.lesson_type),
        )
    )
    lesson_students = result.scalars().all()

    # Filter lessons: started and within last month
    filtered_ls = [
        ls for ls in lesson_students
        if one_month_ago <= ls.lesson.scheduled_at <= now
    ]

    lessons_with_course_materials = []
    for ls in filtered_ls:
        # Get course materials for this lesson
        materials_result = await db.execute(
            select(LessonCourseMaterial)
            .where(LessonCourseMaterial.lesson_id == ls.lesson.id)
            .options(
                selectinload(LessonCourseMaterial.course),
                selectinload(LessonCourseMaterial.section),
                selectinload(LessonCourseMaterial.interactive_lesson),
            )
        )
        course_materials = materials_result.scalars().all()

        if course_materials:
            materials_list = []
            for cm in course_materials:
                material_info = {
                    "id": cm.id,
                    "material_type": cm.material_type.value,
                }
                if cm.course:
                    material_info["course_id"] = cm.course.id
                    material_info["course_title"] = cm.course.title
                if cm.section:
                    material_info["section_id"] = cm.section.id
                    material_info["section_title"] = cm.section.title
                if cm.interactive_lesson:
                    material_info["interactive_lesson_id"] = cm.interactive_lesson.id
                    material_info["interactive_lesson_title"] = cm.interactive_lesson.title
                materials_list.append(material_info)

            lessons_with_course_materials.append({
                "id": ls.lesson.id,
                "title": ls.lesson.title,
                "scheduled_at": ls.lesson.scheduled_at.isoformat(),
                "teacher_name": ls.lesson.teacher.name,
                "lesson_type_name": ls.lesson.lesson_type.name,
                "course_materials": materials_list,
            })

    # Sort by scheduled_at descending (newest first)
    lessons_with_course_materials.sort(key=lambda x: x["scheduled_at"], reverse=True)

    return lessons_with_course_materials


def _build_section_item(section: CourseSection) -> StudentSectionItem:
    """Build a StudentSectionItem from a CourseSection, including topics and direct lessons."""
    topics: list[StudentTopicItem] = []

    # Lessons from topics
    for topic in sorted(section.topics, key=lambda t: t.position):
        published_lessons = [
            StudentLessonItem(
                id=il.id,
                title=il.title,
                description=il.description,
                is_homework=il.is_homework,
            )
            for il in sorted(topic.lessons, key=lambda l: l.position)
            if il.is_published
        ]
        if published_lessons:
            topics.append(StudentTopicItem(
                id=topic.id,
                title=topic.title,
                description=topic.description,
                lessons=published_lessons,
            ))

    # Legacy: lessons directly on section (no topic)
    direct_lessons = [
        il for il in sorted(section.lessons, key=lambda l: l.position)
        if il.is_published and il.topic_id is None
    ]
    if direct_lessons:
        topics.append(StudentTopicItem(
            id=0,
            title="Уроки",
            description=None,
            lessons=[
                StudentLessonItem(
                    id=il.id,
                    title=il.title,
                    description=il.description,
                    is_homework=il.is_homework,
                )
                for il in direct_lessons
            ],
        ))

    return StudentSectionItem(
        id=section.id,
        title=section.title,
        description=section.description,
        topics=topics,
    )


@router.get("/course-material/{material_id}/view", response_model=StudentCourseMaterialView)
async def get_student_course_material_view(
    material_id: int,
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """
    Get filtered course material view for a student.
    Only returns the part of the course tree that was attached to the lesson.
    Requires PRESENT attendance status.
    """
    # Load the material
    result = await db.execute(
        select(LessonCourseMaterial)
        .where(LessonCourseMaterial.id == material_id)
    )
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Материал не найден")

    # Check student has PRESENT status for this lesson
    result = await db.execute(
        select(LessonStudent).where(
            LessonStudent.lesson_id == material.lesson_id,
            LessonStudent.student_id == current_user.id,
            LessonStudent.attendance_status == AttendanceStatus.PRESENT,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа к этому материалу")

    mat_type = material.material_type.value

    # lesson type → just return the interactive_lesson_id for redirect
    if mat_type == "lesson":
        return StudentCourseMaterialView(
            material_type=material.material_type,
            interactive_lesson_id=material.interactive_lesson_id,
        )

    # course type → load full course tree
    if mat_type == "course":
        result = await db.execute(
            select(Course)
            .where(Course.id == material.course_id)
            .options(
                selectinload(Course.sections)
                .selectinload(CourseSection.topics)
                .selectinload(CourseTopic.lessons),
                selectinload(Course.sections)
                .selectinload(CourseSection.lessons),
            )
        )
        course = result.scalar_one_or_none()
        if not course:
            raise HTTPException(status_code=404, detail="Курс не найден")

        sections = [
            item for s in sorted(course.sections, key=lambda s: s.position)
            if (item := _build_section_item(s)).topics
        ]

        return StudentCourseMaterialView(
            material_type=material.material_type,
            course_title=course.title,
            sections=sections,
        )

    # section type → load single section
    if mat_type == "section":
        result = await db.execute(
            select(CourseSection)
            .where(CourseSection.id == material.section_id)
            .options(
                selectinload(CourseSection.topics)
                .selectinload(CourseTopic.lessons),
                selectinload(CourseSection.lessons),
                selectinload(CourseSection.course),
            )
        )
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Секция не найдена")

        section_item = _build_section_item(section)
        sections = [section_item] if section_item.topics else []

        return StudentCourseMaterialView(
            material_type=material.material_type,
            course_title=section.course.title if section.course else None,
            section_title=section.title,
            sections=sections,
        )

    # topic type → load single topic
    if mat_type == "topic":
        result = await db.execute(
            select(CourseTopic)
            .where(CourseTopic.id == material.topic_id)
            .options(
                selectinload(CourseTopic.lessons),
                selectinload(CourseTopic.section).selectinload(CourseSection.course),
            )
        )
        topic = result.scalar_one_or_none()
        if not topic:
            raise HTTPException(status_code=404, detail="Топик не найден")

        published_lessons = [
            StudentLessonItem(
                id=il.id,
                title=il.title,
                description=il.description,
                is_homework=il.is_homework,
            )
            for il in sorted(topic.lessons, key=lambda l: l.position)
            if il.is_published
        ]

        topic_item = StudentTopicItem(
            id=topic.id,
            title=topic.title,
            description=topic.description,
            lessons=published_lessons,
        )

        section = topic.section
        section_item = StudentSectionItem(
            id=section.id,
            title=section.title,
            description=section.description,
            topics=[topic_item] if published_lessons else [],
        )

        return StudentCourseMaterialView(
            material_type=material.material_type,
            course_title=section.course.title if section.course else None,
            section_title=section.title,
            topic_title=topic.title,
            sections=[section_item] if section_item.topics else [],
        )
