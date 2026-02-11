from datetime import datetime
from enum import Enum

from pydantic import BaseModel, model_validator


class CourseMaterialType(str, Enum):
    """Type of course material attached to a lesson."""
    COURSE = "course"
    SECTION = "section"
    TOPIC = "topic"
    LESSON = "lesson"


class LessonCourseMaterialAttach(BaseModel):
    """Schema for attaching a course material to a lesson."""
    material_type: CourseMaterialType
    course_id: int | None = None
    section_id: int | None = None
    topic_id: int | None = None
    interactive_lesson_id: int | None = None

    @model_validator(mode='after')
    def validate_material_id(self):
        """Ensure the correct ID is provided based on material_type."""
        if self.material_type == CourseMaterialType.COURSE:
            if not self.course_id:
                raise ValueError("course_id is required when material_type is 'course'")
        elif self.material_type == CourseMaterialType.SECTION:
            if not self.section_id:
                raise ValueError("section_id is required when material_type is 'section'")
        elif self.material_type == CourseMaterialType.TOPIC:
            if not self.topic_id:
                raise ValueError("topic_id is required when material_type is 'topic'")
        elif self.material_type == CourseMaterialType.LESSON:
            if not self.interactive_lesson_id:
                raise ValueError("interactive_lesson_id is required when material_type is 'lesson'")
        return self


class LessonCourseMaterialResponse(BaseModel):
    """Response schema for a course material attached to a lesson."""
    id: int
    material_type: CourseMaterialType
    course_id: int | None = None
    course_title: str | None = None
    section_id: int | None = None
    section_title: str | None = None
    topic_id: int | None = None
    topic_title: str | None = None
    interactive_lesson_id: int | None = None
    interactive_lesson_title: str | None = None
    attached_at: datetime
    attached_by: int
    attacher_name: str

    class Config:
        from_attributes = True


class CourseTreeItem(BaseModel):
    """Item in the course tree for material selection."""
    id: int
    title: str
    type: str  # "course", "section", "topic", "lesson"
    children: list["CourseTreeItem"] = []

    class Config:
        from_attributes = True


class StudentLessonItem(BaseModel):
    """Interactive lesson item for student course material view."""
    id: int
    title: str
    description: str | None = None
    is_homework: bool = False


class StudentTopicItem(BaseModel):
    """Topic item for student course material view."""
    id: int
    title: str
    description: str | None = None
    lessons: list[StudentLessonItem] = []


class StudentSectionItem(BaseModel):
    """Section item for student course material view."""
    id: int
    title: str
    description: str | None = None
    topics: list[StudentTopicItem] = []


class StudentCourseMaterialView(BaseModel):
    """Response for student viewing a course material (filtered tree)."""
    material_type: CourseMaterialType
    course_title: str | None = None
    section_title: str | None = None
    topic_title: str | None = None
    sections: list[StudentSectionItem] = []
    interactive_lesson_id: int | None = None


# Enable forward reference
CourseTreeItem.model_rebuild()
