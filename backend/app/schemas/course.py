from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

from app.models.course import ExerciseBlockType


# ============== Exercise Block Content Types ==============

class TextBlockContent(BaseModel):
    """Content for text block."""
    html: str = ""


class VideoBlockContent(BaseModel):
    """Content for video block (YouTube/Vimeo)."""
    url: str = ""
    provider: str | None = None  # "youtube", "vimeo", or None for auto-detect
    title: str | None = None


class AudioBlockContent(BaseModel):
    """Content for audio block."""
    url: str = ""
    title: str | None = None


class ArticleBlockContent(BaseModel):
    """Content for article block (text + image)."""
    html: str = ""
    image_url: str | None = None
    image_position: str = "right"  # "left", "right", "top", "bottom"


class DividerBlockContent(BaseModel):
    """Content for divider block."""
    style: str = "line"  # "line", "space", "dots"


class GapItem(BaseModel):
    """Single gap in fill_gaps exercise."""
    index: int
    answer: str
    hint: str | None = None
    alternatives: list[str] = []


class FillGapsBlockContent(BaseModel):
    """Content for fill gaps exercise. Use {0}, {1}, etc. as placeholders."""
    text: str = ""  # "The {0} is {1}"
    gaps: list[GapItem] = []


class TestOption(BaseModel):
    """Single option in test/quiz."""
    id: str
    text: str
    is_correct: bool = False


class TestBlockContent(BaseModel):
    """Content for test/quiz block."""
    question: str = ""
    options: list[TestOption] = []
    multiple_answers: bool = False
    explanation: str | None = None


class TrueFalseBlockContent(BaseModel):
    """Content for true/false exercise."""
    statement: str = ""
    is_true: bool = True
    explanation: str | None = None


class WordOrderBlockContent(BaseModel):
    """Content for word order exercise (sentence building)."""
    correct_sentence: str = ""
    shuffled_words: list[str] = []
    hint: str | None = None


class MatchingPair(BaseModel):
    """Single pair for matching exercise."""
    left: str
    right: str


class MatchingBlockContent(BaseModel):
    """Content for matching exercise."""
    pairs: list[MatchingPair] = []
    shuffle_right: bool = True


class EssayBlockContent(BaseModel):
    """Content for essay/free text exercise."""
    prompt: str = ""
    min_words: int | None = None
    max_words: int | None = None
    sample_answer: str | None = None


class ImageBlockContent(BaseModel):
    """Content for image block."""
    url: str = ""
    caption: str | None = None
    alt: str | None = None


class TeachingGuideBlockContent(BaseModel):
    """Content for teaching guide (only visible to teacher)."""
    html: str = ""


class RememberBlockContent(BaseModel):
    """Content for remember/highlight block."""
    html: str = ""
    icon: str | None = None  # "info", "warning", "tip", etc.


class TableCell(BaseModel):
    """Single cell in a table."""
    text: str = ""
    colspan: int = 1
    rowspan: int = 1
    style: str | None = None  # "header", "highlight", etc.


class TableRow(BaseModel):
    """Single row in a table."""
    cells: list[TableCell] = []


class TableBlockContent(BaseModel):
    """Content for table block."""
    rows: list[TableRow] = []
    has_header: bool = True


class ImageOption(BaseModel):
    """Single image option in image choice exercise."""
    id: str
    url: str
    caption: str | None = None
    is_correct: bool = False


class ImageChoiceBlockContent(BaseModel):
    """Content for image choice exercise."""
    question: str = ""
    options: list[ImageOption] = []
    explanation: str | None = None


class Flashcard(BaseModel):
    """Single flashcard."""
    front: str = ""
    back: str = ""
    image_url: str | None = None


class FlashcardsBlockContent(BaseModel):
    """Content for flashcards exercise."""
    title: str | None = None
    cards: list[Flashcard] = []
    shuffle: bool = True


# ============== Exercise Block Schemas ==============

