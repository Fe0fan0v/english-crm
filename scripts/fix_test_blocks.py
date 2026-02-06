"""
Исправление test блоков в БД.
Парсит текстовое содержимое в структурированный формат:
  {"question": "...", "options": [...], "multiple_answers": false, "explanation": ""}
Мультивопросные блоки разбиваются на отдельные блоки.
Мусорные блоки конвертируются в text.

Запуск: скопировать на сервер и выполнить через docker exec:
  sudo docker compose cp fix_test_blocks.py backend:/app/fix_test_blocks.py
  sudo docker compose exec backend python /app/fix_test_blocks.py --dry-run
  sudo docker compose exec backend python /app/fix_test_blocks.py
"""
import asyncio
import re
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select, func, text as sql_text
from app.database import async_session_maker
from app.models.course import ExerciseBlock


def make_option(text: str, is_correct: bool = False) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "text": text.strip(),
        "is_correct": is_correct,
    }


def strip_option_prefix(line: str) -> str:
    """Убирает префикс варианта ответа: 'a)', 'b)', 'a ', 'A.', etc."""
    # a) text / b) text / c) text
    m = re.match(r'^[a-dA-D]\)\s*(.+)', line)
    if m:
        return m.group(1).strip()
    # a text / b text (только одна буква + пробел + текст)
    m = re.match(r'^[a-dA-D]\s+(.+)', line)
    if m:
        return m.group(1).strip()
    return line.strip()


def is_question_line(line: str) -> bool:
    """Определяет, является ли строка вопросом (а не вариантом ответа)."""
    stripped = line.strip()
    if not stripped:
        return False
    # Нумерованный вопрос: "1.", "2.", "1. Text"
    if re.match(r'^\d+\.\s', stripped) or re.match(r'^\d+\.$', stripped):
        return True
    # Содержит бланки: ..... или ____ (заполнить пропуск)
    if '.....' in stripped or '____' in stripped:
        return True
    # Заканчивается на "?" (но НЕ если это вариант-префикс типа "a Where are you?")
    if stripped.endswith('?') and not re.match(r'^[a-dA-D]\)\s', stripped) and not re.match(r'^[a-dA-D]\s+\S', stripped):
        return True
    return False


def is_garbage(question_text: str) -> bool:
    """Определяет мусорный контент (не настоящий тест)."""
    lines = [l.strip() for l in question_text.strip().split('\n') if l.strip()]
    if not lines:
        return True
    # Все строки - просто числа
    if all(re.match(r'^\d+$', l) for l in lines):
        return True
    # Очень короткий контент без вопросительных структур
    if len(question_text.strip()) < 10 and '?' not in question_text:
        return True
    return False


