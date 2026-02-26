"""
Переанализ типов блоков в существующих JSON файлах
Применяет улучшенную универсальную логику определения типов
"""
import json
from pathlib import Path
from collections import Counter
from typing import Dict, Any


def analyze_block_type(block: Dict[str, Any]) -> str:
    """
    Универсальное определение типа блока на основе анализа контента
    (копия логики из parser.py)
    """
    current_type = block.get('block_type', 'text')
    content = block.get('content', {})
    title = block.get('title', '').lower()

    # Получаем HTML и текст для анализа
    html_content = ""
    text_content = ""

    if isinstance(content, dict):
        html_content = content.get('html', '')
        text_content = content.get('text', '')
    elif isinstance(content, str):
        text_content = content
        html_content = content

    # Не перезаписываем явные типы медиа-контента
    if current_type in ['image', 'video', 'audio']:
        return current_type

    # Не перезаписываем teaching_guide и remember (они уже правильные)
    if current_type in ['teaching_guide', 'remember']:
        return current_type

    # === УНИВЕРСАЛЬНОЕ ОПРЕДЕЛЕНИЕ ТИПА ===

    # Проверка 1: Fill gaps - есть поля ввода
    if ('listofintputs=' in html_content or
        'exercise-answer-input' in html_content or
        'exercise-input-correct-form-word' in html_content or
        ('<input' in html_content and ('complete' in title or
                                        'fill' in title or
                                        'write' in title or
                                        'gap' in title))):
        return 'fill_gaps'

    # Проверка 2: Matching/Word Order - есть draggable элементы
    if 'draggable' in html_content or 'sorting_wrapper' in html_content:
        # Определяем по заголовку
        if 'match' in title or 'pair' in title:
            return 'matching'
        elif 'order' in title or 'arrange' in title or 'sentence' in title:
            return 'word_order'
        else:
            return 'matching'  # По умолчанию

    # Проверка 3: Essay/Writing - есть текстовый редактор
    if ('exercise-essay' in html_content or
        'html-editor' in html_content or
        'contenteditable="true"' in html_content):
        return 'essay'

    # Проверка 4: Test/Quiz - есть radio buttons или checkboxes
    if (('tir-radio' in html_content or 'radio-group' in html_content or
         '<input type="radio"' in html_content or '<input type="checkbox"' in html_content) and
        ('exercise-test' in html_content or 'quiz' in html_content or
         'choose' in title or 'select' in title)):
        return 'test'

    # Проверка 5: True/False - ключевые слова
    if ('true' in title and 'false' in title) or 'правда' in title or 'ложь' in title:
        return 'true_false'

    # Проверка 6: Flashcards - карточки
    if ('flashcard' in html_content or 'card-flip' in html_content or
        ('card' in html_content and 'vocabulary' in title)):
        return 'flashcards'

    # Проверка 7: Image choice - множественные изображения + выбор
    if (html_content.count('<img') >= 3 and
        ('choose' in title or 'select' in title or 'which' in title)):
        return 'image_choice'

    # Оставляем текущий тип если ничего не подошло
    return current_type


def reanalyze_json_file(input_file: Path, output_file: Path = None) -> Dict[str, Any]:
    """Переанализ одного JSON файла"""

    if output_file is None:
        output_file = input_file.parent / f"reanalyzed_{input_file.name}"

    print(f"\n{'='*60}")
    print(f"Обработка: {input_file.name}")
    print(f"{'='*60}")

    # Загружаем JSON
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Статистика
    total_blocks = 0
    changed_blocks = 0
    type_changes = []
    old_types = Counter()
    new_types = Counter()

    # Обрабатываем все блоки
    for section in data.get('sections', []):
        for lesson in section.get('lessons', []):
            for block in lesson.get('blocks', []):
                total_blocks += 1
                old_type = block.get('block_type', 'text')
                old_types[old_type] += 1

                # Применяем новую логику
                new_type = analyze_block_type(block)
                new_types[new_type] += 1

                if new_type != old_type:
                    changed_blocks += 1
                    type_changes.append({
                        'lesson': lesson.get('title', 'Unknown'),
                        'old_type': old_type,
                        'new_type': new_type,
                        'title': block.get('title', '')[:50]
                    })
                    block['block_type'] = new_type

    # Сохраняем обновлённый JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Выводим статистику
    print(f"\nВсего блоков: {total_blocks}")
    print(f"Изменено: {changed_blocks} ({changed_blocks/total_blocks*100:.1f}%)")

    print("\n--- Старые типы ---")
    for block_type, count in old_types.most_common():
        print(f"{block_type:20} - {count:4} шт.")

    print("\n--- Новые типы ---")
    for block_type, count in new_types.most_common():
        print(f"{block_type:20} - {count:4} шт.")

    if type_changes:
        print(f"\n--- Примеры изменений (первые 10) ---")
        for i, change in enumerate(type_changes[:10], 1):
            print(f"{i}. [{change['old_type']} -> {change['new_type']}] {change['title']}")
            print(f"   Урок: {change['lesson']}")

    print(f"\n[OK] Сохранено: {output_file}")

    return {
        'total_blocks': total_blocks,
        'changed_blocks': changed_blocks,
        'old_types': dict(old_types),
        'new_types': dict(new_types),
        'changes': type_changes
    }


def main():
    """Обработка всех JSON файлов уровней"""
    output_dir = Path(__file__).parent / "output"

    # Список файлов для обработки
    files_to_process = [
        "jsi_hierarchy_Beginner_20260203_211912.json",
        "jsi_hierarchy_Elementary_20260204_083449.json",
        "jsi_hierarchy_Pre-Intermediate_20260204_091954.json",
        "jsi_hierarchy_Intermediate_20260204_105126.json",
        "jsi_hierarchy_Intermediate_Plus_20260204_132846.json",
        "jsi_hierarchy_Upper-Intermediate_20260204_140503.json",
        "jsi_hierarchy_Advanced_20260204_143514.json",
    ]

    total_stats = {
        'total_blocks': 0,
        'changed_blocks': 0,
        'old_types': Counter(),
        'new_types': Counter()
    }

    for filename in files_to_process:
        input_file = output_dir / filename
        if not input_file.exists():
            print(f"[WARN]  Файл не найден: {filename}")
            continue

        stats = reanalyze_json_file(input_file)

        # Обновляем общую статистику
        total_stats['total_blocks'] += stats['total_blocks']
        total_stats['changed_blocks'] += stats['changed_blocks']
        for block_type, count in stats['old_types'].items():
            total_stats['old_types'][block_type] += count
        for block_type, count in stats['new_types'].items():
            total_stats['new_types'][block_type] += count

    # Итоговая статистика
    print("\n" + "="*60)
    print("ИТОГОВАЯ СТАТИСТИКА ПО ВСЕМ УРОВНЯМ")
    print("="*60)
    print(f"\nВсего блоков: {total_stats['total_blocks']}")
    print(f"Изменено: {total_stats['changed_blocks']} ({total_stats['changed_blocks']/total_stats['total_blocks']*100:.1f}%)")

    print("\n--- Было ---")
    for block_type, count in total_stats['old_types'].most_common():
        print(f"{block_type:20} - {count:4} шт.")

    print("\n--- Стало ---")
    for block_type, count in total_stats['new_types'].most_common():
        print(f"{block_type:20} - {count:4} шт.")

    print("\n[OK] Переанализ завершён!")
    print("Обновлённые файлы сохранены с префиксом 'reanalyzed_'")


if __name__ == "__main__":
    main()
