from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, get_db
from app.models.level import Level
from app.schemas.level import (
    LevelCreate,
    LevelUpdate,
    LevelResponse,
    LevelListResponse,
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
