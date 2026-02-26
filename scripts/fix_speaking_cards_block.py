"""
Исправление блока Speaking cards (ID: 30796)
Заменить ссылку на iframe
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock

async def fix_block():
    """Исправление блока"""

    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock).where(ExerciseBlock.id == 30796)
        )
        block = result.scalar_one_or_none()

        if not block:
            print("[ERROR] Блок не найден")
            return

        print(f"\n{'='*80}")
        print(f"Блок 30796: {block.title}")
        print(f"{'='*80}")
        print(f"Старый content: {block.content}")

        # Embed URL для https://wordwall.net/ru/resource/11275091/i-wish-3
        embed_url = "https://wordwall.net/ru/embed/d57d0a85cfd347078cdf743c47cb18b7?themeId=0&ref=oembed"

        # Обновляем HTML
        iframe_html = f'<iframe src="{embed_url}" width="100%" height="500" style="border:none; border-radius:8px;" allowfullscreen></iframe>'

        block.content = {
            "html": iframe_html,
            "text": iframe_html
        }

        await db.commit()

        print(f"\nНовый content: {block.content}")
        print(f"\n[OK] Блок обновлён!")

if __name__ == "__main__":
    asyncio.run(fix_block())
