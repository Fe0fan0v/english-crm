"""
Скрипт для исправления типов блоков в базе данных.

Проблема: парсер неправильно определял teaching_guide как remember.
В HTML этих блоков есть <div class="note-name">Teaching guide</div>,
но они были сохранены как remember.

Этот скрипт находит все блоки remember с "Teaching guide" в content
и меняет их block_type на teaching_guide.

Использование:
    # Локально
    cd backend && python -m scripts.edvibe_parser.fix_teaching_guide

    # На сервере (в Docker)
    docker compose exec backend python /app/fix_teaching_guide.py
"""

import asyncio
import sys
from pathlib import Path

# Добавляем backend в path
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

try:
    from sqlalchemy import text
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.config import settings
    DATABASE_URL = settings.database_url
except ImportError as e:
    print(f"Ошибка импорта: {e}")
    print("Запустите скрипт из директории backend")
    sys.exit(1)


async def fix_teaching_guide_blocks():
    """Исправление блоков teaching_guide в базе данных"""

    print("=" * 60)
    print("Исправление блоков teaching_guide")
    print("=" * 60)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Находим все блоки remember с "Teaching guide" в content
        query = text("""
            SELECT id, block_type, content::text
            FROM exercise_blocks
            WHERE block_type = 'remember'
            AND (
                content::text ILIKE '%"note-name">Teaching guide<%'
                OR content::text ILIKE '%Teaching guide</div>%'
                OR content::text ILIKE '%class="note-name">Teaching guide%'
            )
        """)

        result = await session.execute(query)
        blocks_to_fix = result.fetchall()

        print(f"\nНайдено блоков для исправления: {len(blocks_to_fix)}")

        if not blocks_to_fix:
            print("Нет блоков для исправления.")
            return

        # Показываем примеры
        print("\nПримеры найденных блоков:")
        for block in blocks_to_fix[:3]:
            content_preview = block[2][:200] if block[2] else ""
            print(f"  ID: {block[0]}, type: {block[1]}")
            print(f"  Content preview: {content_preview}...")
            print()

        # 2. Обновляем block_type на teaching_guide
        update_query = text("""
            UPDATE exercise_blocks
            SET block_type = 'teaching_guide'
            WHERE block_type = 'remember'
            AND (
                content::text ILIKE '%"note-name">Teaching guide<%'
                OR content::text ILIKE '%Teaching guide</div>%'
                OR content::text ILIKE '%class="note-name">Teaching guide%'
            )
        """)

        result = await session.execute(update_query)
        await session.commit()

        print(f"\n[OK] Обновлено блоков: {result.rowcount}")

        # 3. Проверяем результат
        check_query = text("""
            SELECT block_type, COUNT(*)
            FROM exercise_blocks
            WHERE block_type IN ('teaching_guide', 'remember')
            GROUP BY block_type
        """)

        result = await session.execute(check_query)
        stats = result.fetchall()

        print("\nСтатистика после исправления:")
        for stat in stats:
            print(f"  {stat[0]}: {stat[1]} блоков")

    await engine.dispose()
    print("\n[OK] Готово!")


if __name__ == "__main__":
    asyncio.run(fix_teaching_guide_blocks())
