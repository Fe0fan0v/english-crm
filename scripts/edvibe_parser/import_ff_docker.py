#!/usr/bin/env python3
"""
Import Family and Friends course into JSI LMS database.
Runs inside Docker container on the server.

Usage:
    1. Copy files to server:
       scp scripts/edvibe_parser/output/jsi_merged_FF_all_levels.json jsi:~/ff_data.json
       scp scripts/edvibe_parser/import_ff_docker.py jsi:~/import_ff.py

    2. Copy into container and run:
       ssh jsi "cd ~/english-crm && sudo docker compose cp ~/ff_data.json backend:/app/ff_data.json"
       ssh jsi "cd ~/english-crm && sudo docker compose cp ~/import_ff.py backend:/app/import_ff.py"
       ssh jsi "cd ~/english-crm && sudo docker compose exec backend python /app/import_ff.py"
"""

import asyncio
import json
import sys
import os

sys.path.insert(0, "/app")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.course import Course, CourseSection, InteractiveLesson, ExerciseBlock
from app.config import settings

DATABASE_URL = settings.database_url

JSON_FILE = os.environ.get("FF_JSON", "/app/ff_data.json")
CREATED_BY_ID = 1  # admin


async def import_course():
    if not os.path.exists(JSON_FILE):
        print(f"[ERROR] File not found: {JSON_FILE}")
        sys.exit(1)

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("=" * 60)
    print("Import: Family and Friends")
    print("=" * 60)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Check if course already exists
        check = await session.execute(
            text("SELECT id, title FROM courses WHERE title = :title"),
            {"title": "Family and Friends"}
        )
        existing = check.fetchone()
        if existing:
            print(f"[WARN] Course already exists: ID={existing[0]}, title={existing[1]}")
            print("[WARN] Skipping import. Use update script to update existing course.")
            await engine.dispose()
            return

        # Create new course
        course = Course(
            title=data.get("title", "Family and Friends"),
            description=data.get("description", "Family and Friends for Kids (1-6)"),
            is_published=True,
            created_by_id=CREATED_BY_ID
        )
        session.add(course)
        await session.flush()
        print(f"\nCreated course: {course.title} (ID={course.id})")

        total_lessons = 0
        total_blocks = 0

        for section_pos, section_data in enumerate(data.get("sections", []), start=1):
            section = CourseSection(
                course_id=course.id,
                title=section_data.get("title", f"Level {section_pos}"),
                description="",
                position=section_pos
            )
            session.add(section)
            await session.flush()

            lessons = section_data.get("lessons", [])
            section_blocks = 0

            for lesson_pos, lesson_data in enumerate(lessons, start=1):
                lesson = InteractiveLesson(
                    section_id=section.id,
                    title=lesson_data.get("title", f"Lesson {lesson_pos}"),
                    description="",
                    position=lesson_pos,
                    is_published=True,
                    is_homework=False,
                    created_by_id=CREATED_BY_ID
                )
                session.add(lesson)
                await session.flush()
                total_lessons += 1

                blocks = lesson_data.get("blocks", [])
                for block_data in blocks:
                    block_title = block_data.get("title", "") or ""
                    if len(block_title) > 255:
                        block_title = block_title[:252] + "..."

                    block = ExerciseBlock(
                        lesson_id=lesson.id,
                        block_type=block_data.get("block_type", "text"),
                        content=block_data.get("content", {}),
                        position=block_data.get("position", 1),
                        title=block_title
                    )
                    session.add(block)
                    total_blocks += 1
                    section_blocks += 1

                await session.flush()

            print(f"  {section.title}: {len(lessons)} lessons, {section_blocks} blocks")

        await session.commit()

        print("\n" + "=" * 60)
        print("[OK] Import complete!")
        print("=" * 60)
        print(f"  Course: {course.title} (ID={course.id})")
        print(f"  Sections: {len(data.get('sections', []))}")
        print(f"  Lessons: {total_lessons}")
        print(f"  Blocks: {total_blocks}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(import_course())
