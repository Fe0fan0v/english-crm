from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.lesson_type import LessonType
    from app.models.level import Level


class LevelLessonTypePayment(Base):
    """
    Payment matrix for teachers.

    Stores the payment amount a teacher receives for conducting
    a lesson of a specific type with a student of a specific level.

    Example:
    - Level "1-6 months" + Lesson Type "Group" = 340 tg
    - Level "6-12 months" + Lesson Type "Group" = 395 tg
    - Level "12+ months" + Lesson Type "Group" = 458 tg
    """
    __tablename__ = "level_lesson_type_payments"

    __table_args__ = (
        UniqueConstraint('level_id', 'lesson_type_id', name='uq_level_lesson_type'),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    level_id: Mapped[int] = mapped_column(ForeignKey("levels.id", ondelete="CASCADE"), nullable=False)
    lesson_type_id: Mapped[int] = mapped_column(ForeignKey("lesson_types.id", ondelete="CASCADE"), nullable=False)
    teacher_payment: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    level: Mapped["Level"] = relationship("Level", back_populates="lesson_type_payments")
    lesson_type: Mapped["LessonType"] = relationship("LessonType", back_populates="level_payments")
