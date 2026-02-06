"""
Исправление essay блоков в БД.
Конвертирует HTML-контент Edvibe в структурированный формат:
  {"prompt": "...", "min_words": null, "max_words": null}

Для блоков с background-image создаёт image блок перед essay.

Запуск:
  sudo docker compose cp fix_essay_blocks.py backend:/app/fix_essay_blocks.py
  sudo docker compose exec backend python /app/fix_essay_blocks.py --dry-run
  sudo docker compose exec backend python /app/fix_essay_blocks.py
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock


def extract_bg_image(html: str) -> str | None:
    """Извлекает URL background-image из HTML."""
    # Формат с &quot; (HTML entities) — проверяем первым
    m = re.search(r'background-image:\s*url\(&quot;([^&]+)&quot;\)', html)
    if m:
        return m.group(1)
    # Стандартный формат с кавычками
    m = re.search(r'background-image:\s*url\(["\']([^"\']+)["\']\)', html)
    if m:
        return m.group(1)
    return None


def extract_text_from_html(html: str) -> str:
    """Извлекает осмысленный текст из HTML, убирая UI-мусор Edvibe."""
    # Убираем HTML теги
    text = re.sub(r'<[^>]+>', ' ', html)
    # Убираем HTML entities
    text = text.replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    # Убираем UI-мусор Edvibe
    text = re.sub(r'Заметки', '', text)
    text = re.sub(r'Символов:\s*\d+', '', text)
    text = re.sub(r'Слов:\s*\d+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_word_limits(text: str) -> tuple[int | None, int | None]:
    """Пытается извлечь min/max слов из текста промпта."""
    min_words = None
    max_words = None

    # "at least N words" / "Write at least N words"
    m = re.search(r'(?:at least|more than|minimum)\s+(\d+)\s+words', text, re.IGNORECASE)
    if m:
        min_words = int(m.group(1))

    # "maximum N words" / "no more than N words"
    m = re.search(r'(?:maximum|no more than|up to|max)\s+(\d+)\s+words', text, re.IGNORECASE)
    if m:
        max_words = int(m.group(1))

    # "N words exactly" / "must be N words"
    m = re.search(r'(\d+)\s+words?\s+exactly', text, re.IGNORECASE)
    if m:
        min_words = int(m.group(1))
        max_words = int(m.group(1))

    return min_words, max_words


async def fix_essay_blocks(dry_run: bool = False):
    """Основная функция исправления."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'essay')
            .order_by(ExerciseBlock.lesson_id, ExerciseBlock.position)
        )
        blocks = result.scalars().all()

        print(f"\n{'=' * 80}")
        print(f"ИСПРАВЛЕНИЕ ESSAY БЛОКОВ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"Найдено блоков: {len(blocks)}\n")

        stats = {
            "title_as_prompt": 0,
            "html_text_as_prompt": 0,
            "generic_prompt": 0,
            "image_blocks_created": 0,
            "already_ok": 0,
            "errors": 0,
        }

        from collections import defaultdict
        new_image_blocks = defaultdict(list)

        for block in blocks:
            content = block.content

            # Уже в правильном формате?
            if 'prompt' in content and content.get('prompt', '').strip():
                stats["already_ok"] += 1
                continue

            html = content.get('html', '') or ''
            title = (block.title or '').strip()

            # Извлекаем background-image URL
            bg_image_url = extract_bg_image(html) if html else None

            # Определяем prompt
            prompt = ''
            if title:
                prompt = title
                stats["title_as_prompt"] += 1
            else:
                # Пробуем извлечь текст из HTML
                extracted = extract_text_from_html(html)
                if extracted and len(extracted) > 3:
                    prompt = extracted
                    stats["html_text_as_prompt"] += 1
                else:
                    prompt = "Write your answer"
                    stats["generic_prompt"] += 1

            # Извлекаем лимиты слов
            min_words, max_words = extract_word_limits(prompt)

            # Обновляем блок
            if not dry_run:
                block.content = {
                    "prompt": prompt,
                    "min_words": min_words,
                    "max_words": max_words,
                }

            # Если есть background-image — создаём image блок перед essay
            if bg_image_url:
                new_image_blocks[block.lesson_id].append({
                    "lesson_id": block.lesson_id,
                    "block_type": "image",
                    "title": "",
                    "content": {
                        "url": bg_image_url,
                        "alt": title or "Task image",
                    },
                    "position": block.position,  # Ставим на ту же позицию (перед essay)
                })
                stats["image_blocks_created"] += 1
                print(f"  [IMAGE+ESSAY] Block #{block.id}: {prompt[:60]}")
            else:
                source = "title" if title else ("html" if prompt != "Write your answer" else "generic")
                extra = ""
                if min_words:
                    extra = f" [min:{min_words}]"
                if max_words:
                    extra = f" [max:{max_words}]"
                print(f"  [{source.upper()}] Block #{block.id}: {prompt[:60]}{extra}")

        # Вставляем image блоки и пересчитываем позиции
        if new_image_blocks and not dry_run:
            for lesson_id, img_blocks in new_image_blocks.items():
                for ib in img_blocks:
                    new_eb = ExerciseBlock(
                        lesson_id=ib["lesson_id"],
                        block_type=ib["block_type"],
                        title=ib["title"],
                        content=ib["content"],
                        position=ib["position"],
                    )
                    db.add(new_eb)

            await db.flush()

            # Пересчёт позиций для каждого затронутого урока
            for lesson_id in new_image_blocks.keys():
                res = await db.execute(
                    select(ExerciseBlock)
                    .where(ExerciseBlock.lesson_id == lesson_id)
                    .order_by(ExerciseBlock.position, ExerciseBlock.id)
                )
                lesson_blocks = list(res.scalars().all())
                for idx, lb in enumerate(lesson_blocks):
                    lb.position = idx

        if not dry_run:
            await db.commit()

        # Итоги
        print(f"\n{'=' * 80}")
        print(f"РЕЗУЛЬТАТЫ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"  Уже ОК:                    {stats['already_ok']}")
        print(f"  Title → prompt:            {stats['title_as_prompt']}")
        print(f"  HTML text → prompt:        {stats['html_text_as_prompt']}")
        print(f"  Generic prompt:            {stats['generic_prompt']}")
        print(f"  Image блоков создано:      {stats['image_blocks_created']}")
        print(f"  Ошибок:                    {stats['errors']}")
        print(f"{'=' * 80}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(fix_essay_blocks(dry_run=dry_run))
