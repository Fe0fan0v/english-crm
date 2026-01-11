from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Test(Base):
    __tablename__ = "tests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    accesses: Mapped[list["TestAccess"]] = relationship(
        "TestAccess", back_populates="test"
    )


class TestAccess(Base):
    __tablename__ = "test_access"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    test_id: Mapped[int] = mapped_column(ForeignKey("tests.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    granted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    test: Mapped["Test"] = relationship("Test", back_populates="accesses")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    granter: Mapped["User"] = relationship("User", foreign_keys=[granted_by])
