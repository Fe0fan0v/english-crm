from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class LevelLessonTypePaymentBase(BaseModel):
    lesson_type_id: int
    teacher_payment: Decimal = Field(..., ge=0)


class LevelLessonTypePaymentCreate(LevelLessonTypePaymentBase):
    pass


class LevelLessonTypePaymentUpdate(BaseModel):
    teacher_payment: Decimal = Field(..., ge=0)


class LevelLessonTypePaymentResponse(BaseModel):
    id: int
    level_id: int
    lesson_type_id: int
    lesson_type_name: str
    teacher_payment: Decimal
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LevelPaymentMatrixItem(BaseModel):
    """Item in payment matrix for a level."""
    lesson_type_id: int
    lesson_type_name: str
    lesson_type_price: Decimal
    teacher_payment: Decimal | None = None  # None if not configured


class LevelPaymentMatrix(BaseModel):
    """Full payment matrix for a level."""
    level_id: int
    level_name: str
    items: list[LevelPaymentMatrixItem]


class BulkPaymentUpdate(BaseModel):
    """Bulk update payments for a level."""
    payments: list[LevelLessonTypePaymentBase]
