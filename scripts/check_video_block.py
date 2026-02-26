"""
Проверка video блока "Speaking cards"
"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock, InteractiveLesson

async def check_video():
    """Проверка video блока"""

    async with async_session_maker() as db:
        # Найдём видео блок с "Speaking cards"
        result = await db.execute(
            select(ExerciseBlock, InteractiveLesson.title)
            .join(InteractiveLesson, ExerciseBlock.lesson_id == InteractiveLesson.id)
            .where(ExerciseBlock.title.ilike("%Speaking cards%"))
            .limit(1)
        )
        row = result.first()

        if not row:
            print("[WARN] Блок не найден, ищем любой video блок...")
            # Найдём любой video блок
            result = await db.execute(
                select(ExerciseBlock, InteractiveLesson.title)
                .join(InteractiveLesson, ExerciseBlock.lesson_id == InteractiveLesson.id)
                .where(ExerciseBlock.block_type == 'video')
                .limit(3)
            )
            rows = result.all()

            if not rows:
                print("[ERROR] Video блоки не найдены")
                return

            for block, lesson_title in rows:
                print(f"\n{'='*80}")
                print(f"Video блок:")
                print(f"{'='*80}")
                print(f"ID: {block.id}")
                print(f"Lesson: {lesson_title}")
                print(f"Title: {block.title}")
                print(f"Type: {block.block_type}")
                print(f"\nContent keys: {list(block.content.keys())}")
                print(f"Content: {json.dumps(block.content, indent=2, ensure_ascii=False)[:500]}")

        else:
            block, lesson_title = row

            print(f"\n{'='*80}")
            print(f"Video блок 'Speaking cards':")
            print(f"{'='*80}")
            print(f"ID: {block.id}")
            print(f"Lesson: {lesson_title}")
            print(f"Title: {block.title}")
            print(f"Type: {block.block_type}")
            print(f"\nContent keys: {list(block.content.keys())}")
            print(f"\nContent:")
            print(json.dumps(block.content, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(check_video())
