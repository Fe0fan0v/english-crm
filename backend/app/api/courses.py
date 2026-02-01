from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, CurrentUser, TeacherUser, get_db
from app.models.course import Course, CourseSection, ExerciseBlock, InteractiveLesson
from app.models.user import User, UserRole
from app.schemas.course import (
    CourseCreate,
    CourseDetailResponse,
    CourseListResponse,
    CourseResponse,
    CourseSectionCreate,
    CourseSectionDetailResponse,
    CourseSectionResponse,
    CourseSectionUpdate,
    CourseUpdate,
    ExerciseBlockCreate,
    ExerciseBlockResponse,
    ExerciseBlockUpdate,
    InteractiveLessonCreate,
    InteractiveLessonDetailResponse,
    InteractiveLessonResponse,
    InteractiveLessonUpdate,
    ReorderRequest,
)
from app.schemas.lesson_course_material import CourseTreeItem

router = APIRouter()


def can_edit_course(user: User, course: Course) -> bool:
    """Check if user can edit the course. Only admin can edit courses."""
    return user.role == UserRole.ADMIN


def can_view_course(user: User, course: Course) -> bool:
    """Check if user can view the course."""
    if user.role in [UserRole.ADMIN, UserRole.MANAGER, UserRole.TEACHER]:
        return True
    if user.role == UserRole.STUDENT and course.is_published:
        return True
    return False


# ============== Course Tree (for material selection) ==============

@router.get("/courses/tree", response_model=list[CourseTreeItem])
async def get_courses_tree(
    current_user: TeacherUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Get tree of published courses for material selection.
    Used by teachers to attach course materials to lessons.
    Returns:
    [
      {id: 1, title: "Beginner", type: "course", children: [
        {id: 10, title: "A-1", type: "section", children: [
          {id: 100, title: "Warm Up", type: "lesson", children: []},
          {id: 101, title: "Listening", type: "lesson", children: []}
        ]}
      ]}
    ]
    """
    # Get all published courses with their sections and lessons
    result = await db.execute(
        select(Course)
        .where(Course.is_published == True)  # noqa: E712
        .options(
            selectinload(Course.sections)
            .selectinload(CourseSection.lessons)
        )
        .order_by(Course.title)
    )
    courses = result.scalars().all()

    tree = []
    for course in courses:
        course_item = CourseTreeItem(
            id=course.id,
            title=course.title,
            type="course",
            children=[]
        )
        for section in sorted(course.sections, key=lambda s: s.position):
            section_item = CourseTreeItem(
                id=section.id,
                title=section.title,
                type="section",
                children=[]
            )
            for lesson in sorted(section.lessons, key=lambda l: l.position):
                # Only include published lessons
                if lesson.is_published:
                    lesson_item = CourseTreeItem(
                        id=lesson.id,
                        title=lesson.title,
                        type="lesson",
                        children=[]
                    )
                    section_item.children.append(lesson_item)
            # Only include sections with lessons
            if section_item.children:
                course_item.children.append(section_item)
        # Only include courses with sections
        if course_item.children:
            tree.append(course_item)

    return tree


# ============== Courses ==============

@router.get("/courses", response_model=CourseListResponse)
async def list_courses(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: str | None = None,
):
    """List courses. Students see only published courses."""
    query = select(Course).options(
        selectinload(Course.created_by),
        selectinload(Course.sections).selectinload(CourseSection.lessons)
    )

    # Students can only see published courses
    if current_user.role == UserRole.STUDENT:
        query = query.where(Course.is_published == True)  # noqa: E712
    # Teachers see their own courses + published courses
    elif current_user.role == UserRole.TEACHER:
        query = query.where(
            (Course.is_published == True) | (Course.created_by_id == current_user.id)  # noqa: E712
        )
    # Admin/manager see all courses

    if search:
        query = query.where(Course.title.ilike(f"%{search}%"))

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Get paginated results
    query = query.order_by(Course.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    courses = result.scalars().all()

    items = []
    for course in courses:
        sections_count = len(course.sections)
        lessons_count = sum(len(section.lessons) for section in course.sections)
        items.append(CourseResponse(
            id=course.id,
            title=course.title,
            description=course.description,
            cover_url=course.cover_url,
            is_published=course.is_published,
            created_by_id=course.created_by_id,
            created_by_name=course.created_by.name if course.created_by else "",
            created_at=course.created_at,
            updated_at=course.updated_at,
            sections_count=sections_count,
            lessons_count=lessons_count,
        ))

    return CourseListResponse(items=items, total=total or 0)


@router.post("/courses", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_data: CourseCreate,
    current_user: AdminUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new course. Only admin can create courses."""
    course = Course(
        title=course_data.title,
        description=course_data.description,
        cover_url=course_data.cover_url,
        is_published=course_data.is_published,
        created_by_id=current_user.id,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)

    return CourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        cover_url=course.cover_url,
        is_published=course.is_published,
        created_by_id=course.created_by_id,
        created_by_name=current_user.name,
        created_at=course.created_at,
        updated_at=course.updated_at,
        sections_count=0,
        lessons_count=0,
    )


