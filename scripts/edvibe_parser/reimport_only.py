"""
Только импорт всех уровней English File 4th
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from import_single_level import import_level


async def main():
    # В Docker контейнере используем /app/lessons
    output_dir = Path("/app/lessons") if Path("/app/lessons").exists() else Path(__file__).parent / "output"

    # Список уровней для импорта (в правильном порядке)
    levels = [
        ("jsi_hierarchy_Beginner_20260203_211912.json", "Beginner"),
        ("jsi_hierarchy_Elementary_20260204_083449.json", "Elementary"),
        ("jsi_hierarchy_Pre-Intermediate_20260204_091954.json", "Pre-Intermediate"),
        ("jsi_hierarchy_Intermediate_20260204_105126.json", "Intermediate"),
        ("jsi_hierarchy_Intermediate_Plus_20260204_132846.json", "Intermediate Plus"),
        ("jsi_hierarchy_Upper-Intermediate_20260204_140503.json", "Upper-Intermediate"),
        ("jsi_hierarchy_Advanced_20260204_143514.json", "Advanced"),
    ]

    print(f"Importing levels from: {output_dir}\n")

    for filename, section_title in levels:
        filepath = output_dir / filename
        if not filepath.exists():
            print(f"⚠️  File not found: {filename}")
            continue

        print(f"\nImporting: {section_title} from {filename}")
        try:
            await import_level(str(filepath), section_title)
            print(f"✅ {section_title} imported successfully!")
        except Exception as e:
            print(f"❌ Error importing {section_title}: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*60)
    print("✅ All levels imported!")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
