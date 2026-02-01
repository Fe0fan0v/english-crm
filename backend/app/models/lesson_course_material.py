from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.course import Course, CourseSection, InteractiveLesson
    from app.models.lesson import Lesson
    from app.models.user import User


class CourseMaterialType(str, PyEnum):
    """Type of course material attached to a lesson."""
    COURSE = "course"      # Whole course (e.g., "Beginner")
    SECTION = "section"    # Section (e.g., "A-1")
    LESSON = "lesson"      # Interactive lesson (e.g., "Warm Up")


class LessonCourseMaterial(Base):
    """
    Links a scheduled lesson (Lesson) to course materials.
    Allows attaching whole courses, sections, or individual interactive lessons.
    """
    __tablename__ = "lesson_course_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    material_type: Mapped[CourseMaterialType] = mapped_column(
        Enum(CourseMaterialType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )

    # Only one of these is populated depending on material_type
    course_id: Mapped[int | None] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), nullable=True
    )
    section_id: Mapped[int | None] = mapped_column(
        ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=True
    )
    interactive_lesson_id: Mapped[int | None] = mapped_column(
        ForeignKey("interactive_lessons.id", ondelete="CASCADE"), nullable=True
    )

    attached_by: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )
    attached_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="course_materials")
    course: Mapped["Course | None"] = relationship("Course", foreign_keys=[course_id])
    section: Mapped["CourseSection | None"] = relationship("CourseSection", foreign_keys=[section_id])
    interactive_lesson: Mapped["InteractiveLesson | None"] = relationship(
        "InteractiveLesson", foreign_keys=[interactive_lesson_id]
    )
    attacher: Mapped["User"] = relationship("User", foreign_keys=[attached_by])
