from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.course import Course, InteractiveLesson
    from app.models.lesson import Lesson
    from app.models.user import User


class HomeworkStatus(str, PyEnum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    ACCEPTED = "accepted"


class HomeworkAssignment(Base):
    """Links a scheduled lesson's interactive lesson as homework for a student."""

    __tablename__ = "homework_assignments"
    __table_args__ = (
        UniqueConstraint(
            "lesson_id",
            "interactive_lesson_id",
            "student_id",
            name="uq_homework_lesson_interactive_student",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interactive_lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("interactive_lessons.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[HomeworkStatus] = mapped_column(
        Enum(HomeworkStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=HomeworkStatus.PENDING,
        server_default="pending",
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", foreign_keys=[lesson_id])
    interactive_lesson: Mapped["InteractiveLesson"] = relationship(
        "InteractiveLesson", foreign_keys=[interactive_lesson_id]
    )
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigned_by])


class HomeworkTemplate(Base):
    """Template for homework assignments — a named collection of interactive lessons."""

    __tablename__ = "homework_templates"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    course_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    course: Mapped["Course"] = relationship("Course", foreign_keys=[course_id])
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    items: Mapped[list["HomeworkTemplateItem"]] = relationship(
        "HomeworkTemplateItem", back_populates="template", cascade="all, delete-orphan"
    )


class HomeworkTemplateItem(Base):
    """An item within a homework template — references an interactive lesson."""

    __tablename__ = "homework_template_items"
    __table_args__ = (
        UniqueConstraint(
            "template_id",
            "interactive_lesson_id",
            name="uq_template_interactive_lesson",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    template_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("homework_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    interactive_lesson_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("interactive_lessons.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    template: Mapped["HomeworkTemplate"] = relationship(
        "HomeworkTemplate", back_populates="items"
    )
    interactive_lesson: Mapped["InteractiveLesson"] = relationship(
        "InteractiveLesson", foreign_keys=[interactive_lesson_id]
    )
