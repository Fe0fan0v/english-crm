"""
Диагностика TEXT блоков в БД.
Ищет скрытый интерактивный контент, который был ошибочно сохранён как text.
"""
import asyncio
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select, func
from app.database import async_session_maker
from app.models.course import ExerciseBlock, InteractiveLesson, CourseTopic, CourseSection


# === Паттерны для обнаружения скрытого интерактивного контента ===

PATTERNS = {
    "fill_gaps": {
        "description": "Fill gaps (поля ввода для пропусков)",
        "markers": [
            ("listofintputs=", "атрибут listofintputs"),
            ("rightanswers=", "атрибут rightanswers"),
            ("exercise-answer-input", "CSS класс exercise-answer-input"),
            ("exercise-input-correct-form-word", "CSS класс exercise-input-correct-form-word"),
        ]
    },
    "matching": {
        "description": "Matching (сопоставление пар)",
        "markers": [
            ("matching_exercise", "CSS класс matching_exercise"),
            ("match-item", "CSS класс match-item"),
            ("drag-drop-match", "CSS класс drag-drop-match"),
            ("connect-pairs", "CSS класс connect-pairs"),
        ]
    },
    "word_order": {
        "description": "Word Order (составление предложений)",
        "markers": [
            ("sorting_wrapper", "CSS класс sorting_wrapper"),
            ("word-order", "CSS класс word-order"),
            ("sentence-order", "CSS класс sentence-order"),
            ("sortable", "CSS класс sortable"),
        ]
    },
    "draggable_generic": {
        "description": "Draggable элементы (matching или word_order)",
        "markers": [
            ('draggable="true"', "атрибут draggable=true"),
            ("draggable-item", "CSS класс draggable-item"),
            ("drag-container", "CSS класс drag-container"),
            ("drop-zone", "CSS класс drop-zone"),
            ("drop-target", "CSS класс drop-target"),
        ]
    },
    "essay": {
        "description": "Essay (свободный текст)",
        "markers": [
            ("exercise-essay", "CSS класс exercise-essay"),
            ("html-editor", "CSS класс html-editor"),
            ('contenteditable="true"', "атрибут contenteditable"),
            ("text-editor", "CSS класс text-editor"),
            ("writing-area", "CSS класс writing-area"),
        ]
    },
    "flashcards": {
        "description": "Flashcards (карточки)",
        "markers": [
            ("flashcard", "слово flashcard"),
            ("card-flip", "CSS класс card-flip"),
            ("flip-card", "CSS класс flip-card"),
        ]
    },
    "test_quiz": {
        "description": "Test/Quiz (тест с вариантами)",
        "markers": [
            ("tir-radio", "CSS класс tir-radio"),
            ("radio-group", "CSS класс radio-group"),
            ('<input type="radio"', "radio input"),
            ('<input type="checkbox"', "checkbox input"),
            ("exercise-test", "CSS класс exercise-test"),
            ("quiz-option", "CSS класс quiz-option"),
        ]
    },
    "true_false": {
        "description": "True/False",
        "markers": [
            ("true-false", "CSS класс true-false"),
            ("true_false", "CSS класс true_false"),
        ]
    },
    "wordwall_iframe": {
        "description": "Wordwall iframe (внешняя игра)",
        "markers": [
            ("wordwall.net", "ссылка на wordwall.net"),
            ("wordwall.com", "ссылка на wordwall.com"),
            ("wordwall", "упоминание wordwall"),
        ]
    },
    "external_iframe": {
        "description": "Внешний iframe",
        "markers": [
            ("<iframe", "тег iframe"),
        ]
    },
    "input_fields": {
        "description": "Поля ввода (потенциально fill_gaps или другое)",
        "markers": [
            ('<input type="text"', "text input"),
            ("<input ", "тег input"),
            ("<textarea", "тег textarea"),
        ]
    },
    "table_content": {
        "description": "Таблица (потенциально table блок)",
        "markers": [
            ("<table", "тег table"),
        ]
    },
}


def analyze_content(content: dict) -> list[dict]:
    """Анализирует content блока и возвращает найденные паттерны."""
    findings = []

    # Собираем весь текст из content
    text_parts = []
    if isinstance(content, dict):
        for key, value in content.items():
            if isinstance(value, str):
                text_parts.append(value)
            elif isinstance(value, dict):
                text_parts.extend(str(v) for v in value.values() if isinstance(v, str))

    full_text = " ".join(text_parts).lower()

    for pattern_name, pattern_info in PATTERNS.items():
        for marker, marker_desc in pattern_info["markers"]:
            if marker.lower() in full_text:
                findings.append({
                    "pattern": pattern_name,
                    "description": pattern_info["description"],
                    "marker": marker,
                    "marker_desc": marker_desc,
                })
                break  # Одного совпадения достаточно для паттерна

    return findings


