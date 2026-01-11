from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Material(Base):
    __tablename__ = "materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    accesses: Mapped[list["MaterialAccess"]] = relationship(
        "MaterialAccess", back_populates="material"
    )


class MaterialAccess(Base):
    __tablename__ = "material_access"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    granted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    material: Mapped["Material"] = relationship("Material", back_populates="accesses")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id])
    granter: Mapped["User"] = relationship("User", foreign_keys=[granted_by])
