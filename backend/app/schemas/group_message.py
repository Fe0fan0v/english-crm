from datetime import datetime

from pydantic import BaseModel, Field


class GroupMessageCreate(BaseModel):
    content: str = Field(default="", max_length=5000)
    file_url: str | None = None


class GroupMessageResponse(BaseModel):
    id: int
    group_id: int
    sender_id: int
    sender_name: str
    content: str
    file_url: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMessagesListResponse(BaseModel):
    items: list[GroupMessageResponse]
    total: int
    has_more: bool
