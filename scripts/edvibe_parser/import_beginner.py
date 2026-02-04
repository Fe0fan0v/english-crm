"""
Импорт уровня Beginner в существующий курс English File 4th
"""
import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.course import Course, CourseSection, CourseTopic, InteractiveLesson, ExerciseBlock


async def import_beginner():
    """Import Beginner level into existing course"""

    print(f"\n{'='*60}")
    print(f"Importing Beginner from /app/beginner.json")
    print(f"{'='*60}\n")

    # Load data
    with open('/app/beginner.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    if not data.get('sections'):
        print(f"ERROR: No sections found in beginner.json")
        return

    section_data = data['sections'][0]  # Get first section
    lessons = section_data.get('lessons', [])

    print(f"Found {len(lessons)} lessons to import")

    async with async_session_maker() as db:
        # Check if course exists
        result = await db.execute(
            select(Course).where(Course.id == 10)
        )
        course = result.scalar_one_or_none()

        if not course:
            print(f"ERROR: Course with ID 10 not found")
            return

        print(f"Course found: {course.title}")

        # Get max position
        result = await db.execute(
            select(CourseSection)
            .where(CourseSection.course_id == 10)
        )
        existing_sections = result.scalars().all()
        max_position = max([s.position for s in existing_sections], default=0)

        # Create new section
        section = CourseSection(
            course_id=10,
            title='Beginner',
            description='Beginner level lessons',
            position=max_position + 1
        )
        db.add(section)
        await db.flush()

        print(f"Created section: {section.title} (ID: {section.id}, Position: {section.position})")

        # Create a default topic for all lessons
        topic = CourseTopic(
            section_id=section.id,
            title="All Lessons",
            description="All lessons for Beginner",
            position=1
        )
        db.add(topic)
        await db.flush()

        print(f"Created topic: {topic.title} (ID: {topic.id})")

        # Import lessons
        lessons_created = 0
        blocks_created = 0

        for idx, lesson_data in enumerate(lessons, 1):
            lesson_title = lesson_data.get('title', f'Lesson {idx}')
            blocks = lesson_data.get('blocks', [])

            # Create interactive lesson
            lesson = InteractiveLesson(
                topic_id=topic.id,
                title=lesson_title,
                description="",
                position=idx,
                is_published=True,
                is_homework=False,
                created_by_id=1  # Admin user
            )
            db.add(lesson)
            await db.flush()

            lessons_created += 1

            # Import blocks
            for block_idx, block_data in enumerate(blocks, 1):
                block_type = block_data.get('block_type', 'text')
                content = block_data.get('content', {})
                block_title = block_data.get('title', '')

                # Truncate title to 255 characters (DB limit)
                if len(block_title) > 255:
                    block_title = block_title[:252] + '...'

                block = ExerciseBlock(
                    lesson_id=lesson.id,
                    block_type=block_type,
                    title=block_title,
                    content=content,
                    position=block_idx
                )
                db.add(block)
                blocks_created += 1

            if idx % 10 == 0:
                print(f"  Processed {idx}/{len(lessons)} lessons...")

        await db.commit()

        print(f"\n{'='*60}")
        print(f"Import completed successfully!")
        print(f"  Section: {section.title}")
        print(f"  Topic: {topic.title}")
        print(f"  Lessons created: {lessons_created}")
        print(f"  Blocks created: {blocks_created}")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    asyncio.run(import_beginner())
