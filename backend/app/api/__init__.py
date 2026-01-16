from app.api import auth, users, lesson_types, reports, levels, materials, tests, dashboard, lessons, groups
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
api_router.include_router(lesson_types.router, prefix="/lesson-types", tags=["lesson-types"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(levels.router, prefix="/levels", tags=["levels"])
api_router.include_router(materials.router, prefix="/materials", tags=["materials"])
api_router.include_router(tests.router, prefix="/tests", tags=["tests"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(lessons.router, prefix="/lessons", tags=["lessons"])
