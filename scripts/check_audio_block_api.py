"""
Проверка данных аудио блока через API
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock, InteractiveLesson

async def check_audio_block():
    """Проверка аудио блока"""

    async with async_session_maker() as db:
        # Найдём первый аудио блок
        result = await db.execute(
            select(ExerciseBlock, InteractiveLesson.title)
            .join(InteractiveLesson, ExerciseBlock.lesson_id == InteractiveLesson.id)
            .where(ExerciseBlock.block_type == 'audio')
            .limit(1)
        )
        row = result.first()

        if not row:
            print("[ERROR] Аудио блок не найден")
            return

        block, lesson_title = row

        print(f"\n{'='*60}")
        print(f"Аудио блок из БД:")
        print(f"{'='*60}")
        print(f"ID: {block.id}")
        print(f"Lesson: {lesson_title}")
        print(f"Title: {block.title}")
        print(f"Position: {block.position}")
        print(f"Block Type (raw): {repr(block.block_type)}")
        print(f"Block Type (type): {type(block.block_type)}")
        print(f"Block Type (value): {block.block_type.value if hasattr(block.block_type, 'value') else 'N/A'}")
        print(f"Content: {block.content}")

        # Проверим сериализацию через Pydantic
        from app.schemas.course import ExerciseBlockResponse

        response = ExerciseBlockResponse(
            id=block.id,
            lesson_id=block.lesson_id,
            block_type=block.block_type,
            title=block.title,
            content=block.content,
            position=block.position,
            created_at=block.created_at,
            updated_at=block.updated_at
        )

        print(f"\n{'='*60}")
        print(f"После сериализации Pydantic:")
        print(f"{'='*60}")
        print(f"Block Type: {response.block_type}")
        print(f"Block Type (type): {type(response.block_type)}")

        # Проверим JSON сериализацию
        json_dict = response.model_dump(mode='json')
        print(f"\n{'='*60}")
        print(f"После JSON сериализации:")
        print(f"{'='*60}")
        print(f"Block Type: {json_dict['block_type']}")
        print(f"Block Type (type): {type(json_dict['block_type'])}")
        print(f"Content: {json_dict['content']}")

if __name__ == "__main__":
    asyncio.run(check_audio_block())
