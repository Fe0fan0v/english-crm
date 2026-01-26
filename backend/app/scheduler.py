"""Background scheduler for periodic tasks."""

import logging
from datetime import datetime

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select, update

from app.database import get_db_session
from app.models.lesson import Lesson

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


async def clear_past_lesson_links():
    """
    Clear meeting URLs from past lessons.
    Runs daily at 00:00 to remove Zoom/Meet links from completed lessons.
    """
    logger.info("Starting task: clear_past_lesson_links")
    try:
        async for db in get_db_session():
            now = datetime.utcnow()

            # Find all lessons where scheduled_at + duration_minutes < now
            # and meeting_url is not null
            result = await db.execute(
                select(Lesson).where(
                    Lesson.meeting_url.isnot(None),
                    Lesson.scheduled_at < now,
                )
            )
            lessons = result.scalars().all()

            # Filter lessons that have actually ended (scheduled_at + duration)
            ended_lesson_ids = []
            for lesson in lessons:
                lesson_end = lesson.scheduled_at
                if lesson.duration_minutes:
                    from datetime import timedelta

                    lesson_end = lesson.scheduled_at + timedelta(
                        minutes=lesson.duration_minutes
                    )
                if lesson_end < now:
                    ended_lesson_ids.append(lesson.id)

            if ended_lesson_ids:
                # Clear meeting_url for ended lessons
                await db.execute(
                    update(Lesson)
                    .where(Lesson.id.in_(ended_lesson_ids))
                    .values(meeting_url=None)
                )
                await db.commit()
                logger.info(
                    f"Cleared meeting URLs from {len(ended_lesson_ids)} past lessons"
                )
            else:
                logger.info("No past lessons with meeting URLs found")

            break  # Exit after first db session
    except Exception as e:
        logger.error(f"Error in clear_past_lesson_links: {e}", exc_info=True)


def start_scheduler():
    """Start the background scheduler."""
    # Schedule task to run daily at 00:00
    scheduler.add_job(
        clear_past_lesson_links,
        "cron",
        hour=0,
        minute=0,
        id="clear_past_lesson_links",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started successfully")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shutdown successfully")
