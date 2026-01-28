from datetime import date, datetime
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


class TransactionReportRow(BaseModel):
    """Single transaction row in the report."""
    transaction_id: int
    student_id: int
    student_name: str
    amount: Decimal
    description: str | None
    created_at: datetime
    created_by_id: int | None
    created_by_name: str | None

    class Config:
        from_attributes = True


class TransactionReportResponse(BaseModel):
    """Response for transaction report with pagination."""
    items: list[TransactionReportRow]
    total: int
    page: int
    size: int
    pages: int
    total_amount: Decimal