def parse_test_content(question_text: str, title: str = "") -> list[dict]:
    """
    Единый парсер. Распознает строки-вопросы (нумерованные, с бланками, с ?)
    и строки-варианты. Мультивопросные тексты разбиваются на отдельные вопросы.
    """
    text = question_text.strip()
    if not text:
        return []

    lines = text.split('\n')
    questions = []
    current_q = None
    current_options = []

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped == '✔️':
            continue

        # Проверяем: это начало нового вопроса?
        new_question = False
        q_text = stripped

        # Нумерованный вопрос: "1. Text" или "1."
        m = re.match(r'^(\d+)\.\s*(.*)', stripped)
        if m:
            new_question = True
            q_text = m.group(2).strip()
        # Строка с бланками (..... или ____)
        elif '.....' in stripped or '____' in stripped:
            new_question = True
        # Строка заканчивается на ? (но не является вариантом типа "a Are you?")
        elif stripped.endswith('?') and not re.match(r'^[a-dA-D][)\s]', stripped):
            new_question = True

        if new_question:
            # Сохраняем предыдущий вопрос
            if current_q is not None:
                questions.append({
                    "question": current_q,
                    "options": current_options,
                })
            current_q = q_text
            current_options = []
        elif current_q is not None:
            # Вариант ответа
            opt_text = strip_option_prefix(stripped)
            if opt_text:
                current_options.append(make_option(opt_text))
        else:
            # Строка до первого вопроса — пропускаем (или первая строка = вопрос)
            # Если есть варианты с a/b префиксами после, то это вопрос
            current_q = stripped
            current_options = []

    # Сохраняем последний вопрос
    if current_q is not None:
        questions.append({
            "question": current_q,
            "options": current_options,
        })

    # Пост-обработка: разбиваем раздутые вопросы (>6 вариантов)
    # Эвристика: если среди "вариантов" есть длинные строки, они скорее всего вопросы
    refined = []
    for q in questions:
        if len(q["options"]) <= 6:
            refined.append(q)
            continue

        # Пробуем пересплитить по длине строк
        # Длинная строка (значительно длиннее средней опции) = новый вопрос
        opt_texts = [o["text"] for o in q["options"]]
        avg_len = sum(len(t) for t in opt_texts) / len(opt_texts) if opt_texts else 0

        sub_questions = []
        sub_q = q["question"]
        sub_opts = []

        for opt in q["options"]:
            text = opt["text"]
            # Строка похожа на новый вопрос: длиннее среднего в 2+ раза И > 15 символов
            if len(text) > max(avg_len * 1.8, 15) and sub_opts:
                sub_questions.append({"question": sub_q, "options": sub_opts})
                sub_q = text
                sub_opts = []
            else:
                sub_opts.append(opt)

        if sub_q:
            sub_questions.append({"question": sub_q, "options": sub_opts})

        # Если удалось разбить — используем результат
        if len(sub_questions) > 1 and all(sq["options"] for sq in sub_questions):
            refined.extend(sub_questions)
        else:
            refined.append(q)

    questions = refined

    # Если парсер нашёл вопросы с вариантами — возвращаем
    if questions and any(q["options"] for q in questions):
        return questions

    # Fallback: title как вопрос, все строки как варианты
    all_lines = [l.strip() for l in lines if l.strip() and l.strip() != '✔️']
    if all_lines:
        options = [make_option(strip_option_prefix(l)) for l in all_lines if strip_option_prefix(l)]
        question = title or "Choose the correct answer"
        return [{"question": question, "options": options}]

    return []


