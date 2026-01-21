from datetime import datetime
from pydantic import BaseModel, Field


class DirectMessageCreate(BaseModel):
    recipient_id: int
    content: str = Field(default="", max_length=5000)
    file_url: str | None = None


class DirectMessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    recipient_id: int
    recipient_name: str
    content: str
    file_url: str | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummary(BaseModel):
    """Summary of a conversation with another user."""
    user_id: int
    user_name: str
    user_photo_url: str | None
    last_message: str
    last_message_at: datetime
    unread_count: int


class ConversationListResponse(BaseModel):
    items: list[ConversationSummary]
