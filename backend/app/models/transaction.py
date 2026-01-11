from datetime import datetime
from decimal import Decimal
from enum import Enum as PyEnum
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.lesson import Lesson
    from app.models.user import User


class TransactionType(str, PyEnum):
    DEBIT = "debit"
    CREDIT = "credit"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False)
    lesson_id: Mapped[int | None] = mapped_column(
        ForeignKey("lessons.id"), nullable=True
    )
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="transactions")
    lesson: Mapped["Lesson | None"] = relationship("Lesson")
