"""
Исправление fill_gaps блоков в БД
Извлечение text и gaps из HTML
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock

# Импортируем функцию парсинга inline
from bs4 import BeautifulSoup
import re
import html as html_module


def parse_fillgaps_from_html(html_content: str) -> dict:
    """Парсит HTML fill_gaps блока и извлекает текст и gaps"""

    # Декодируем HTML entities
    html_content = html_module.unescape(html_content)

    soup = BeautifulSoup(html_content, 'html.parser')

    # Сначала найдём все div с rightanswers (это наши gaps)
    gap_elements = soup.find_all('div', attrs={'rightanswers': True})

    # Удаляем все span с listofintputs (они содержат мусор в атрибуте)
    # Но сначала извлечём из них div с rightanswers и переместим выше
    for span in soup.find_all('span', attrs={'listofintputs': True}):
        # Найдём div с rightanswers внутри
        gap_div = span.find('div', attrs={'rightanswers': True})
        if gap_div:
            # Заменяем span на gap_div
            span.replace_with(gap_div)
        else:
            # Если нет gap_div, просто удаляем span
            span.decompose()

    # Удаляем все data-testid элементы (input wrappers)
    for elem in soup.find_all(attrs={'data-testid': True}):
        elem.decompose()

    # Удаляем popover и indicators (мусор)
    for div in soup.find_all('div', class_=['tir-popover_element', 'indicators_wrapper', 'emoji-animation', 'comment-icon']):
        div.decompose()

    # Теперь снова найдём все элементы с rightanswers
    gap_elements = soup.find_all('div', attrs={'rightanswers': True})

    gaps = []
    gap_index = 0

    # Обрабатываем каждый gap element
    for elem in gap_elements:
        right_answer = elem.get('rightanswers', '').strip()

        if not right_answer:
            continue

        # Заменяем элемент на placeholder {index}
        placeholder = f"{{{gap_index}}}"
        elem.replace_with(placeholder)

        gaps.append({
            "index": gap_index,
            "answer": right_answer,
            "alternatives": []
        })

        gap_index += 1

    # Получаем очищенный текст
    text = soup.get_text(separator=' ', strip=True)

    # Убираем лишние пробелы
    text = re.sub(r'\s+', ' ', text).strip()

    # Убираем пробелы перед знаками препинания
    text = re.sub(r'\s+([.,!?;:])', r'\1', text)

    return {
        "text": text,
        "gaps": gaps
    }


async def fix_fillgaps():
    """Исправление fill_gaps блоков"""

    async with async_session_maker() as db:
        # Найдём все fill_gaps блоки
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'fill_gaps')
        )
        blocks = result.scalars().all()

        print(f"\n{'='*80}")
        print(f"Исправление fill_gaps блоков")
        print(f"{'='*80}")
        print(f"Найдено блоков: {len(blocks)}")
        print()

        if not blocks:
            print("[OK] Нет блоков для исправления")
            return

        fixed = 0
        errors = 0
        skipped = 0

        for i, block in enumerate(blocks, 1):
            # Проверяем есть ли HTML
            if 'html' not in block.content:
                skipped += 1
                continue

            html_content = block.content.get('html', '')
            if not html_content:
                skipped += 1
                continue

            try:
                # Парсим HTML
                parsed = parse_fillgaps_from_html(html_content)

                # Обновляем content
                block.content = {
                    "text": parsed['text'],
                    "gaps": parsed['gaps']
                }

                fixed += 1

                if fixed % 100 == 0:
                    print(f"[PROGRESS] Обработано: {fixed}/{len(blocks)}")

            except Exception as e:
                print(f"[ERROR] Блок {block.id}: {e}")
                errors += 1

        # Сохраняем изменения
        await db.commit()

        print(f"\n{'='*80}")
        print(f"[OK] Результаты:")
        print(f"{'='*80}")
        print(f"Исправлено: {fixed}")
        print(f"Пропущено: {skipped}")
        print(f"Ошибок: {errors}")
        print(f"{'='*80}")

        # Показываем пример
        if fixed > 0:
            result = await db.execute(
                select(ExerciseBlock)
                .where(ExerciseBlock.block_type == 'fill_gaps')
                .limit(1)
            )
            example = result.scalar_one_or_none()

            if example:
                print(f"\nПример исправленного блока:")
                print(f"Title: {example.title}")
                print(f"Text: {example.content.get('text', '')[:150]}...")
                print(f"Gaps: {len(example.content.get('gaps', []))} шт.")


if __name__ == "__main__":
    asyncio.run(fix_fillgaps())
