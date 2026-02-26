"""
Проверка fill_gaps блока в БД
"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock, InteractiveLesson

async def check_fillgaps():
    """Проверка fill_gaps блока"""

    async with async_session_maker() as db:
        # Найдём блок с title "Complete with I'm not or You aren't"
        result = await db.execute(
            select(ExerciseBlock, InteractiveLesson.title)
            .join(InteractiveLesson, ExerciseBlock.lesson_id == InteractiveLesson.id)
            .where(ExerciseBlock.title.ilike("%Complete with I'm not or You aren't%"))
            .limit(1)
        )
        row = result.first()

        if not row:
            print("[ERROR] Блок не найден")
            return

        block, lesson_title = row

        print(f"\n{'='*80}")
        print(f"Fill gaps блок:")
        print(f"{'='*80}")
        print(f"ID: {block.id}")
        print(f"Lesson: {lesson_title}")
        print(f"Title: {block.title}")
        print(f"Type: {block.block_type}")
        print(f"\nContent keys: {list(block.content.keys())}")
        print(f"\n--- Content ---")
        print(json.dumps(block.content, indent=2, ensure_ascii=False)[:2000])
        print("\n...")

if __name__ == "__main__":
    asyncio.run(check_fillgaps())
