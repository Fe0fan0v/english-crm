"""
Переимпорт обновлённых JSON файлов (reanalyzed) в БД
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from sqlalchemy import select, delete
from app.database import async_session_maker
from app.models.course import CourseSection, CourseTopic, InteractiveLesson, ExerciseBlock
from import_single_level import import_level


async def delete_old_data():
    """Удаление старых уроков и блоков курса English File 4th (ID: 10)"""
    print("\n" + "="*60)
    print("Удаление старых данных...")
    print("="*60)

    async with async_session_maker() as db:
        # Получаем все секции курса 10
        result = await db.execute(
            select(CourseSection).where(CourseSection.course_id == 10)
        )
        sections = result.scalars().all()

        total_lessons = 0
        total_blocks = 0

        for section in sections:
            # Получаем топики секции
            result = await db.execute(
                select(CourseTopic).where(CourseTopic.section_id == section.id)
            )
            topics = result.scalars().all()

            for topic in topics:
                # Получаем уроки топика
                result = await db.execute(
                    select(InteractiveLesson).where(InteractiveLesson.topic_id == topic.id)
                )
                lessons = result.scalars().all()

                for lesson in lessons:
                    # Удаляем блоки урока
                    result = await db.execute(
                        delete(ExerciseBlock).where(ExerciseBlock.lesson_id == lesson.id)
                    )
                    total_blocks += result.rowcount

                # Удаляем уроки
                result = await db.execute(
                    delete(InteractiveLesson).where(InteractiveLesson.topic_id == topic.id)
                )
                total_lessons += result.rowcount

            # Удаляем топики
            await db.execute(
                delete(CourseTopic).where(CourseTopic.section_id == section.id)
            )

        # Удаляем секции
        await db.execute(
            delete(CourseSection).where(CourseSection.course_id == 10)
        )

        await db.commit()

        print(f"Удалено:")
        print(f"  Секций: {len(sections)}")
        print(f"  Уроков: {total_lessons}")
        print(f"  Блоков: {total_blocks}")


async def import_all_reanalyzed():
    """Импорт всех обновлённых уровней"""
    output_dir = Path("/app/lessons") if Path("/app/lessons").exists() else Path(__file__).parent / "output"

    # Список обновлённых файлов для импорта
    levels = [
        ("reanalyzed_jsi_hierarchy_Beginner_20260203_211912.json", "Beginner"),
        ("reanalyzed_jsi_hierarchy_Elementary_20260204_083449.json", "Elementary"),
        ("reanalyzed_jsi_hierarchy_Pre-Intermediate_20260204_091954.json", "Pre-Intermediate"),
        ("reanalyzed_jsi_hierarchy_Intermediate_20260204_105126.json", "Intermediate"),
        ("reanalyzed_jsi_hierarchy_Intermediate_Plus_20260204_132846.json", "Intermediate Plus"),
        ("reanalyzed_jsi_hierarchy_Upper-Intermediate_20260204_140503.json", "Upper-Intermediate"),
        ("reanalyzed_jsi_hierarchy_Advanced_20260204_143514.json", "Advanced"),
    ]

    print(f"\nИмпорт из: {output_dir}\n")

    for filename, section_title in levels:
        filepath = output_dir / filename
        if not filepath.exists():
            print(f"[WARN] Файл не найден: {filename}")
            continue

        print(f"\n{'='*60}")
        print(f"Импорт: {section_title}")
        print(f"{'='*60}")

        try:
            await import_level(str(filepath), section_title)
            print(f"[OK] {section_title} импортирован!")
        except Exception as e:
            print(f"[ERROR] Ошибка импорта {section_title}: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "="*60)
    print("[OK] Все уровни переимпортированы!")
    print("="*60)


async def main():
    """Основная функция"""
    print("\n" + "="*60)
    print("ПЕРЕИМПОРТ ОБНОВЛЁННЫХ JSON ФАЙЛОВ")
    print("="*60)

    # Шаг 1: Удаление старых данных
    await delete_old_data()

    # Шаг 2: Импорт обновлённых данных
    await import_all_reanalyzed()


if __name__ == "__main__":
    asyncio.run(main())
