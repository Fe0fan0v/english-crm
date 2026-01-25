from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.lesson import Lesson
    from app.models.material import Material
    from app.models.user import User


class LessonMaterial(Base):
    __tablename__ = "lesson_materials"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    lesson_id: Mapped[int] = mapped_column(
        ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False, index=True
    )
    material_id: Mapped[int] = mapped_column(
        ForeignKey("materials.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attached_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    attached_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="lesson_materials")
    material: Mapped["Material"] = relationship("Material")
    attacher: Mapped["User"] = relationship("User")
