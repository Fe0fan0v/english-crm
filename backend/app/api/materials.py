from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, get_db
from app.models.material import Material
from app.schemas.material import (
    MaterialCreate,
    MaterialUpdate,
    MaterialResponse,
    MaterialListResponse,
)

router = APIRouter()


@router.get("", response_model=MaterialListResponse)
async def list_materials(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get all materials."""
    query = select(Material)

    if search:
        query = query.where(Material.title.ilike(f"%{search}%"))

    query = query.order_by(Material.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    result = await db.execute(query)
    items = result.scalars().all()

    return MaterialListResponse(items=items, total=total or 0)


@router.get("/{material_id}", response_model=MaterialResponse)
async def get_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get a specific material."""
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    return material


@router.post("", response_model=MaterialResponse, status_code=status.HTTP_201_CREATED)
async def create_material(
    data: MaterialCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Create a new material."""
    material = Material(**data.model_dump())
    db.add(material)
    await db.commit()
    await db.refresh(material)

    return material


@router.put("/{material_id}", response_model=MaterialResponse)
async def update_material(
    material_id: int,
    data: MaterialUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update a material."""
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(material, field, value)

    await db.commit()
    await db.refresh(material)

    return material


@router.delete("/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Delete a material."""
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()

    if not material:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Material not found",
        )

    await db.delete(material)
    await db.commit()
