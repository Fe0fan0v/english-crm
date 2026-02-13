from datetime import datetime

from pydantic import BaseModel, Field


class VocabularyWordCreate(BaseModel):
    english: str = Field(..., min_length=1, max_length=255)
    translation: str = Field(..., min_length=1, max_length=255)
    transcription: str | None = Field(None, max_length=255)
    example: str | None = None


class VocabularyWordUpdate(BaseModel):
    english: str | None = Field(None, min_length=1, max_length=255)
    translation: str | None = Field(None, min_length=1, max_length=255)
    transcription: str | None = Field(None, max_length=255)
    example: str | None = None


class VocabularyWordResponse(BaseModel):
    id: int
    student_id: int
    english: str
    translation: str
    transcription: str | None
    example: str | None
    added_by_id: int | None
    added_by_name: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class VocabularyWordListResponse(BaseModel):
    items: list[VocabularyWordResponse]
    total: int


class VocabularyWordBulkCreate(BaseModel):
    words: list[VocabularyWordCreate] = Field(..., min_length=1)
