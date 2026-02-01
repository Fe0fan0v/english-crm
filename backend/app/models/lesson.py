from datetime import datetime
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.group import Group
    from app.models.lesson_course_material import LessonCourseMaterial
    from app.models.lesson_material import LessonMaterial
    from app.models.lesson_type import LessonType
    from app.models.user import User


class LessonStatus(str, PyEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AttendanceStatus(str, PyEnum):
    PENDING = "pending"
    PRESENT = "present"
    ABSENT_EXCUSED = "absent_excused"
    ABSENT_UNEXCUSED = "absent_unexcused"


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("groups.id", ondelete="SET NULL"), nullable=True
    )
    lesson_type_id: Mapped[int] = mapped_column(
        ForeignKey("lesson_types.id"), nullable=False
    )
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    meeting_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[LessonStatus] = mapped_column(
        Enum(LessonStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=LessonStatus.SCHEDULED,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])
    group: Mapped["Group | None"] = relationship("Group", foreign_keys=[group_id])
    lesson_type: Mapped["LessonType"] = relationship(
        "LessonType", back_populates="lessons"
    )
    students: Mapped[list["LessonStudent"]] = relationship(
        "LessonStudent", back_populates="lesson", cascade="all, delete-orphan"
    )
    lesson_materials: Mapped[list["LessonMaterial"]] = relationship(
        "LessonMaterial", back_populates="lesson", cascade="all, delete-orphan"
    )
    course_materials: Mapped[list["LessonCourseMaterial"]] = relationship(
        "LessonCourseMaterial", back_populates="lesson", cascade="all, delete-orphan"
    )


class LessonStudent(Base):
    __tablename__ = "lesson_students"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    attendance_status: Mapped[AttendanceStatus] = mapped_column(
        Enum(AttendanceStatus, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=AttendanceStatus.PENDING,
    )
    charged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="students")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