async def fix_test_blocks(dry_run: bool = False):
    """Основная функция исправления."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'test')
            .order_by(ExerciseBlock.lesson_id, ExerciseBlock.position)
        )
        blocks = result.scalars().all()

        print(f"\n{'=' * 80}")
        print(f"ИСПРАВЛЕНИЕ TEST БЛОКОВ {'(DRY RUN)' if dry_run else ''}")
        print(f"{'=' * 80}")
        print(f"Найдено блоков: {len(blocks)}\n")

        stats = {
            "single_ok": 0,        # Один вопрос, успешно распарсен
            "multi_split": 0,       # Мультивопрос, разбит на N блоков
            "new_blocks": 0,        # Кол-во новых блоков от разбиения
            "garbage_to_text": 0,   # Конвертировано в text
            "no_options": 0,        # Распарсен, но без вариантов (title only)
            "errors": 0,
        }

        new_blocks_to_insert = []

        for block in blocks:
            question_text = block.content.get("question", "")
            existing_options = block.content.get("options", [])

            # Пропускаем уже исправленные (с непустыми options)
            if existing_options:
                stats["single_ok"] += 1
                continue

            # Мусор → конвертируем в text
            if is_garbage(question_text):
                if not dry_run:
                    block.block_type = "text"
                    block.content = {"html": f"<p>{question_text}</p>"}
                stats["garbage_to_text"] += 1
                print(f"  [GARBAGE→TEXT] Block #{block.id}: {repr(question_text[:50])}")
                continue

            try:
                parsed = parse_test_content(question_text, block.title or "")
            except Exception as e:
                print(f"  [ERROR] Block #{block.id}: {e}")
                stats["errors"] += 1
                continue

            if not parsed:
                print(f"  [EMPTY] Block #{block.id}: не удалось распарсить")
                stats["errors"] += 1
                continue

            # Фильтруем вопросы без вариантов
            parsed = [q for q in parsed if q["options"]]

            if not parsed:
                # Нет вариантов — оставляем question как есть, добавляем пустую структуру
                if not dry_run:
                    block.content = {
                        "question": question_text,
                        "options": [],
                        "multiple_answers": False,
                        "explanation": "",
                    }
                stats["no_options"] += 1
                continue

            # Обновляем первый вопрос в текущем блоке
            first_q = parsed[0]
            if not dry_run:
                block.content = {
                    "question": first_q["question"],
                    "options": first_q["options"],
                    "multiple_answers": False,
                    "explanation": "",
                }

            if len(parsed) == 1:
                stats["single_ok"] += 1
            else:
                stats["multi_split"] += 1
                # Создаём дополнительные блоки для остальных вопросов
                for i, q in enumerate(parsed[1:], 1):
                    new_block_data = {
                        "lesson_id": block.lesson_id,
                        "block_type": "test",
                        "title": block.title,
                        "content": {
                            "question": q["question"],
                            "options": q["options"],
                            "multiple_answers": False,
                            "explanation": "",
                        },
                        # Позиция: между текущим и следующим блоком
                        "position": block.position + i,
                    }
                    new_blocks_to_insert.append(new_block_data)
                    stats["new_blocks"] += 1

        # Вставляем новые блоки
        if new_blocks_to_insert and not dry_run:
            # Сначала сдвигаем позиции существующих блоков чтобы не было коллизий
            # Группируем новые блоки по lesson_id
            from collections import defaultdict
            by_lesson = defaultdict(list)
            for nb in new_blocks_to_insert:
                by_lesson[nb["lesson_id"]].append(nb)

            for lesson_id, new_blocks in by_lesson.items():
                # Получаем все блоки урока для пересчёта позиций
                res = await db.execute(
                    select(ExerciseBlock)
                    .where(ExerciseBlock.lesson_id == lesson_id)
                    .order_by(ExerciseBlock.position, ExerciseBlock.id)
                )
                lesson_blocks = list(res.scalars().all())

                # Собираем итоговый порядок: оригинальные блоки + новые после соответствующих
                # Для простоты — вставляем все новые блоки и пересчитываем позиции
                for nb in new_blocks:
                    new_eb = ExerciseBlock(
                        lesson_id=nb["lesson_id"],
                        block_type=nb["block_type"],
                        title=nb["title"],
                        content=nb["content"],
                        position=nb["position"],
                    )
                    db.add(new_eb)

            # Пересчитаем позиции после коммита
            await db.flush()

            # Пересчёт позиций для каждого урока с новыми блоками
            for lesson_id in by_lesson.keys():
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
        print(f"  Один вопрос (OK):          {stats['single_ok']}")
        print(f"  Мультивопрос (разбит):     {stats['multi_split']}")
        print(f"  Новых блоков создано:      {stats['new_blocks']}")
        print(f"  Мусор → text:              {stats['garbage_to_text']}")
        print(f"  Без вариантов:             {stats['no_options']}")
        print(f"  Ошибок:                    {stats['errors']}")
        print(f"{'=' * 80}")

        # Показываем примеры
        if not dry_run:
            res = await db.execute(
                select(ExerciseBlock)
                .where(ExerciseBlock.block_type == 'test')
                .where(func.jsonb_array_length(ExerciseBlock.content['options']) > 0)
                .limit(3)
            )
            examples = res.scalars().all()
            if examples:
                print(f"\nПримеры исправленных блоков:")
                for ex in examples:
                    print(f"\n  Block #{ex.id}:")
                    print(f"    Question: {ex.content['question'][:80]}")
                    print(f"    Options: {len(ex.content['options'])} шт.")
                    for opt in ex.content['options'][:3]:
                        print(f"      - {opt['text'][:60]}")


if __name__ == "__main__":
    dry_run = "--dry-run" in sys.argv
    asyncio.run(fix_test_blocks(dry_run=dry_run))