async def diagnose():
    """Основная диагностика."""
    async with async_session_maker() as db:
        # 1. Общая статистика по типам блоков
        print("=" * 80)
        print("ДИАГНОСТИКА БЛОКОВ КУРСОВ")
        print("=" * 80)

        result = await db.execute(
            select(ExerciseBlock.block_type, func.count())
            .group_by(ExerciseBlock.block_type)
            .order_by(func.count().desc())
        )
        type_counts = result.all()

        print("\n1. СТАТИСТИКА ПО ТИПАМ БЛОКОВ:")
        print("-" * 40)
        total = 0
        for block_type, count in type_counts:
            print(f"  {block_type:<20} {count:>6}")
            total += count
        print(f"  {'ИТОГО':<20} {total:>6}")

        # 2. Анализ TEXT блоков
        print("\n\n2. АНАЛИЗ TEXT БЛОКОВ:")
        print("-" * 80)

        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'text')
        )
        text_blocks = result.scalars().all()
        print(f"  Всего TEXT блоков: {len(text_blocks)}")

        # Категоризация
        findings_by_pattern = defaultdict(list)
        blocks_with_html = 0
        blocks_with_long_html = 0
        blocks_empty = 0

        for block in text_blocks:
            content = block.content

            # Проверяем наличие HTML
            html_content = content.get("html", "")
            text_content = content.get("text", "")
            full_content = html_content or text_content or str(content)

            if not full_content.strip():
                blocks_empty += 1
                continue

            if "<" in full_content and ">" in full_content:
                blocks_with_html += 1
                if len(full_content) > 500:
                    blocks_with_long_html += 1

            findings = analyze_content(content)
            for finding in findings:
                findings_by_pattern[finding["pattern"]].append({
                    "block_id": block.id,
                    "title": block.title,
                    "lesson_id": block.lesson_id,
                    "content_preview": full_content[:200],
                })

        print(f"  С HTML содержимым: {blocks_with_html}")
        print(f"  С длинным HTML (>500): {blocks_with_long_html}")
        print(f"  Пустые: {blocks_empty}")

        # 3. Результаты по паттернам
        print("\n\n3. ОБНАРУЖЕННЫЕ СКРЫТЫЕ ИНТЕРАКТИВНЫЕ ЭЛЕМЕНТЫ:")
        print("=" * 80)

        total_hidden = 0
        for pattern_name, blocks in sorted(
            findings_by_pattern.items(), key=lambda x: -len(x[1])
        ):
            info = PATTERNS[pattern_name]
            count = len(blocks)
            total_hidden += count
            print(f"\n  [{info['description']}] — {count} блоков")
            print(f"  " + "-" * 60)

            # Показываем примеры (до 3)
            for block_info in blocks[:3]:
                preview = block_info["content_preview"]
                # Обрезаем длинные HTML
                if len(preview) > 120:
                    preview = preview[:120] + "..."
                # Убираем переносы строк
                preview = preview.replace("\n", " ").replace("\r", "")
                print(f"    Block #{block_info['block_id']} | "
                      f"Lesson #{block_info['lesson_id']} | "
                      f"Title: {block_info['title'] or '(нет)'}")
                print(f"      Preview: {preview}")

            if count > 3:
                print(f"    ... и ещё {count - 3}")

        if not findings_by_pattern:
            print("\n  Скрытых интерактивных элементов НЕ ОБНАРУЖЕНО")

        # 4. Анализ REMEMBER и TEACHING_GUIDE блоков (тоже могут содержать интерактив)
        print("\n\n4. ПРОВЕРКА REMEMBER/TEACHING_GUIDE БЛОКОВ:")
        print("-" * 80)

        for check_type in ['remember', 'teaching_guide']:
            result = await db.execute(
                select(ExerciseBlock)
                .where(ExerciseBlock.block_type == check_type)
            )
            check_blocks = result.scalars().all()

            interactive_count = 0
            for block in check_blocks:
                findings = analyze_content(block.content)
                if findings:
                    interactive_count += 1

            print(f"  {check_type}: {len(check_blocks)} блоков, "
                  f"из них с интерактивом: {interactive_count}")

        # 5. Анализ content структуры TEXT блоков
        print("\n\n5. СТРУКТУРА CONTENT В TEXT БЛОКАХ:")
        print("-" * 80)

        content_keys_stats = defaultdict(int)
        for block in text_blocks:
            keys = tuple(sorted(block.content.keys()))
            content_keys_stats[keys] += 1

        for keys, count in sorted(content_keys_stats.items(), key=lambda x: -x[1]):
            print(f"  {dict.fromkeys(keys, '...')} — {count} блоков")

        # 6. Анализ fill_gaps — проверяем правильность формата
        print("\n\n6. ПРОВЕРКА FILL_GAPS БЛОКОВ:")
        print("-" * 80)

        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'fill_gaps')
        )
        fg_blocks = result.scalars().all()
        fg_ok = 0
        fg_has_html = 0
        fg_no_gaps = 0
        fg_empty = 0

        for block in fg_blocks:
            if 'html' in block.content:
                fg_has_html += 1
            elif 'gaps' in block.content and block.content['gaps']:
                fg_ok += 1
            elif 'text' in block.content and not block.content.get('gaps'):
                fg_no_gaps += 1
            else:
                fg_empty += 1

        print(f"  Всего fill_gaps: {len(fg_blocks)}")
        print(f"  Корректных (text+gaps): {fg_ok}")
        print(f"  С HTML (не исправлены): {fg_has_html}")
        print(f"  Без gaps (text только): {fg_no_gaps}")
        print(f"  Пустых: {fg_empty}")

        # 7. Анализ test блоков — проверяем правильность формата
        print("\n\n7. ПРОВЕРКА TEST БЛОКОВ:")
        print("-" * 80)

        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'test')
        )
        test_blocks = result.scalars().all()
        test_ok = 0
        test_no_options = 0
        test_has_html = 0

        for block in test_blocks:
            if 'options' in block.content and block.content['options']:
                test_ok += 1
            elif 'html' in block.content:
                test_has_html += 1
            else:
                test_no_options += 1

        print(f"  Всего test: {len(test_blocks)}")
        print(f"  Корректных (с options): {test_ok}")
        print(f"  С HTML (не исправлены): {test_has_html}")
        print(f"  Без options: {test_no_options}")

        # 8. Анализ matching блоков
        print("\n\n8. ПРОВЕРКА MATCHING БЛОКОВ:")
        print("-" * 80)

        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'matching')
        )
        matching_blocks = result.scalars().all()
        match_ok = 0
        match_has_html = 0
        match_no_pairs = 0

        for block in matching_blocks:
            if 'pairs' in block.content and block.content['pairs']:
                match_ok += 1
            elif 'html' in block.content:
                match_has_html += 1
            else:
                match_no_pairs += 1

        print(f"  Всего matching: {len(matching_blocks)}")
        print(f"  Корректных (с pairs): {match_ok}")
        print(f"  С HTML (не распарсены): {match_has_html}")
        print(f"  Без pairs: {match_no_pairs}")

        # 9. Аналогично для word_order
        print("\n\n9. ПРОВЕРКА WORD_ORDER БЛОКОВ:")
        print("-" * 80)

        result = await db.execute(
            select(ExerciseBlock)
            .where(ExerciseBlock.block_type == 'word_order')
        )
        wo_blocks = result.scalars().all()
        wo_ok = 0
        wo_has_html = 0
        wo_no_sentences = 0

        for block in wo_blocks:
            if 'sentences' in block.content and block.content['sentences']:
                wo_ok += 1
            elif 'html' in block.content:
                wo_has_html += 1
            else:
                wo_no_sentences += 1

        print(f"  Всего word_order: {len(wo_blocks)}")
        print(f"  Корректных (с sentences): {wo_ok}")
        print(f"  С HTML (не распарсены): {wo_has_html}")
        print(f"  Без sentences: {wo_no_sentences}")

        # 10. Итоговая сводка
        print("\n\n" + "=" * 80)
        print("ИТОГО:")
        print("=" * 80)
        print(f"  Всего блоков: {total}")
        print(f"  TEXT блоков с потенциальным интерактивом: {total_hidden}")

        # Уникальные блоки (один блок мог попасть в несколько паттернов)
        unique_ids = set()
        for blocks in findings_by_pattern.values():
            for b in blocks:
                unique_ids.add(b["block_id"])
        print(f"  Уникальных TEXT блоков с интерактивом: {len(unique_ids)}")

        # Блоки с неправильным форматом
        broken = fg_has_html + fg_no_gaps + test_no_options + match_has_html + match_no_pairs + wo_has_html + wo_no_sentences
        print(f"  Блоков с неправильным форматом данных: {broken}")
        print()


if __name__ == "__main__":
    asyncio.run(diagnose())
