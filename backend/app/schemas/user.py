from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.models.user import UserRole


class UserBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    phone: str | None = Field(None, max_length=20)
    role: UserRole = UserRole.STUDENT
    level_id: int | None = None
    photo_url: str | None = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=4)
    teacher_id: int | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    role: UserRole | None = None
    level_id: int | None = None
    photo_url: str | None = None
    password: str | None = Field(None, min_length=4)
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: str | None
    role: UserRole
    level_id: int | None
    photo_url: str | None
    balance: Decimal
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    size: int
    pages: int


class BalanceChange(BaseModel):
    amount: Decimal = Field(..., description="Amount to add (positive) or subtract (negative)")
    description: str | None = Field(None, max_length=500)


class TransactionResponse(BaseModel):
    id: int
    amount: Decimal
    type: str
    description: str | None
    lesson_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionListResponse(BaseModel):
    items: list[TransactionResponse]
    total: int
    page: int
    size: int
    pages: int


class UserGroupResponse(BaseModel):
    id: int
    name: str
    description: str | None
    teacher_name: str | None
    joined_at: datetime

    class Config:
        from_attributes = True
