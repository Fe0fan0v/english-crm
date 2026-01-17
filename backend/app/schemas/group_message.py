from datetime import datetime

from pydantic import BaseModel, Field


class GroupMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)


class GroupMessageResponse(BaseModel):
    id: int
    group_id: int
    sender_id: int
    sender_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class GroupMessagesListResponse(BaseModel):
    items: list[GroupMessageResponse]
    total: int
    has_more: bool