class ExerciseBlockBase(BaseModel):
    """Base schema for exercise block."""
    block_type: ExerciseBlockType
    content: dict[str, Any] = Field(default_factory=dict)
    position: int = 0

    @field_validator("content", mode="before")
    @classmethod
    def validate_content(cls, v, info):
        """Validate content based on block type."""
        if v is None:
            return {}
        return v


class ExerciseBlockCreate(ExerciseBlockBase):
    """Schema for creating an exercise block."""
    pass


class ExerciseBlockUpdate(BaseModel):
    """Schema for updating an exercise block."""
    block_type: ExerciseBlockType | None = None
    content: dict[str, Any] | None = None
    position: int | None = None


class ExerciseBlockResponse(ExerciseBlockBase):
    """Schema for exercise block response."""
    id: int
    lesson_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============== Interactive Lesson Schemas ==============

class InteractiveLessonBase(BaseModel):
    """Base schema for interactive lesson."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    position: int = 0
    is_published: bool = False
    is_homework: bool = False


class InteractiveLessonCreate(InteractiveLessonBase):
    """Schema for creating an interactive lesson."""
    pass


class InteractiveLessonUpdate(BaseModel):
    """Schema for updating an interactive lesson."""
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    position: int | None = None
    is_published: bool | None = None
    is_homework: bool | None = None


class InteractiveLessonResponse(InteractiveLessonBase):
    """Schema for interactive lesson response (without blocks)."""
    id: int
    section_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    blocks_count: int = 0

    class Config:
        from_attributes = True


class InteractiveLessonDetailResponse(InteractiveLessonBase):
    """Schema for interactive lesson response with blocks."""
    id: int
    section_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    blocks: list[ExerciseBlockResponse] = []

    class Config:
        from_attributes = True


# ============== Course Section Schemas ==============

class CourseSectionBase(BaseModel):
    """Base schema for course section."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    position: int = 0


class CourseSectionCreate(CourseSectionBase):
    """Schema for creating a course section."""
    pass


class CourseSectionUpdate(BaseModel):
    """Schema for updating a course section."""
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    position: int | None = None


class CourseSectionResponse(CourseSectionBase):
    """Schema for course section response (without lessons)."""
    id: int
    course_id: int
    created_at: datetime
    updated_at: datetime
    lessons_count: int = 0

    class Config:
        from_attributes = True


class CourseSectionDetailResponse(CourseSectionBase):
    """Schema for course section response with lessons."""
    id: int
    course_id: int
    created_at: datetime
    updated_at: datetime
    lessons: list[InteractiveLessonResponse] = []

    class Config:
        from_attributes = True


# ============== Course Schemas ==============

class CourseBase(BaseModel):
    """Base schema for course."""
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = None
    is_published: bool = False


class CourseCreate(CourseBase):
    """Schema for creating a course."""
    pass


class CourseUpdate(BaseModel):
    """Schema for updating a course."""
    title: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    cover_url: str | None = None
    is_published: bool | None = None


class CourseResponse(CourseBase):
    """Schema for course response (list view)."""
    id: int
    created_by_id: int
    created_by_name: str = ""
    created_at: datetime
    updated_at: datetime
    sections_count: int = 0
    lessons_count: int = 0

    class Config:
        from_attributes = True


class CourseDetailResponse(CourseBase):
    """Schema for course response with sections and lessons."""
    id: int
    created_by_id: int
    created_by_name: str = ""
    created_at: datetime
    updated_at: datetime
    sections: list[CourseSectionDetailResponse] = []

    class Config:
        from_attributes = True


# ============== Reorder Schemas ==============

class ReorderItem(BaseModel):
    """Item for reorder operation."""
    id: int
    position: int


class ReorderRequest(BaseModel):
    """Request for reordering items."""
    items: list[ReorderItem]


# ============== List Response ==============

class CourseListResponse(BaseModel):
    """Response for course list."""
    items: list[CourseResponse]
    total: int
