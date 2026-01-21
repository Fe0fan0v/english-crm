from app.api import (
    auth,
    dashboard,
    direct_messages,
    group_messages,
    groups,
    lesson_types,
    lessons,
    levels,
    materials,
    notifications,
    reports,
    student_dashboard,
    teacher_dashboard,
    tests,
    uploads,
    users,
)
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(group_messages.router, prefix="/groups", tags=["group-messages"])
api_router.include_router(lesson_types.router, prefix="/lesson-types", tags=["lesson-types"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(levels.router, prefix="/levels", tags=["levels"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(teacher_dashboard.router, prefix="/teacher", tags=["teacher-dashboard"])
api_router.include_router(student_dashboard.router, prefix="/student", tags=["student-dashboard"])
api_router.include_router(direct_messages.router, prefix="/messages", tags=["direct-messages"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
