"""Teacher-Student direct assignment model."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TeacherStudent(Base):
    """
    Direct assignment of a student to a teacher.
    Used for individual students who don't belong to groups.
    This allows teachers to chat with and create lessons for assigned students.
    """

    __tablename__ = "teacher_students"
    __table_args__ = (
        UniqueConstraint("teacher_id", "student_id", name="uq_teacher_student"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    teacher_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    teacher = relationship(
        "User", foreign_keys=[teacher_id], backref="assigned_students"
    )
    student = relationship(
        "User", foreign_keys=[student_id], backref="assigned_teachers"
    )
