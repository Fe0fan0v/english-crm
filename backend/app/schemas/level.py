from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class LevelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    teacher_percentage: Decimal = Field(..., ge=0, le=100)


class LevelCreate(LevelBase):
    pass


class LevelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    teacher_percentage: Decimal | None = Field(None, ge=0, le=100)


class LevelResponse(BaseModel):
    id: int
    name: str
    teacher_percentage: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LevelListResponse(BaseModel):
    items: list[LevelResponse]
    total: int
