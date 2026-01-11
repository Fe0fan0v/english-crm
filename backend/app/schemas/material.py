from datetime import datetime

from pydantic import BaseModel, Field


class MaterialBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    file_url: str = Field(..., min_length=1, max_length=500)


class MaterialCreate(MaterialBase):
    pass


class MaterialUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)
    file_url: str | None = Field(None, min_length=1, max_length=500)


class MaterialResponse(BaseModel):
    id: int
    title: str
    file_url: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MaterialListResponse(BaseModel):
    items: list[MaterialResponse]
    total: int
