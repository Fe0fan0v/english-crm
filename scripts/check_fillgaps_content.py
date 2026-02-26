"""
Проверка содержимого fill_gaps блока
"""
import asyncio
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock

async def check_content():
    """Проверка содержимого"""

    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'fill_gaps')
            .limit(3)
        )
        blocks = result.scalars().all()

        for i, block in enumerate(blocks, 1):
            print(f"\n{'='*80}")
            print(f"Блок {i}: {block.title}")
            print(f"{'='*80}")
            print(f"Content keys: {list(block.content.keys())}")

            if 'text' in block.content:
                text = block.content['text']
                print(f"\nText (first 200 chars): {text[:200] if text else 'EMPTY'}")

            if 'gaps' in block.content:
                gaps = block.content['gaps']
                print(f"\nGaps type: {type(gaps)}")
                print(f"Gaps length: {len(gaps) if isinstance(gaps, list) else 'N/A'}")
                if isinstance(gaps, list) and len(gaps) > 0:
                    print(f"First gap: {gaps[0]}")
                else:
                    print(f"Gaps value: {gaps}")

            if 'html' in block.content:
                html = block.content['html']
                print(f"\nHTML (first 300 chars): {html[:300]}")

if __name__ == "__main__":
    asyncio.run(check_content())
