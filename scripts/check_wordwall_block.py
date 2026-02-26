"""
Проверка Wordwall блока 31497
"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock, InteractiveLesson

async def check_block():
    """Проверка блока"""

    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock, InteractiveLesson.title)
            .join(InteractiveLesson, ExerciseBlock.lesson_id == InteractiveLesson.id)
            .where(ExerciseBlock.id == 31497)
        )
        row = result.first()

        if not row:
            print("[ERROR] Блок не найден")
            return

        block, lesson_title = row

        print(f"\n{'='*80}")
        print(f"Wordwall блок 31497:")
        print(f"{'='*80}")
        print(f"Lesson: {lesson_title}")
        print(f"Title: {block.title}")
        print(f"Type: {block.block_type}")
        print(f"\nContent:")
        print(json.dumps(block.content, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(check_block())
