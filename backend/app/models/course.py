from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class ExerciseBlockType(str, PyEnum):
    """Types of exercise blocks in interactive lessons."""

    # Content blocks
    TEXT = "text"
    VIDEO = "video"
    AUDIO = "audio"
    IMAGE = "image"
    ARTICLE = "article"
    DIVIDER = "divider"
    TEACHING_GUIDE = "teaching_guide"  # Only visible to teacher
    REMEMBER = "remember"  # Highlighted important info
    TABLE = "table"  # Grammar tables
    VOCABULARY = "vocabulary"  # Word list with translations and pronunciation
    PAGE_BREAK = "page_break"  # Splits lesson into pages
    # Interactive blocks
    FILL_GAPS = "fill_gaps"
    TEST = "test"
    TRUE_FALSE = "true_false"
    WORD_ORDER = "word_order"
    MATCHING = "matching"
    IMAGE_CHOICE = "image_choice"  # Choose correct image
    FLASHCARDS = "flashcards"  # Interactive flashcards
    ESSAY = "essay"
    DRAG_WORDS = "drag_words"  # Drag words into gaps
    SENTENCE_CHOICE = "sentence_choice"  # Dropdown-based sentence selection


class Course(Base):
    """Course - top level of the content hierarchy."""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    sections: Mapped[list["CourseSection"]] = relationship(
        "CourseSection",
        back_populates="course",
        cascade="all, delete-orphan",
        order_by="CourseSection.position",
    )


class CourseSection(Base):
    """Section within a course - second level of hierarchy (Level)."""

    __tablename__ = "course_sections"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    course: Mapped["Course"] = relationship("Course", back_populates="sections")
    topics: Mapped[list["CourseTopic"]] = relationship(
        "CourseTopic",
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="CourseTopic.position",
    )
    # Deprecated: old relationship for backward compatibility during migration
    lessons: Mapped[list["InteractiveLesson"]] = relationship(
        "InteractiveLesson",
        back_populates="section",
        foreign_keys="[InteractiveLesson.section_id]",
        order_by="InteractiveLesson.position",
    )


class CourseTopic(Base):
    """Topic within a section - third level of hierarchy."""

    __tablename__ = "course_topics"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    section: Mapped["CourseSection"] = relationship(
        "CourseSection", back_populates="topics"
    )
    lessons: Mapped[list["InteractiveLesson"]] = relationship(
        "InteractiveLesson",
        back_populates="topic",
        cascade="all, delete-orphan",
        order_by="InteractiveLesson.position",
    )


class InteractiveLesson(Base):
    """Interactive lesson within a topic - fourth level of hierarchy."""

    __tablename__ = "interactive_lessons"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # New structure: belongs to topic
    topic_id: Mapped[int | None] = mapped_column(
        ForeignKey("course_topics.id", ondelete="CASCADE"), nullable=True
    )
    # Old structure: belongs to section (for backward compatibility during migration)
    section_id: Mapped[int | None] = mapped_column(
        ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=True
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    is_homework: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # Mark as homework
    is_standalone: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )  # Standalone lesson (not part of any course)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    topic: Mapped["CourseTopic | None"] = relationship(
        "CourseTopic", back_populates="lessons"
    )
    section: Mapped["CourseSection | None"] = relationship(
        "CourseSection", back_populates="lessons", foreign_keys=[section_id]
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    blocks: Mapped[list["ExerciseBlock"]] = relationship(
        "ExerciseBlock",
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="ExerciseBlock.position",
    )


class ExerciseBlock(Base):
    """Exercise block within a lesson - fourth level of hierarchy."""

    __tablename__ = "exercise_blocks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("interactive_lessons.id", ondelete="CASCADE"), nullable=False
    )
    block_type: Mapped[ExerciseBlockType] = mapped_column(
        Enum(ExerciseBlockType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )  # Optional block title
    content: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    lesson: Mapped["InteractiveLesson"] = relationship(
        "InteractiveLesson", back_populates="blocks"
    )
