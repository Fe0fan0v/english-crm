"""
Объединение всех уровней Market Leader в один курс
"""
import json
from pathlib import Path
from datetime import datetime

def merge_all_levels():
    output_dir = Path(__file__).parent / "output"

    # Находим последние MERGED файлы для каждого уровня
    levels = [
        "Pre-Intermediate_MERGED",
        "Intermediate_MERGED",
        "Upper-Intermediate_MERGED"
    ]

    all_sections = []
    total_lessons = 0
    total_blocks = 0

    for position, level_pattern in enumerate(levels, 1):
        # Ищем последний файл для уровня
        pattern = f"jsi_hierarchy_{level_pattern}_*.json"
        files = sorted(output_dir.glob(pattern), reverse=True)

        if files:
            file_path = files[0]
            print(f"\n{level_pattern}:")
            print(f"  Loading: {file_path.name}")

            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                section = data["sections"][0]
                section["position"] = position

                lessons_count = len(section.get("lessons", []))
                blocks_count = sum(len(l.get("blocks", [])) for l in section.get("lessons", []))

                print(f"  Lessons: {lessons_count}")
                print(f"  Blocks: {blocks_count}")

                all_sections.append(section)
                total_lessons += lessons_count
                total_blocks += blocks_count
        else:
            print(f"\n[WARN] No file found for {level_pattern}")

    # Создаём итоговый файл
    merged = {
        "course_name": "Business English Market Leader",
        "sections": all_sections
    }

    print(f"\n{'='*60}")
    print(f"FINAL MERGED RESULT:")
    print(f"  Total sections: {len(all_sections)}")
    print(f"  Total lessons: {total_lessons}")
    print(f"  Total blocks: {total_blocks}")
    print(f"{'='*60}")

    # Сохраняем
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = output_dir / f"jsi_hierarchy_Market_Leader_ALL_LEVELS_{timestamp}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    print(f"\nSAVED: {output_file.name}")
    print(f"Size: {output_file.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    merge_all_levels()
