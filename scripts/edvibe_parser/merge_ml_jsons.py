"""
Объединение JSON файлов Market Leader в один
"""
import json
import argparse
from pathlib import Path
from datetime import datetime

def merge_ml_files(level_name):
    output_dir = Path(__file__).parent / "output"

    # Находим все файлы текущего парсинга
    pattern = f"jsi_ml_{level_name.replace(' ', '-')}_sec*_20260208_*.json"
    files = sorted(output_dir.glob(pattern))

    print(f"Found {len(files)} files to merge:")
    for f in files:
        print(f"  - {f.name}")

    if len(files) == 0:
        print("No files found!")
        return

    # Загружаем все файлы
    all_lessons = []
    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            lessons = data.get("sections", [{}])[0].get("lessons", [])
            print(f"\n{file_path.name}: {len(lessons)} lessons")
            all_lessons.extend(lessons)

    # Создаём объединённый файл
    merged = {
        "course_name": "Business English Market Leader",
        "sections": [
            {
                "title": level_name,
                "description": f"Business English Market Leader - {level_name}",
                "position": 1,
                "lessons": all_lessons
            }
        ]
    }

    # Статистика
    total_blocks = sum(len(l.get("blocks", [])) for l in all_lessons)
    print(f"\n{'='*60}")
    print(f"MERGED RESULT:")
    print(f"  Total lessons: {len(all_lessons)}")
    print(f"  Total blocks: {total_blocks}")
    print(f"{'='*60}")

    # Сохраняем
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = output_dir / f"jsi_hierarchy_{level_name.replace(' ', '_')}_MERGED_{timestamp}.json"

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(merged, f, indent=2, ensure_ascii=False)

    print(f"\nSAVED: {output_file.name}")
    print(f"Size: {output_file.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge Market Leader JSON files by level")
    parser.add_argument("--level", required=True, help="Level name (e.g., 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate')")
    args = parser.parse_args()

    merge_ml_files(args.level)
