from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.course import ExerciseBlock
    from app.models.user import User


class ExerciseResult(Base):
    """Stores a student's answer to an exercise block."""
    __tablename__ = "exercise_results"
    __table_args__ = (
        UniqueConstraint("student_id", "block_id", name="uq_exercise_result_student_block"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    block_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exercise_blocks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("interactive_lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    answer: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    block: Mapped["ExerciseBlock"] = relationship("ExerciseBlock", foreign_keys=[block_id])
