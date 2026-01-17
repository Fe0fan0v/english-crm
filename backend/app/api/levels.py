from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, get_db
from app.models.lesson_type import LessonType
from app.models.level import Level
from app.models.level_lesson_type_payment import LevelLessonTypePayment
from app.schemas.level import (
    LevelCreate,
    LevelUpdate,
    LevelResponse,
    LevelListResponse,
)
from app.schemas.level_lesson_type_payment import (
    LevelPaymentMatrix,
    LevelPaymentMatrixItem,
    BulkPaymentUpdate,
)

router = APIRouter()


@router.get("", response_model=LevelListResponse)
async def list_levels(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get all levels."""
    query = select(Level)

    if search:
        query = query.where(Level.name.ilike(f"%{search}%"))

    query = query.order_by(Level.name)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    # Get items
    result = await db.execute(query)
    items = result.scalars().all()

    return LevelListResponse(items=items, total=total or 0)


@router.get("/{level_id}", response_model=LevelResponse)
async def get_level(
    level_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get a specific level."""
    result = await db.execute(select(Level).where(Level.id == level_id))
    level = result.scalar_one_or_none()

    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level not found",
        )

    return level


@router.post("", response_model=LevelResponse, status_code=status.HTTP_201_CREATED)
async def create_level(
    data: LevelCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Create a new level."""
    # Check if name already exists
    existing = await db.execute(select(Level).where(Level.name == data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Level with this name already exists",
        )

    level = Level(**data.model_dump())
    db.add(level)
    await db.commit()
    await db.refresh(level)

    return level


@router.put("/{level_id}", response_model=LevelResponse)
async def update_level(
    level_id: int,
    data: LevelUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update a level."""
    result = await db.execute(select(Level).where(Level.id == level_id))
    level = result.scalar_one_or_none()

    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level not found",
        )

    # Check if new name already exists
    if data.name and data.name != level.name:
        existing = await db.execute(select(Level).where(Level.name == data.name))
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Level with this name already exists",
            )

    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(level, field, value)

    await db.commit()
    await db.refresh(level)

    return level


@router.delete("/{level_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_level(
    level_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Delete a level."""
    result = await db.execute(select(Level).where(Level.id == level_id))
    level = result.scalar_one_or_none()

    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level not found",
        )

    await db.delete(level)
    await db.commit()


@router.get("/{level_id}/payments", response_model=LevelPaymentMatrix)
async def get_level_payments(
    level_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get payment matrix for a level (all lesson types with their teacher payments)."""
    # Get level
    result = await db.execute(select(Level).where(Level.id == level_id))
    level = result.scalar_one_or_none()

    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level not found",
        )

    # Get all lesson types
    lesson_types_result = await db.execute(select(LessonType).order_by(LessonType.name))
    lesson_types = lesson_types_result.scalars().all()

    # Get existing payments for this level
    payments_result = await db.execute(
        select(LevelLessonTypePayment).where(LevelLessonTypePayment.level_id == level_id)
    )
    payments = {p.lesson_type_id: p for p in payments_result.scalars().all()}

    # Build matrix
    items = []
    for lt in lesson_types:
        payment = payments.get(lt.id)
        items.append(
            LevelPaymentMatrixItem(
                lesson_type_id=lt.id,
                lesson_type_name=lt.name,
                lesson_type_price=lt.price,
                teacher_payment=payment.teacher_payment if payment else None,
            )
        )

    return LevelPaymentMatrix(
        level_id=level.id,
        level_name=level.name,
        items=items,
    )


@router.put("/{level_id}/payments", response_model=LevelPaymentMatrix)
async def update_level_payments(
    level_id: int,
    data: BulkPaymentUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update payment matrix for a level (bulk upsert)."""
    # Get level
    result = await db.execute(select(Level).where(Level.id == level_id))
    level = result.scalar_one_or_none()

    if not level:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level not found",
        )

    # Validate lesson_type_ids
    lesson_type_ids = [p.lesson_type_id for p in data.payments]
    lesson_types_result = await db.execute(
        select(LessonType).where(LessonType.id.in_(lesson_type_ids))
    )
    valid_lesson_types = {lt.id: lt for lt in lesson_types_result.scalars().all()}

    if len(valid_lesson_types) != len(lesson_type_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Some lesson type IDs are invalid",
        )

    # Get existing payments for this level
    existing_result = await db.execute(
        select(LevelLessonTypePayment).where(LevelLessonTypePayment.level_id == level_id)
    )
    existing_payments = {p.lesson_type_id: p for p in existing_result.scalars().all()}

    # Upsert payments
    for payment_data in data.payments:
        if payment_data.lesson_type_id in existing_payments:
            # Update existing
            existing_payments[payment_data.lesson_type_id].teacher_payment = payment_data.teacher_payment
        else:
            # Create new
            new_payment = LevelLessonTypePayment(
                level_id=level_id,
                lesson_type_id=payment_data.lesson_type_id,
                teacher_payment=payment_data.teacher_payment,
            )
            db.add(new_payment)

    await db.commit()

    # Return updated matrix
    return await get_level_payments(level_id, db, _)
