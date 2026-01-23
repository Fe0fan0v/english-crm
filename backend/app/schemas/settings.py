from datetime import datetime
from pydantic import BaseModel


class SettingsBase(BaseModel):
    key: str
    value: str | None = None


class SettingsCreate(SettingsBase):
    pass


class SettingsUpdate(BaseModel):
    value: str | None = None


class SettingsResponse(SettingsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PublicSettingsResponse(BaseModel):
    """Public settings that any user can access"""
    whatsapp_manager_phone: str | None = None
