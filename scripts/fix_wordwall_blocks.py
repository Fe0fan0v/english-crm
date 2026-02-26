"""
Исправление Wordwall блоков
Конвертация TEXT блоков с Wordwall ссылками в VIDEO блоки
"""
import asyncio
import sys
import re
import httpx
from pathlib import Path
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock


async def get_wordwall_embed_url(wordwall_url: str) -> str | None:
    """Получить embed URL для Wordwall через oEmbed API"""
    try:
        oembed_url = f"https://wordwall.net/api/oembed?url={quote(wordwall_url)}&format=json"

        async with httpx.AsyncClient() as client:
            response = await client.get(oembed_url, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                html = data.get('html', '')

                # Извлекаем src из iframe
                match = re.search(r'src="([^"]+)"', html)
                if match:
                    return match.group(1)

    except Exception as e:
        print(f"[ERROR] Failed to get embed for {wordwall_url}: {e}")

    return None


async def fix_wordwall_blocks():
    """Исправление Wordwall блоков"""

    async with async_session_maker() as db:
        # Найдём все TEXT блоки с ссылками на Wordwall
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'text')
            .where(ExerciseBlock.content['html'].astext.ilike('%wordwall.net%'))
        )
        blocks = result.scalars().all()

        print(f"\n{'='*80}")
        print(f"Исправление Wordwall блоков")
        print(f"{'='*80}")
        print(f"Найдено блоков с Wordwall: {len(blocks)}")
        print()

        if not blocks:
            print("[OK] Нет блоков для исправления")
            return

        fixed = 0
        errors = 0

        for block in blocks:
            html_content = block.content.get('html', '')

            # Ищем ссылку на Wordwall
            match = re.search(r'https://wordwall\.net/[^\s"<>]+', html_content)
            if not match:
                print(f"[SKIP] Блок {block.id}: не найдена ссылка")
                continue

            wordwall_url = match.group(0)
            print(f"[INFO] Блок {block.id}: {wordwall_url}")

            # Получаем embed URL
            embed_url = await get_wordwall_embed_url(wordwall_url)

            if not embed_url:
                print(f"[ERROR] Блок {block.id}: не удалось получить embed")
                errors += 1
                continue

            # Обновляем HTML - заменяем ссылку на iframe
            iframe_html = f'<iframe src="{embed_url}" width="100%" height="500" style="border:none; border-radius:8px;" allowfullscreen></iframe>'

            block.content = {
                "html": iframe_html,
                "text": iframe_html
            }
            # Тип остаётся 'text'

            fixed += 1
            print(f"[OK] Блок {block.id}: конвертирован в video")

        # Сохраняем изменения
        await db.commit()

        print(f"\n{'='*80}")
        print(f"[OK] Результаты:")
        print(f"{'='*80}")
        print(f"Исправлено: {fixed}")
        print(f"Ошибок: {errors}")
        print(f"{'='*80}")


if __name__ == "__main__":
    asyncio.run(fix_wordwall_blocks())
