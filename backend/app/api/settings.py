from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, get_db
from app.models.settings import Settings
from app.schemas.settings import (
    PublicSettingsResponse,
    SettingsCreate,
    SettingsResponse,
    SettingsUpdate,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/public", response_model=PublicSettingsResponse)
async def get_public_settings(
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = ...,
):
    """Get public settings accessible to all authenticated users"""
    # Fetch whatsapp_manager_phone
    result = await db.execute(
        select(Settings).where(Settings.key == "whatsapp_manager_phone")
    )
    whatsapp_setting = result.scalar_one_or_none()

    return PublicSettingsResponse(
        whatsapp_manager_phone=whatsapp_setting.value if whatsapp_setting else None
    )


@router.get("/", response_model=list[SettingsResponse])
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Get all settings (admin only)"""
    result = await db.execute(select(Settings))
    settings = result.scalars().all()
    return settings


@router.get("/{key}", response_model=SettingsResponse)
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Get a specific setting by key (admin only)"""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    return setting


@router.post("/", response_model=SettingsResponse)
async def create_setting(
    setting_data: SettingsCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Create a new setting (admin only)"""
    # Check if key already exists
    result = await db.execute(
        select(Settings).where(Settings.key == setting_data.key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Setting with this key already exists")

    setting = Settings(**setting_data.model_dump())
    db.add(setting)
    await db.commit()
    await db.refresh(setting)
    return setting


@router.patch("/{key}", response_model=SettingsResponse)
async def update_setting(
    key: str,
    setting_data: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Update a setting (admin only)"""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    if setting_data.value is not None:
        setting.value = setting_data.value

    await db.commit()
    await db.refresh(setting)
    return setting


@router.delete("/{key}")
async def delete_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Delete a setting (admin only)"""
    result = await db.execute(select(Settings).where(Settings.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")

    await db.delete(setting)
    await db.commit()
    return {"message": "Setting deleted"}
