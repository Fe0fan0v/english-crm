from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ReportRequest(BaseModel):
    date_from: date
    date_to: date


class StudentReportRow(BaseModel):
    student_name: str
    lesson_type: str
    lessons_count: int
    teacher_payment: Decimal


class TeacherReport(BaseModel):
    teacher_id: int
    teacher_name: str
    rows: list[StudentReportRow]
    total: Decimal


class TeacherReportResponse(BaseModel):
    teachers: list[TeacherReport]
    grand_total: Decimal
    date_from: date
    date_to: date
