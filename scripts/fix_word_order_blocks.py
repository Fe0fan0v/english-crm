"""
Исправление word_order блоков в БД.

1. sentence_order (8 шт): парсим предложения с номерами → text с правильным порядком
2. draggable (75 шт): fill_gaps ошибочно классифицированные → text с word bank

Запуск:
  sudo docker compose cp fix_word_order_blocks.py backend:/app/fix_word_order_blocks.py
  sudo docker compose exec backend python /app/fix_word_order_blocks.py --dry-run
  sudo docker compose exec backend python /app/fix_word_order_blocks.py
"""
import asyncio
import re
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock


def classify_word_order_html(html: str) -> str:
    """Определяет реальный тип блока по HTML."""
    if 'exercise_sentences_in_correct_order' in html:
        return 'sentence_order'
    if 'draggable_container_wrapper' in html:
        return 'fill_gaps_draggable'
    return 'unknown'


def parse_sentence_order(html: str) -> str:
    """
    Парсит sentence_order HTML в читаемый HTML с правильным порядком.
    Извлекает: номер (correct position) и текст каждого предложения.
    """
    # Извлекаем пары (номер, текст)
    items = re.findall(
        r'<div class="number">(\d+)</div>.*?<div class="sentence_text">([^<]+)',
        html, re.DOTALL
    )

    if not items:
        # Fallback: strip all HTML
        text = re.sub(r'<[^>]+>', ' ', html)
        text = re.sub(r'\s+', ' ', text).strip()
        return f"<p>{escape(text)}</p>"

    # Сортируем по номеру (correct position)
    sorted_items = sorted(items, key=lambda x: int(x[0]))

    # Собираем HTML
    parts = []
    for num, text in sorted_items:
        clean_text = text.replace('&nbsp;', ' ').strip()
        parts.append(f"<p><strong>{num}.</strong> {escape(clean_text)}</p>")

    return '\n'.join(parts)


def parse_draggable_to_text(html: str, title: str = "") -> str:
    """
    Конвертирует fill_gaps draggable HTML в читаемый text.
    Извлекает word bank и текст с пропусками.
    """
    # Извлекаем слова из банка (draggable-container секция)
    draggable_section = html.split('</div></div></div></div>')[0] if 'draggable-container' in html else ''
    words = re.findall(r'<span class="word-block_value">([^<]+)</span>', draggable_section)
    words = [w.strip() for w in words if w.strip()]

    # Извлекаем текстовое содержимое (после draggable секции)
    # Ищем основной текст в <p> или <div> после draggable_container_wrapper
    text_part = html
    if 'draggable_container_wrapper' in html:
        # Берём всё после закрытия draggable_container_wrapper
        parts = html.split('</div></div></div></div>', 1)
        if len(parts) > 1:
            text_part = parts[1]

    # Убираем HTML теги, оставляя br как переносы
    text_part = re.sub(r'<br\s*/?>', '\n', text_part)
    text_part = re.sub(r'<div class="drag_wrapper[^"]*paste_drag_word_item[^>]*>.*?</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>', ' _____ ', text_part)
    text_part = re.sub(r'<div[^>]*class="[^"]*paste_drag_word[^"]*"[^>]*>.*?</span></div></div></div>.*?</div></div>', ' _____ ', text_part, flags=re.DOTALL)
    text_part = re.sub(r'<[^>]+>', ' ', text_part)
    text_part = text_part.replace('&nbsp;', ' ')
    text_part = re.sub(r' +', ' ', text_part)
    text_part = re.sub(r'\n\s*\n', '\n', text_part).strip()

    # Убираем дублирование слов из банка в начале текста
    lines = [l.strip() for l in text_part.split('\n') if l.strip()]

    result_parts = []
    if title:
        result_parts.append(f"<p><strong>{escape(title)}</strong></p>")
    if words:
        unique_words = list(dict.fromkeys(words))  # Сохраняем порядок, убираем дубликаты
        words_str = ", ".join(unique_words)
        result_parts.append(f"<p><em>Words: {escape(words_str)}</em></p>")
    if lines:
        for line in lines:
            result_parts.append(f"<p>{escape(line)}</p>")

    return '\n'.join(result_parts) if result_parts else "<p>(empty)</p>"


async def fix_word_order_blocks(dry_run: bool = False):
    """Основная функция исправления."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'word_order')
            .order_by(ExerciseBlock.lesson_id, ExerciseBlock.position)
        )
        blocks = result.scalars().all()

        print(f"\n{'=' * 80}")
        print(f"ИСПРАВЛЕНИЕ WORD_ORDER БЛОКОВ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"Найдено блоков: {len(blocks)}\n")

        stats = {
            "sentence_order_to_text": 0,
            "fill_gaps_to_text": 0,
            "unknown_to_text": 0,
            "already_ok": 0,
            "errors": 0,
        }

        for block in blocks:
            content = block.content

            # Уже в правильном формате?
            if 'correct_sentence' in content and content.get('correct_sentence', '').strip():
                stats["already_ok"] += 1
                continue

            html = content.get('text', '') or content.get('html', '') or ''

            if not html:
                stats["errors"] += 1
                print(f"  [ERROR] Block #{block.id}: пустой контент")
                continue

            block_type = classify_word_order_html(html)

            if block_type == 'sentence_order':
                readable = parse_sentence_order(html)
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": readable}
                stats["sentence_order_to_text"] += 1
                # Показываем краткий превью
                preview = re.sub(r'<[^>]+>', ' ', readable)[:80]
                print(f"  [SENTENCE→TEXT] Block #{block.id}: {preview}")

            elif block_type == 'fill_gaps_draggable':
                readable = parse_draggable_to_text(html, block.title or "")
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": readable}
                stats["fill_gaps_to_text"] += 1

            else:
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": html}
                stats["unknown_to_text"] += 1
                print(f"  [UNKNOWN→TEXT] Block #{block.id}")

        if not dry_run:
            await db.commit()

        # Итоги
        print(f"\n{'=' * 80}")
        print(f"РЕЗУЛЬТАТЫ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"  Уже ОК:                    {stats['already_ok']}")
        print(f"  Sentence_order → text:     {stats['sentence_order_to_text']}")
        print(f"  Fill_gaps → text:          {stats['fill_gaps_to_text']}")
        print(f"  Unknown → text:            {stats['unknown_to_text']}")
        print(f"  Ошибок:                    {stats['errors']}")
        print(f"{'=' * 80}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(fix_word_order_blocks(dry_run=dry_run))
