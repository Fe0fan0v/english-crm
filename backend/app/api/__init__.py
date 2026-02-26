from app.api import (
    auth,
    courses,
    dashboard,
    direct_messages,
    exercise_results,
    group_messages,
    homework,
    groups,
    lesson_types,
    lessons,
    levels,
    live_sessions,
    materials,
    news,
    notifications,
    reports,
    settings,
    student_dashboard,
    teacher_dashboard,
    tests,
    uploads,
    users,
    vocabulary,
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
api_router.include_router(courses.router, tags=["courses"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
api_router.include_router(teacher_dashboard.router, prefix="/teacher", tags=["teacher-dashboard"])
api_router.include_router(student_dashboard.router, prefix="/student", tags=["student-dashboard"])
api_router.include_router(direct_messages.router, prefix="/messages", tags=["direct-messages"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(vocabulary.router, prefix="/vocabulary", tags=["vocabulary"])
api_router.include_router(exercise_results.router, prefix="/exercise-results", tags=["exercise-results"])
api_router.include_router(live_sessions.router, prefix="/live-sessions", tags=["live-sessions"])
api_router.include_router(homework.router, tags=["homework"])
api_router.include_router(news.router)
