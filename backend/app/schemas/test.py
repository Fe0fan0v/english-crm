from datetime import datetime

from pydantic import BaseModel, Field


class TestBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)


class TestCreate(TestBase):
    pass


class TestUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=255)


class TestResponse(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestListResponse(BaseModel):
    items: list[TestResponse]
    total: int
