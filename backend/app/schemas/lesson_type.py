from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class LessonTypeBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)


class LessonTypeCreate(LessonTypeBase):
    pass


class LessonTypeUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    price: Decimal | None = Field(None, ge=0)


class LessonTypeResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LessonTypeListResponse(BaseModel):
    items: list[LessonTypeResponse]
    total: int
