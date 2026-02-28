from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DBSession
from app.models.course import Course, InteractiveLesson
from app.models.homework import HomeworkTemplate, HomeworkTemplateItem
from app.schemas.homework_template import (
    HomeworkTemplateCreate,
    HomeworkTemplateResponse,
    HomeworkTemplateUpdate,
)

router = APIRouter()


@router.get("", response_model=list[HomeworkTemplateResponse])
async def list_homework_templates(
    db: DBSession,
    current_user: AdminUser,
) -> list[HomeworkTemplateResponse]:
    """List all homework templates."""
    result = await db.execute(
        select(HomeworkTemplate)
        .options(
            selectinload(HomeworkTemplate.course),
            selectinload(HomeworkTemplate.creator),
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
        .order_by(HomeworkTemplate.created_at.desc())
    )
    templates = result.scalars().all()

    return [
        HomeworkTemplateResponse(
            id=t.id,
            title=t.title,
            course_id=t.course_id,
            course_title=t.course.title if t.course else "",
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
        )
        for t in templates
    ]


@router.post("", response_model=HomeworkTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_homework_template(
    data: HomeworkTemplateCreate,
    db: DBSession,
    current_user: AdminUser,
) -> HomeworkTemplateResponse:
    """Create a homework template."""
    # Verify course exists
    course = await db.get(Course, data.course_id)
    if not course:
        raise HTTPException(404, "Course not found")

    template = HomeworkTemplate(
        title=data.title,
        course_id=data.course_id,
        created_by=current_user.id,
    )
    db.add(template)
    await db.flush()

    # Add items
    for il_id in data.interactive_lesson_ids:
        il = await db.get(InteractiveLesson, il_id)
        if not il:
            raise HTTPException(404, f"Interactive lesson {il_id} not found")
        item = HomeworkTemplateItem(
            template_id=template.id,
            interactive_lesson_id=il_id,
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
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
    )
    template = result.scalar_one()

    return HomeworkTemplateResponse(
        id=template.id,
        title=template.title,
        course_id=template.course_id,
        course_title=template.course.title if template.course else "",
        created_by=template.created_by,
        creator_name=template.creator.name if template.creator else "",
        created_at=template.created_at,
        items=[
            {
                "id": item.id,
                "interactive_lesson_id": item.interactive_lesson_id,
                "interactive_lesson_title": item.interactive_lesson.title
                if item.interactive_lesson
                else "",
            }
            for item in template.items
        ],
    )


@router.put("/{template_id}", response_model=HomeworkTemplateResponse)
async def update_homework_template(
    template_id: int,
    data: HomeworkTemplateUpdate,
    db: DBSession,
    current_user: AdminUser,
) -> HomeworkTemplateResponse:
    """Update a homework template."""
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template_id)
        .options(
            selectinload(HomeworkTemplate.items),
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(404, "Template not found")

    if data.title is not None:
        template.title = data.title

    if data.interactive_lesson_ids is not None:
        # Remove old items
        for item in template.items:
            await db.delete(item)
        await db.flush()

        # Add new items
        for il_id in data.interactive_lesson_ids:
            il = await db.get(InteractiveLesson, il_id)
            if not il:
                raise HTTPException(404, f"Interactive lesson {il_id} not found")
            item = HomeworkTemplateItem(
                template_id=template.id,
                interactive_lesson_id=il_id,
            )
            db.add(item)

    await db.commit()

    # Reload
    result = await db.execute(
        select(HomeworkTemplate)
        .where(HomeworkTemplate.id == template.id)
        .options(
            selectinload(HomeworkTemplate.course),
            selectinload(HomeworkTemplate.creator),
            selectinload(HomeworkTemplate.items).selectinload(
                HomeworkTemplateItem.interactive_lesson
            ),
        )
    )
    template = result.scalar_one()

    return HomeworkTemplateResponse(
        id=template.id,
        title=template.title,
        course_id=template.course_id,
        course_title=template.course.title if template.course else "",
        created_by=template.created_by,
        creator_name=template.creator.name if template.creator else "",
        created_at=template.created_at,
        items=[
            {
                "id": item.id,
                "interactive_lesson_id": item.interactive_lesson_id,
                "interactive_lesson_title": item.interactive_lesson.title
                if item.interactive_lesson
                else "",
            }
            for item in template.items
        ],
    )


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_homework_template(
    template_id: int,
    db: DBSession,
    current_user: AdminUser,
) -> None:
    """Delete a homework template."""
    template = await db.get(HomeworkTemplate, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    await db.delete(template)
    await db.commit()
