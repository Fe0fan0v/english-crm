"""
Конвертация сломанных fill_gaps блоков в text
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select, update
from app.database import async_session_maker
from app.models.course import ExerciseBlock

async def convert_fillgaps():
    """Конвертация fill_gaps блоков с HTML в text блоки"""

    async with async_session_maker() as db:
        # Найдём все fill_gaps блоки с 'html' в content
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'fill_gaps')
            .where(ExerciseBlock.content.has_key('html'))
        )
        blocks = result.scalars().all()

        print(f"\n{'='*60}")
        print(f"Конвертация fill_gaps блоков в text")
        print(f"{'='*60}")
        print(f"Найдено блоков: {len(blocks)}")
        print()

        if not blocks:
            print("[OK] Нет блоков для конвертации")
            return

        # Подтверждение
        answer = input(f"Конвертировать {len(blocks)} блоков в type='text'? (yes/no): ")
        if answer.lower() != 'yes':
            print("[CANCELLED] Отменено")
            return

        converted = 0
        for block in blocks:
            # Конвертируем в text блок
            # Оставляем HTML как есть в content.html
            block.block_type = 'text'
            # content.html уже есть, просто оставляем как есть
            converted += 1

            if converted % 100 == 0:
                print(f"[PROGRESS] Обработано: {converted}/{len(blocks)}")

        await db.commit()

        print(f"\n{'='*60}")
        print(f"[OK] Конвертировано блоков: {converted}")
        print(f"{'='*60}")
        print("\nТеперь эти блоки будут отображаться как обычный текст")
        print("(без интерактивных полей ввода)")

if __name__ == "__main__":
    asyncio.run(convert_fillgaps())
