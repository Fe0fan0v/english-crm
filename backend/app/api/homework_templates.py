from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DBSession, TeacherUser
from app.models.course import Course, ExerciseBlock, InteractiveLesson
from app.models.homework import HomeworkAssignment, HomeworkTemplate, HomeworkTemplateItem
from app.models.lesson import Lesson
from app.models.lesson_type import LessonType
from app.schemas.homework_template import (
    HomeworkAssignedLesson,
    HomeworkTemplateCreate,
    HomeworkTemplateResponse,
    HomeworkTemplateUpdate,
)

router = APIRouter()

INTERACTIVE_TYPES = {
    "fill_gaps", "test", "true_false", "word_order", "matching",
    "essay", "image_choice", "drag_words", "sentence_choice",
}


def _template_to_response(
    t: HomeworkTemplate,
    blocks_count: int = 0,
    assigned_lessons: list[HomeworkAssignedLesson] | None = None,
) -> HomeworkTemplateResponse:
    return HomeworkTemplateResponse(
        id=t.id,
        title=t.title,
        course_id=t.course_id,
        course_title=t.course.title if t.course else "",
        interactive_lesson_id=t.interactive_lesson_id,
        blocks_count=blocks_count,
        created_by=t.created_by,
        creator_name=t.creator.name if t.creator else "",
        created_at=t.created_at,
        items=[
            {
                "id": item.id,
                "interactive_lesson_id": item.interactive_lesson_id,
                "interactive_lesson_title": item.interactive_lesson.title
                if item.interactive_lesson
                else "",
            }
            for item in t.items
        ],
        assigned_lessons=assigned_lessons or [],
    )


