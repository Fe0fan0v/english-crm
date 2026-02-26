"""
Подсчёт fill_gaps блоков с неправильным форматом (html вместо text+gaps)
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select, func
from app.database import async_session_maker
from app.models.course import ExerciseBlock

async def count_broken_fillgaps():
    """Подсчёт блоков"""

    async with async_session_maker() as db:
        # Всего fill_gaps блоков
        result = await db.execute(
            select(func.count(ExerciseBlock.id))
            .where(ExerciseBlock.block_type == 'fill_gaps')
        )
        total = result.scalar()

        # Fill_gaps с 'html' в content (неправильный формат)
        result = await db.execute(
            select(func.count(ExerciseBlock.id))
            .where(ExerciseBlock.block_type == 'fill_gaps')
            .where(ExerciseBlock.content.has_key('html'))
        )
        with_html = result.scalar()

        # Fill_gaps с пустым массивом gaps
        result = await db.execute(
            select(func.count(ExerciseBlock.id))
            .where(ExerciseBlock.block_type == 'fill_gaps')
            .where(ExerciseBlock.content['gaps'].astext == '[]')
        )
        empty_gaps = result.scalar()

        print(f"\n{'='*60}")
        print(f"Статистика fill_gaps блоков:")
        print(f"{'='*60}")
        print(f"Всего fill_gaps блоков: {total}")
        print(f"С 'html' в content (сломанные): {with_html}")
        print(f"С пустым массивом gaps: {empty_gaps}")
        print(f"Правильных (с gaps > 0): {total - empty_gaps}")

if __name__ == "__main__":
    asyncio.run(count_broken_fillgaps())
