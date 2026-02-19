from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, get_db
from app.models.material import Material, MaterialFolder
from app.schemas.material import (
    MaterialCreate,
    MaterialUpdate,
    MaterialResponse,
    MaterialListResponse,
    MaterialFolderCreate,
    MaterialFolderUpdate,
    MaterialFolderResponse,
)

router = APIRouter()


# --- Folder endpoints ---


@router.get("/folders", response_model=list[MaterialFolderResponse])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = ...,
):
    """Get all material folders ordered by position."""
    result = await db.execute(
        select(MaterialFolder).order_by(MaterialFolder.position, MaterialFolder.id)
    )
    return result.scalars().all()


@router.post("/folders", response_model=MaterialFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    data: MaterialFolderCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Create a new material folder (admin only)."""
    folder = MaterialFolder(**data.model_dump())
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder


@router.put("/folders/{folder_id}", response_model=MaterialFolderResponse)
async def update_folder(
    folder_id: int,
    data: MaterialFolderUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update a material folder (admin only)."""
    result = await db.execute(select(MaterialFolder).where(MaterialFolder.id == folder_id))
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(folder, field, value)

    await db.commit()
    await db.refresh(folder)
    return folder


@router.delete("/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Delete a material folder (admin only). Materials in folder become unassigned."""
    result = await db.execute(select(MaterialFolder).where(MaterialFolder.id == folder_id))
    folder = result.scalar_one_or_none()

    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    # Unassign materials from this folder
    materials_result = await db.execute(
        select(Material).where(Material.folder_id == folder_id)
    )
    for material in materials_result.scalars().all():
        material.folder_id = None

    await db.delete(folder)
    await db.commit()


# --- Material endpoints ---


@router.get("", response_model=MaterialListResponse)
async def list_materials(
    search: str | None = None,
    folder_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = ...,
):
    """Get all materials (all authenticated users can view). Optionally filter by folder_id."""
    query = select(Material)

    if search:
        query = query.where(Material.title.ilike(f"%{search}%"))

    if folder_id is not None:
        query = query.where(Material.folder_id == folder_id)

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
    _current_user: CurrentUser = ...,
):
    """Get a specific material (all authenticated users can view)."""
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