@router.get("", response_model=list[HomeworkTemplateResponse])
async def list_homework_templates(
    db: DBSession,
    current_user: TeacherUser,
) -> list[HomeworkTemplateResponse]:
    """List all homework templates."""
    result = await db.execute(
        select(HomeworkTemplate)
        .options(
            selectinload(HomeworkTemplate.course),
            selectinload(HomeworkTemplate.creator),
            selectinload(HomeworkTemplate.interactive_lesson),
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
        .order_by(HomeworkTemplate.created_at.desc())
    )
    templates = list(result.scalars().all())

    # Auto-create interactive lessons for old templates missing one
    needs_refresh = False
    for t in templates:
        if not t.interactive_lesson_id:
            il = InteractiveLesson(
                title=t.title,
                is_standalone=True,
                is_homework=True,
                created_by_id=t.created_by,
            )
            db.add(il)
            await db.flush()
            t.interactive_lesson_id = il.id
            needs_refresh = True
    if needs_refresh:
        await db.commit()
        # Re-query to get fresh objects with relationships
        result = await db.execute(
            select(HomeworkTemplate)
            .options(
                selectinload(HomeworkTemplate.course),
                selectinload(HomeworkTemplate.creator),
                selectinload(HomeworkTemplate.interactive_lesson),
                selectinload(HomeworkTemplate.items).selectinload(
                    HomeworkTemplateItem.interactive_lesson
                ),
            )
            .order_by(HomeworkTemplate.created_at.desc())
        )
        templates = list(result.scalars().all())

    # Get blocks count for each template's interactive lesson
    il_ids = [t.interactive_lesson_id for t in templates if t.interactive_lesson_id]
    blocks_counts: dict[int, int] = {}
    if il_ids:
        counts_result = await db.execute(
            select(ExerciseBlock.lesson_id, func.count(ExerciseBlock.id))
            .where(ExerciseBlock.lesson_id.in_(il_ids))
            .group_by(ExerciseBlock.lesson_id)
        )
        blocks_counts = dict(counts_result.all())

    # Get assigned lessons for each template
    assigned_map: dict[int, list[HomeworkAssignedLesson]] = {}
    if il_ids:
        assignments_result = await db.execute(
            select(
                HomeworkAssignment.interactive_lesson_id,
                HomeworkAssignment.lesson_id,
                Lesson.scheduled_at,
                LessonType.name.label("lesson_type_name"),
                func.count(HomeworkAssignment.student_id).label("student_count"),
            )
            .join(Lesson, Lesson.id == HomeworkAssignment.lesson_id)
            .join(LessonType, LessonType.id == Lesson.lesson_type_id)
            .where(HomeworkAssignment.interactive_lesson_id.in_(il_ids))
            .group_by(
                HomeworkAssignment.interactive_lesson_id,
                HomeworkAssignment.lesson_id,
                Lesson.scheduled_at,
                LessonType.name,
            )
            .order_by(Lesson.scheduled_at.desc())
        )
        for row in assignments_result.all():
            il_id = row[0]
            if il_id not in assigned_map:
                assigned_map[il_id] = []
            assigned_map[il_id].append(HomeworkAssignedLesson(
                lesson_id=row[1],
                scheduled_at=row[2],
                lesson_type_name=row[3],
                student_count=row[4],
            ))

    return [
        _template_to_response(
            t,
            blocks_counts.get(t.interactive_lesson_id, 0) if t.interactive_lesson_id else 0,
            assigned_map.get(t.interactive_lesson_id, []) if t.interactive_lesson_id else [],
        )
        for t in templates
    ]


@router.post("", response_model=HomeworkTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_homework_template(
    data: HomeworkTemplateCreate,
    db: DBSession,
    current_user: TeacherUser,
) -> HomeworkTemplateResponse:
    """Create a homework template with its own interactive lesson."""
    # Verify course exists
    course = await db.get(Course, data.course_id)
    if not course:
        raise HTTPException(404, "Course not found")

    # Create an interactive lesson for this template
    il = InteractiveLesson(
        title=data.title,
        is_standalone=True,
        is_homework=True,
        created_by_id=current_user.id,
    )
    db.add(il)
    await db.flush()

    template = HomeworkTemplate(
        title=data.title,
        course_id=data.course_id,
        interactive_lesson_id=il.id,
        created_by=current_user.id,
    )
    db.add(template)

    # Also add as legacy item for backward compat with auto-assignment
    item = HomeworkTemplateItem(
        template_id=template.id,
        interactive_lesson_id=il.id,
    )
    db.add(item)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template.id)
        .options(
            selectinload(HomeworkTemplate.course),
            selectinload(HomeworkTemplate.creator),
            selectinload(HomeworkTemplate.interactive_lesson),
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
    )
    template = result.scalar_one()

    return _template_to_response(template)


@router.put("/{template_id}", response_model=HomeworkTemplateResponse)
async def update_homework_template(
    template_id: int,
    data: HomeworkTemplateUpdate,
    db: DBSession,
    current_user: TeacherUser,
) -> HomeworkTemplateResponse:
    """Update a homework template."""
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template_id)
        .options(
            selectinload(HomeworkTemplate.items),
            selectinload(HomeworkTemplate.interactive_lesson),
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    if data.title is not None:
        template.title = data.title
        # Also rename the interactive lesson
        if template.interactive_lesson:
            template.interactive_lesson.title = data.title

    await db.commit()

    # Reload
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template.id)
        .options(
            selectinload(HomeworkTemplate.course),
            selectinload(HomeworkTemplate.creator),
            selectinload(HomeworkTemplate.interactive_lesson),
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
    )
    template = result.scalar_one()

    blocks_count = 0
    if template.interactive_lesson_id:
        count_result = await db.execute(
            select(func.count(ExerciseBlock.id))
            .where(ExerciseBlock.lesson_id == template.interactive_lesson_id)
        )
        blocks_count = count_result.scalar() or 0

    return _template_to_response(template, blocks_count)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_homework_template(
    template_id: int,
    db: DBSession,
    current_user: TeacherUser,
) -> None:
    """Delete a homework template and its interactive lesson."""
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template_id)
        .options(selectinload(HomeworkTemplate.interactive_lesson))
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    # Delete the interactive lesson (cascades to blocks)
    if template.interactive_lesson:
        await db.delete(template.interactive_lesson)

    await db.delete(template)
    await db.commit()
