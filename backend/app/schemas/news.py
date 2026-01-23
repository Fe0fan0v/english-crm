from datetime import datetime
from pydantic import BaseModel


class NewsBase(BaseModel):
    title: str
    content: str
    banner_url: str | None = None
    is_published: bool = True


class NewsCreate(NewsBase):
    pass


class NewsUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    banner_url: str | None = None
    is_published: bool | None = None


class NewsResponse(NewsBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class NewsListResponse(BaseModel):
    items: list[NewsResponse]
    total: int
