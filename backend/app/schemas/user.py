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
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=20)
    role: UserRole | None = None
    level_id: int | None = None
    photo_url: str | None = None
    password: str | None = Field(None, min_length=6)
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
