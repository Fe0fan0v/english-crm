from datetime import datetime

from pydantic import BaseModel, Field


# --- Material Folder schemas ---

class MaterialFolderCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    position: int = 0


class MaterialFolderUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    position: int | None = None


class MaterialFolderResponse(BaseModel):
    id: int
    title: str
    position: int
    created_at: datetime

    class Config:
        from_attributes = True


# --- Material schemas ---

class MaterialBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    file_url: str = Field(..., min_length=1, max_length=500)


class MaterialCreate(MaterialBase):
    folder_id: int | None = None


class MaterialUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    file_url: str | None = Field(None, min_length=1, max_length=500)
    folder_id: int | None = None


class MaterialResponse(BaseModel):
    id: int
    title: str
    file_url: str
    folder_id: int | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialListResponse(BaseModel):
    items: list[MaterialResponse]
    total: int
