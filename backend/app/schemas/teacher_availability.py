from datetime import time
from enum import Enum

from pydantic import BaseModel, field_validator


class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class TeacherAvailabilityCreate(BaseModel):
    day_of_week: DayOfWeek
    start_time: str  # HH:MM format
    end_time: str  # HH:MM format

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_time_format(cls, v: str) -> str:
        try:
            time.fromisoformat(v)
        except ValueError:
            raise ValueError("Time must be in HH:MM format")
        return v


class TeacherAvailabilityResponse(BaseModel):
    id: int
    teacher_id: int
    day_of_week: str
    start_time: str
    end_time: str

    class Config:
        from_attributes = True

    @field_validator("start_time", "end_time", mode="before")
    @classmethod
    def convert_time_to_string(cls, v):
        if isinstance(v, time):
            return v.strftime("%H:%M")
        return v


class TeacherAvailabilityListResponse(BaseModel):
    items: list[TeacherAvailabilityResponse]
