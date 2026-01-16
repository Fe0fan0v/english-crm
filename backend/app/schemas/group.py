from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    teacher_id: int | None = None


class GroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=500)
    teacher_id: int | None = None
    is_active: bool | None = None


class GroupStudentResponse(BaseModel):
    id: int
    student_id: int
    student_name: str
    student_email: str
    balance: Decimal
    joined_at: datetime

    class Config:
        from_attributes = True


class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    teacher_id: int | None
    teacher_name: str | None
    students_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupDetailResponse(BaseModel):
    id: int
    name: str
    description: str | None
    teacher_id: int | None
    teacher_name: str | None
    students: list[GroupStudentResponse]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GroupListResponse(BaseModel):
    items: list[GroupResponse]
    total: int
    page: int
    size: int
    pages: int


class GroupStudentAdd(BaseModel):
    student_ids: list[int] = Field(..., min_length=1)


class GroupStudentRemove(BaseModel):
    student_ids: list[int] = Field(..., min_length=1)
