"""
Исправление matching блоков в БД.

1. Настоящие matching (exercise_wrapper_images): парсим пары {left, right}
2. Ошибочно классифицированные fill_gaps_draggable: конвертируем в text
3. Ошибочно классифицированные word_order: конвертируем в text

Запуск:
  sudo docker compose cp fix_matching_blocks.py backend:/app/fix_matching_blocks.py
  sudo docker compose exec backend python /app/fix_matching_blocks.py --dry-run
  sudo docker compose exec backend python /app/fix_matching_blocks.py
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock


def classify_matching_html(html: str) -> str:
    """Определяет реальный тип блока по HTML."""
    if 'exercise_wrapper_images' in html:
        return 'matching_images'
    if 'exercise_sentences_in_correct_order' in html:
        return 'word_order'
    if 'draggable_container_wrapper' in html:
        return 'fill_gaps_draggable'
    return 'unknown'


def parse_matching_pairs(html: str) -> list[dict]:
    """
    Парсит matching пары из HTML exercise_wrapper_images.
    Left: <span class="word-block_value">TEXT</span> в words_template
    Right: <img class="question_image" src="URL"> в image_block_wrappper
    Пары связаны позиционно: left[0] ↔ right[0]
    """
    # Извлекаем left items (слова)
    left_items = re.findall(
        r'<div class="words_template">(.+?)</div>\s*</div>\s*</div>\s*</div>',
        html, re.DOTALL
    )
    if not left_items:
        # Fallback: ищем все word-block_value в words_template области
        left_items = [html.split('</div></div></div></div>')[0]] if 'words_template' in html else []

    # Все word-block_value из области words_template
    words_section = html.split('image_block_wrappper')[0] if 'image_block_wrappper' in html else html
    left_texts = re.findall(r'<span class="word-block_value">([^<]+)</span>', words_section)
    left_texts = [t.strip() for t in left_texts if t.strip()]

    # Извлекаем right items (картинки) — отсортированы по index
    image_blocks = re.findall(
        r'image_block_wrappper[^"]*"\s+index="(\d+)".*?<img\s+class="question_image"\s+src="([^"]+)"',
        html, re.DOTALL
    )

    if image_blocks:
        # Сортируем по index
        image_blocks.sort(key=lambda x: int(x[0]))
        right_urls = [url for _, url in image_blocks]
    else:
        # Fallback: просто все question_image src
        right_urls = re.findall(r'<img\s+class="question_image"\s+src="([^"]+)"', html)

    # Создаём пары позиционно
    pairs = []
    for i in range(min(len(left_texts), len(right_urls))):
        pairs.append({
            "left": left_texts[i],
            "right": right_urls[i],
        })

    return pairs


def extract_readable_text(html: str) -> str:
    """Извлекает читаемый текст из fill_gaps_draggable HTML для конвертации в text блок."""
    # Извлекаем слова из банка слов
    words = re.findall(r'<span class="word-block_value">([^<]+)</span>', html)
    words = [w.strip() for w in words if w.strip()]

    # Убираем всё HTML
    text = re.sub(r'<[^>]+>', ' ', html)
    text = text.replace('&nbsp;', ' ')
    text = re.sub(r'\s+', ' ', text).strip()

    # Убираем UI-мусор
    for w in words:
        # Слова из банка могут дублироваться в тексте - убираем первое вхождение в начале
        pass

    if words:
        word_bank = ', '.join(dict.fromkeys(words))  # Убираем дубликаты сохраняя порядок
        return f"<p><strong>Word bank:</strong> {word_bank}</p><p>{text}</p>"

    return f"<p>{text}</p>"


def extract_word_order_text(html: str) -> str:
    """Извлекает читаемый текст из word_order HTML."""
    # Извлекаем предложения
    sentences = re.findall(r'class="sentence"[^>]*>([^<]+)', html)
    if not sentences:
        # Fallback: убираем HTML теги
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        return f"<p>{text}</p>"

    items = [s.strip() for s in sentences if s.strip()]
    return '<ol>' + ''.join(f'<li>{s}</li>' for s in items) + '</ol>'


async def fix_matching_blocks(dry_run: bool = False):
    """Основная функция исправления."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'matching')
            .order_by(ExerciseBlock.lesson_id, ExerciseBlock.position)
        )
        blocks = result.scalars().all()

        print(f"\n{'=' * 80}")
        print(f"ИСПРАВЛЕНИЕ MATCHING БЛОКОВ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"Найдено блоков: {len(blocks)}\n")

        stats = {
            "matching_ok": 0,
            "matching_no_pairs": 0,
            "fill_gaps_to_text": 0,
            "word_order_to_text": 0,
            "unknown_to_text": 0,
            "already_ok": 0,
            "errors": 0,
        }

        for block in blocks:
            content = block.content

            # Уже в правильном формате?
            if 'pairs' in content and content.get('pairs'):
                stats["already_ok"] += 1
                continue

            html = content.get('text', '') or content.get('html', '') or ''

            if not html:
                stats["errors"] += 1
                print(f"  [ERROR] Block #{block.id}: пустой контент")
                continue

            block_type = classify_matching_html(html)

            if block_type == 'matching_images':
                # Настоящий matching — парсим пары
                try:
                    pairs = parse_matching_pairs(html)
                except Exception as e:
                    print(f"  [ERROR] Block #{block.id}: {e}")
                    stats["errors"] += 1
                    continue

                if not pairs:
                    print(f"  [NO PAIRS] Block #{block.id}")
                    stats["matching_no_pairs"] += 1
                    if not dry_run:
                        block.block_type = 'text'
                        block.content = {"html": html}
                    continue

                if not dry_run:
                    block.content = {
                        "pairs": pairs,
                        "shuffle_right": True,
                    }
                stats["matching_ok"] += 1
                print(f"  [MATCHING] Block #{block.id}: {len(pairs)} пар")

            elif block_type == 'fill_gaps_draggable':
                # Неправильно классифицирован — конвертируем в text
                readable = extract_readable_text(html)
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": readable}
                stats["fill_gaps_to_text"] += 1

            elif block_type == 'word_order':
                # Неправильно классифицирован — конвертируем в text
                readable = extract_word_order_text(html)
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": readable}
                stats["word_order_to_text"] += 1

            else:
                # Неизвестный формат — конвертируем в text
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": html}
                stats["unknown_to_text"] += 1
                print(f"  [UNKNOWN] Block #{block.id}")

        if not dry_run:
            await db.commit()

        # Итоги
        print(f"\n{'=' * 80}")
        print(f"РЕЗУЛЬТАТЫ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"  Уже ОК:                    {stats['already_ok']}")
        print(f"  Matching (парсинг OK):     {stats['matching_ok']}")
        print(f"  Matching (без пар):        {stats['matching_no_pairs']}")
        print(f"  Fill_gaps → text:          {stats['fill_gaps_to_text']}")
        print(f"  Word_order → text:         {stats['word_order_to_text']}")
        print(f"  Unknown → text:            {stats['unknown_to_text']}")
        print(f"  Ошибок:                    {stats['errors']}")
        print(f"{'=' * 80}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(fix_matching_blocks(dry_run=dry_run))