@router.get("/courses/{course_id}", response_model=CourseDetailResponse)
async def get_course(
    course_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get course details with sections and lessons."""
    result = await db.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.created_by),
            selectinload(Course.sections)
            .selectinload(CourseSection.lessons)
            .selectinload(InteractiveLesson.blocks)
        )
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not can_view_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Build response with sections and lessons
    sections = []
    for section in course.sections:
        lessons = []
        for lesson in section.lessons:
            # Students can only see published lessons
            if current_user.role == UserRole.STUDENT and not lesson.is_published:
                continue
            lessons.append(InteractiveLessonResponse(
                id=lesson.id,
                section_id=lesson.section_id,
                title=lesson.title,
                description=lesson.description,
                position=lesson.position,
                is_published=lesson.is_published,
                created_by_id=lesson.created_by_id,
                created_at=lesson.created_at,
                updated_at=lesson.updated_at,
                blocks_count=len(lesson.blocks),
            ))
        sections.append(CourseSectionDetailResponse(
            id=section.id,
            course_id=section.course_id,
            title=section.title,
            description=section.description,
            position=section.position,
            created_at=section.created_at,
            updated_at=section.updated_at,
            lessons=lessons,
        ))

    return CourseDetailResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        cover_url=course.cover_url,
        is_published=course.is_published,
        created_by_id=course.created_by_id,
        created_by_name=course.created_by.name if course.created_by else "",
        created_at=course.created_at,
        updated_at=course.updated_at,
        sections=sections,
    )


@router.put("/courses/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a course."""
    result = await db.execute(
        select(Course)
        .where(Course.id == course_id)
        .options(selectinload(Course.created_by), selectinload(Course.sections))
    )
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not can_edit_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Update fields
    update_data = course_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(course, field, value)

    await db.commit()
    await db.refresh(course)

    return CourseResponse(
        id=course.id,
        title=course.title,
        description=course.description,
        cover_url=course.cover_url,
        is_published=course.is_published,
        created_by_id=course.created_by_id,
        created_by_name=course.created_by.name if course.created_by else "",
        created_at=course.created_at,
        updated_at=course.updated_at,
        sections_count=len(course.sections),
        lessons_count=0,
    )


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not can_edit_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(course)
    await db.commit()


# ============== Course Sections ==============

@router.post("/courses/{course_id}/sections", response_model=CourseSectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(
    course_id: int,
    section_data: CourseSectionCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new section in a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not can_edit_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get max position for new section
    max_pos_result = await db.execute(
        select(func.coalesce(func.max(CourseSection.position), -1))
        .where(CourseSection.course_id == course_id)
    )
    max_pos = max_pos_result.scalar() or -1

    section = CourseSection(
        course_id=course_id,
        title=section_data.title,
        description=section_data.description,
        position=section_data.position if section_data.position > 0 else max_pos + 1,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)

    return CourseSectionResponse(
        id=section.id,
        course_id=section.course_id,
        title=section.title,
        description=section.description,
        position=section.position,
        created_at=section.created_at,
        updated_at=section.updated_at,
        lessons_count=0,
    )


@router.put("/courses/sections/{section_id}", response_model=CourseSectionResponse)
async def update_section(
    section_id: int,
    section_data: CourseSectionUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a course section."""
    result = await db.execute(
        select(CourseSection)
        .where(CourseSection.id == section_id)
        .options(selectinload(CourseSection.course), selectinload(CourseSection.lessons))
    )
    section = result.scalar_one_or_none()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if not can_edit_course(current_user, section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = section_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(section, field, value)

    await db.commit()
    await db.refresh(section)

    return CourseSectionResponse(
        id=section.id,
        course_id=section.course_id,
        title=section.title,
        description=section.description,
        position=section.position,
        created_at=section.created_at,
        updated_at=section.updated_at,
        lessons_count=len(section.lessons),
    )


@router.delete("/courses/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(
    section_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a course section."""
    result = await db.execute(
        select(CourseSection)
        .where(CourseSection.id == section_id)
        .options(selectinload(CourseSection.course))
    )
    section = result.scalar_one_or_none()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if not can_edit_course(current_user, section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(section)
    await db.commit()


@router.post("/courses/{course_id}/sections/reorder", status_code=status.HTTP_200_OK)
async def reorder_sections(
    course_id: int,
    reorder_data: ReorderRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reorder sections within a course."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not can_edit_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    for item in reorder_data.items:
        await db.execute(
            select(CourseSection)
            .where(CourseSection.id == item.id, CourseSection.course_id == course_id)
        )
        result = await db.execute(
            select(CourseSection).where(CourseSection.id == item.id)
        )
        section = result.scalar_one_or_none()
        if section and section.course_id == course_id:
            section.position = item.position

    await db.commit()
    return {"status": "ok"}


# ============== Interactive Lessons ==============

@router.post("/courses/sections/{section_id}/lessons", response_model=InteractiveLessonResponse, status_code=status.HTTP_201_CREATED)
async def create_lesson(
    section_id: int,
    lesson_data: InteractiveLessonCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new interactive lesson in a section."""
    result = await db.execute(
        select(CourseSection)
        .where(CourseSection.id == section_id)
        .options(selectinload(CourseSection.course))
    )
    section = result.scalar_one_or_none()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if not can_edit_course(current_user, section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get max position
    max_pos_result = await db.execute(
        select(func.coalesce(func.max(InteractiveLesson.position), -1))
        .where(InteractiveLesson.section_id == section_id)
    )
    max_pos = max_pos_result.scalar() or -1

    lesson = InteractiveLesson(
        section_id=section_id,
        title=lesson_data.title,
        description=lesson_data.description,
        position=lesson_data.position if lesson_data.position > 0 else max_pos + 1,
        is_published=lesson_data.is_published,
        created_by_id=current_user.id,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)

    return InteractiveLessonResponse(
        id=lesson.id,
        section_id=lesson.section_id,
        title=lesson.title,
        description=lesson.description,
        position=lesson.position,
        is_published=lesson.is_published,
        created_by_id=lesson.created_by_id,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        blocks_count=0,
    )


@router.get("/courses/lessons/{lesson_id}", response_model=InteractiveLessonDetailResponse)
async def get_lesson(
    lesson_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get lesson details with blocks."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(InteractiveLesson.id == lesson_id)
        .options(
            selectinload(InteractiveLesson.section).selectinload(CourseSection.course),
            selectinload(InteractiveLesson.blocks)
        )
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    course = lesson.section.course
    if not can_view_course(current_user, course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Students can only see published lessons
    if current_user.role == UserRole.STUDENT and not lesson.is_published:
        raise HTTPException(status_code=403, detail="Lesson not published")

    blocks = [
        ExerciseBlockResponse(
            id=block.id,
            lesson_id=block.lesson_id,
            block_type=block.block_type,
            content=block.content,
            position=block.position,
            created_at=block.created_at,
            updated_at=block.updated_at,
        )
        for block in sorted(lesson.blocks, key=lambda b: b.position)
    ]

    return InteractiveLessonDetailResponse(
        id=lesson.id,
        section_id=lesson.section_id,
        title=lesson.title,
        description=lesson.description,
        position=lesson.position,
        is_published=lesson.is_published,
        created_by_id=lesson.created_by_id,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        blocks=blocks,
    )


@router.put("/courses/lessons/{lesson_id}", response_model=InteractiveLessonResponse)
async def update_lesson(
    lesson_id: int,
    lesson_data: InteractiveLessonUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an interactive lesson."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(InteractiveLesson.id == lesson_id)
        .options(
            selectinload(InteractiveLesson.section).selectinload(CourseSection.course),
            selectinload(InteractiveLesson.blocks)
        )
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not can_edit_course(current_user, lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = lesson_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)

    await db.commit()
    await db.refresh(lesson)

    return InteractiveLessonResponse(
        id=lesson.id,
        section_id=lesson.section_id,
        title=lesson.title,
        description=lesson.description,
        position=lesson.position,
        is_published=lesson.is_published,
        created_by_id=lesson.created_by_id,
        created_at=lesson.created_at,
        updated_at=lesson.updated_at,
        blocks_count=len(lesson.blocks),
    )


@router.delete("/courses/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lesson(
    lesson_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete an interactive lesson."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(InteractiveLesson.id == lesson_id)
        .options(selectinload(InteractiveLesson.section).selectinload(CourseSection.course))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not can_edit_course(current_user, lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(lesson)
    await db.commit()


@router.post("/courses/sections/{section_id}/lessons/reorder", status_code=status.HTTP_200_OK)
async def reorder_lessons(
    section_id: int,
    reorder_data: ReorderRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reorder lessons within a section."""
    result = await db.execute(
        select(CourseSection)
        .where(CourseSection.id == section_id)
        .options(selectinload(CourseSection.course))
    )
    section = result.scalar_one_or_none()

    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if not can_edit_course(current_user, section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    for item in reorder_data.items:
        result = await db.execute(
            select(InteractiveLesson).where(InteractiveLesson.id == item.id)
        )
        lesson = result.scalar_one_or_none()
        if lesson and lesson.section_id == section_id:
            lesson.position = item.position

    await db.commit()
    return {"status": "ok"}


# ============== Exercise Blocks ==============

@router.post("/courses/lessons/{lesson_id}/blocks", response_model=ExerciseBlockResponse, status_code=status.HTTP_201_CREATED)
async def create_block(
    lesson_id: int,
    block_data: ExerciseBlockCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new exercise block in a lesson."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(InteractiveLesson.id == lesson_id)
        .options(selectinload(InteractiveLesson.section).selectinload(CourseSection.course))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not can_edit_course(current_user, lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    # Get max position
    max_pos_result = await db.execute(
        select(func.coalesce(func.max(ExerciseBlock.position), -1))
        .where(ExerciseBlock.lesson_id == lesson_id)
    )
    max_pos = max_pos_result.scalar() or -1

    block = ExerciseBlock(
        lesson_id=lesson_id,
        block_type=block_data.block_type,
        content=block_data.content,
        position=block_data.position if block_data.position > 0 else max_pos + 1,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)

    return ExerciseBlockResponse(
        id=block.id,
        lesson_id=block.lesson_id,
        block_type=block.block_type,
        content=block.content,
        position=block.position,
        created_at=block.created_at,
        updated_at=block.updated_at,
    )


@router.put("/courses/blocks/{block_id}", response_model=ExerciseBlockResponse)
async def update_block(
    block_id: int,
    block_data: ExerciseBlockUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update an exercise block."""
    result = await db.execute(
        select(ExerciseBlock)
        .where(ExerciseBlock.id == block_id)
        .options(
            selectinload(ExerciseBlock.lesson)
            .selectinload(InteractiveLesson.section)
            .selectinload(CourseSection.course)
        )
    )
    block = result.scalar_one_or_none()

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if not can_edit_course(current_user, block.lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    update_data = block_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(block, field, value)

    await db.commit()
    await db.refresh(block)

    return ExerciseBlockResponse(
        id=block.id,
        lesson_id=block.lesson_id,
        block_type=block.block_type,
        content=block.content,
        position=block.position,
        created_at=block.created_at,
        updated_at=block.updated_at,
    )


@router.delete("/courses/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    block_id: int,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete an exercise block."""
    result = await db.execute(
        select(ExerciseBlock)
        .where(ExerciseBlock.id == block_id)
        .options(
            selectinload(ExerciseBlock.lesson)
            .selectinload(InteractiveLesson.section)
            .selectinload(CourseSection.course)
        )
    )
    block = result.scalar_one_or_none()

    if not block:
        raise HTTPException(status_code=404, detail="Block not found")

    if not can_edit_course(current_user, block.lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    await db.delete(block)
    await db.commit()


@router.post("/courses/lessons/{lesson_id}/blocks/reorder", status_code=status.HTTP_200_OK)
async def reorder_blocks(
    lesson_id: int,
    reorder_data: ReorderRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reorder blocks within a lesson."""
    result = await db.execute(
        select(InteractiveLesson)
        .where(InteractiveLesson.id == lesson_id)
        .options(selectinload(InteractiveLesson.section).selectinload(CourseSection.course))
    )
    lesson = result.scalar_one_or_none()

    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if not can_edit_course(current_user, lesson.section.course):
        raise HTTPException(status_code=403, detail="Access denied")

    for item in reorder_data.items:
        result = await db.execute(
            select(ExerciseBlock).where(ExerciseBlock.id == item.id)
        )
        block = result.scalar_one_or_none()
        if block and block.lesson_id == lesson_id:
            block.position = item.position

    await db.commit()
    return {"status": "ok"}
