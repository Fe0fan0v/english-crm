"""
Исправление true_false блоков в БД.
Парсит текстовое содержимое в структурированный формат:
  {"statement": "...", "is_true": true, "explanation": ""}
Мультиутверждения разбиваются на отдельные блоки.

Запуск:
  sudo docker compose cp fix_true_false_blocks.py backend:/app/fix_true_false_blocks.py
  sudo docker compose exec backend python /app/fix_true_false_blocks.py --dry-run
  sudo docker compose exec backend python /app/fix_true_false_blocks.py
"""
import asyncio
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.course import ExerciseBlock


def parse_statements(text: str) -> list[str]:
    """
    Парсит текст с утверждениями.
    Формат:
      Statement\nВерно\nНеверно\nN / total\n
      Statement\nTrue\nFalse\n
    Возвращает список строк-утверждений.
    """
    if not text or not text.strip():
        return []

    lines = text.strip().split('\n')
    statements = []
    current_statement_lines = []

    # Отслеживаем: видели ли мы маркер T/F после текущего утверждения
    seen_tf_marker = False

    for line in lines:
        stripped = line.strip()

        # Пропускаем пустые строки
        if not stripped:
            continue

        # Счётчик "N / M" — конец утверждения
        if re.match(r'^\d+\s*/\s*\d+$', stripped):
            if current_statement_lines:
                statement = ' '.join(current_statement_lines).strip()
                statement = re.sub(r'^\d+\.\s*', '', statement)
                if statement:
                    statements.append(statement)
                current_statement_lines = []
            seen_tf_marker = False
            continue

        # Маркер True/False — пропускаем, но запоминаем как разделитель
        if stripped in ('Верно', 'Неверно', 'Неизвестно', 'True', 'False'):
            seen_tf_marker = True
            continue

        # Обычная строка — но если перед ней был маркер T/F, значит это новое утверждение
        if seen_tf_marker and current_statement_lines:
            statement = ' '.join(current_statement_lines).strip()
            statement = re.sub(r'^\d+\.\s*', '', statement)
            if statement:
                statements.append(statement)
            current_statement_lines = []
            seen_tf_marker = False

        current_statement_lines.append(stripped)

    # Последнее утверждение (если нет финального счётчика)
    if current_statement_lines:
        statement = ' '.join(current_statement_lines).strip()
        statement = re.sub(r'^\d+\.\s*', '', statement)
        if statement:
            statements.append(statement)

    return statements


async def fix_true_false_blocks(dry_run: bool = False):
    """Основная функция исправления."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'true_false')
            .order_by(ExerciseBlock.lesson_id, ExerciseBlock.position)
        )
        blocks = result.scalars().all()

        print(f"\n{'=' * 80}")
        print(f"ИСПРАВЛЕНИЕ TRUE_FALSE БЛОКОВ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"Найдено блоков: {len(blocks)}\n")

        stats = {
            "single_ok": 0,
            "multi_split": 0,
            "new_blocks": 0,
            "empty_to_text": 0,
            "html_to_text": 0,
            "already_ok": 0,
            "errors": 0,
        }

        from collections import defaultdict
        new_blocks_by_lesson = defaultdict(list)

        for block in blocks:
            content = block.content

            # Уже в правильном формате?
            if 'statement' in content and content.get('statement', '').strip():
                stats["already_ok"] += 1
                continue

            # Получаем текст
            text = content.get('text', '') or content.get('question', '')

            # HTML-блок без утверждений (статья/текст)
            if content.get('html') and not text:
                if not dry_run:
                    block.block_type = 'text'
                stats["html_to_text"] += 1
                print(f"  [HTML→TEXT] Block #{block.id}")
                continue

            # HTML в поле text (статья, не утверждения)
            if text and '<div>' in text and 'Верно' not in text and 'True' not in text:
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": text}
                stats["html_to_text"] += 1
                print(f"  [HTML→TEXT] Block #{block.id}")
                continue

            # Пустой контент
            if not text or not text.strip():
                if not dry_run:
                    block.block_type = 'text'
                    block.content = {"html": "<p>(пустой блок)</p>"}
                stats["empty_to_text"] += 1
                print(f"  [EMPTY→TEXT] Block #{block.id}")
                continue

            # Парсим утверждения
            try:
                statements = parse_statements(text)
            except Exception as e:
                print(f"  [ERROR] Block #{block.id}: {e}")
                stats["errors"] += 1
                continue

            if not statements:
                print(f"  [NO STATEMENTS] Block #{block.id}: {text[:80]}")
                stats["errors"] += 1
                continue

            # Обновляем первый блок
            if not dry_run:
                block.content = {
                    "statement": statements[0],
                    "is_true": True,
                    "explanation": "",
                }

            if len(statements) == 1:
                stats["single_ok"] += 1
            else:
                stats["multi_split"] += 1
                # Создаём дополнительные блоки для остальных утверждений
                for i, stmt in enumerate(statements[1:], 1):
                    new_blocks_by_lesson[block.lesson_id].append({
                        "lesson_id": block.lesson_id,
                        "block_type": "true_false",
                        "title": block.title,
                        "content": {
                            "statement": stmt,
                            "is_true": True,
                            "explanation": "",
                        },
                        "position": block.position + i,
                    })
                    stats["new_blocks"] += 1

                print(f"  [SPLIT] Block #{block.id}: {len(statements)} утверждений "
                      f"(lesson #{block.lesson_id})")

        # Вставляем новые блоки и пересчитываем позиции
        if new_blocks_by_lesson and not dry_run:
            for lesson_id, new_blocks in new_blocks_by_lesson.items():
                for nb in new_blocks:
                    new_eb = ExerciseBlock(
                        lesson_id=nb["lesson_id"],
                        block_type=nb["block_type"],
                        title=nb["title"],
                        content=nb["content"],
                        position=nb["position"],
                    )
                    db.add(new_eb)

            await db.flush()

            # Пересчёт позиций
            for lesson_id in new_blocks_by_lesson.keys():
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
        print(f"  Один (OK):                 {stats['single_ok']}")
        print(f"  Мульти (разбит):           {stats['multi_split']}")
        print(f"  Новых блоков создано:      {stats['new_blocks']}")
        print(f"  HTML → text:               {stats['html_to_text']}")
        print(f"  Пустые → text:             {stats['empty_to_text']}")
        print(f"  Ошибок:                    {stats['errors']}")
        print(f"{'=' * 80}")

        # Примеры
        if not dry_run:
            res = await db.execute(
                select(ExerciseBlock)
                .where(ExerciseBlock.block_type == 'true_false')
                .where(ExerciseBlock.content['statement'].as_string() != '')
                .limit(3)
            )
            examples = res.scalars().all()
            if examples:
                print(f"\nПримеры:")
                for ex in examples:
                    print(f"  Block #{ex.id}: {ex.content.get('statement', '')[:80]}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(fix_true_false_blocks(dry_run=dry_run))
