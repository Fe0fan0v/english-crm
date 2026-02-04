"""
Исправление и переимпорт всех курсов Edvibe.

Проблема: все блоки импортированы как type='text' вместо правильных типов
(image, audio, remember, fill_gaps и т.д.)

Причина: скрипты импорта использовали block_data.get('type') вместо
block_data.get('block_type')

Решение:
1. Удалить все существующие блоки и уроки
2. Переимпортировать все курсы с исправленными скриптами

Использование:
    # Проверка что будет удалено (dry run)
    python fix_and_reimport.py --dry-run

    # Удаление и переимпорт
    python fix_and_reimport.py --reimport
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.course import (
    Course, CourseSection, CourseTopic, InteractiveLesson, ExerciseBlock
)

# Импортируем скрипт импорта
from import_single_level import import_level


async def check_current_state():
    """Проверка текущего состояния БД"""
    print("\n" + "="*60)
    print("ТЕКУЩЕЕ СОСТОЯНИЕ БД")
    print("="*60 + "\n")

    async with async_session_maker() as db:
        # Курсы
        result = await db.execute(select(Course))
        courses = result.scalars().all()

        for course in courses:
            print(f"Курс: {course.title} (ID: {course.id})")

            # Секции
            result = await db.execute(
                select(CourseSection).where(CourseSection.course_id == course.id)
            )
            sections = result.scalars().all()
            print(f"  Секций: {len(sections)}")

            for section in sections:
                # Топики
                result = await db.execute(
                    select(CourseTopic).where(CourseTopic.section_id == section.id)
                )
                topics = result.scalars().all()

                # Уроки (в топиках)
                topic_lessons_count = 0
                for topic in topics:
                    result = await db.execute(
                        select(func.count(InteractiveLesson.id))
                        .where(InteractiveLesson.topic_id == topic.id)
                    )
                    topic_lessons_count += result.scalar() or 0

                # Уроки (напрямую в секции - старая структура)
                result = await db.execute(
                    select(func.count(InteractiveLesson.id))
                    .where(InteractiveLesson.section_id == section.id)
                    .where(InteractiveLesson.topic_id == None)
                )
                direct_lessons_count = result.scalar() or 0

                total_lessons = topic_lessons_count + direct_lessons_count

                print(f"    Секция: {section.title}")
                print(f"      Топиков: {len(topics)}")
                print(f"      Уроков: {total_lessons} (в топиках: {topic_lessons_count}, напрямую: {direct_lessons_count})")

                # Блоки по типам
                result = await db.execute(
                    select(
                        ExerciseBlock.block_type,
                        func.count(ExerciseBlock.id).label('count')
                    )
                    .join(InteractiveLesson)
                    .join(CourseTopic, isouter=True)
                    .where(
                        (CourseTopic.section_id == section.id) |
                        (InteractiveLesson.section_id == section.id)
                    )
                    .group_by(ExerciseBlock.block_type)
                )
                block_types = result.all()

                if block_types:
                    print(f"      Блоки по типам:")
                    for block_type, count in block_types:
                        print(f"        {block_type}: {count}")

            print()


async def delete_all_lessons_and_blocks(course_id: int = 10):
    """Удаление всех уроков и блоков из курса"""
    print("\n" + "="*60)
    print(f"УДАЛЕНИЕ ДАННЫХ ИЗ КУРСА ID={course_id}")
    print("="*60 + "\n")

    async with async_session_maker() as db:
        # Получаем все секции курса
        result = await db.execute(
            select(CourseSection).where(CourseSection.course_id == course_id)
        )
        sections = result.scalars().all()

        total_blocks_deleted = 0
        total_lessons_deleted = 0
        total_topics_deleted = 0

        for section in sections:
            print(f"Секция: {section.title}")

            # Получаем все топики секции
            result = await db.execute(
                select(CourseTopic).where(CourseTopic.section_id == section.id)
            )
            topics = result.scalars().all()

            for topic in topics:
                # Получаем все уроки топика
                result = await db.execute(
                    select(InteractiveLesson).where(InteractiveLesson.topic_id == topic.id)
                )
                lessons = result.scalars().all()

                for lesson in lessons:
                    # Удаляем блоки урока
                    result = await db.execute(
                        delete(ExerciseBlock).where(ExerciseBlock.lesson_id == lesson.id)
                    )
                    blocks_deleted = result.rowcount
                    total_blocks_deleted += blocks_deleted

                    # Удаляем урок
                    await db.delete(lesson)
                    total_lessons_deleted += 1

                # Удаляем топик
                await db.delete(topic)
                total_topics_deleted += 1

            # Удаляем уроки напрямую в секции (старая структура)
            result = await db.execute(
                select(InteractiveLesson)
                .where(InteractiveLesson.section_id == section.id)
                .where(InteractiveLesson.topic_id == None)
            )
            direct_lessons = result.scalars().all()

            for lesson in direct_lessons:
                # Удаляем блоки
                result = await db.execute(
                    delete(ExerciseBlock).where(ExerciseBlock.lesson_id == lesson.id)
                )
                blocks_deleted = result.rowcount
                total_blocks_deleted += blocks_deleted

                # Удаляем урок
                await db.delete(lesson)
                total_lessons_deleted += 1

        await db.commit()

        print(f"\nУдалено:")
        print(f"  Топиков: {total_topics_deleted}")
        print(f"  Уроков: {total_lessons_deleted}")
        print(f"  Блоков: {total_blocks_deleted}")


async def reimport_all_levels():
    """Переимпорт всех уровней English File 4th"""
    print("\n" + "="*60)
    print("ПЕРЕИМПОРТ ВСЕХ УРОВНЕЙ")
    print("="*60 + "\n")

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

    for filename, section_title in levels:
        filepath = output_dir / filename
        if not filepath.exists():
            print(f"⚠️  Файл не найден: {filename}")
            continue

        print(f"\nИмпортируем: {section_title}")
        try:
            await import_level(str(filepath), section_title)
        except Exception as e:
            print(f"❌ Ошибка импорта {section_title}: {e}")
            import traceback
            traceback.print_exc()


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Исправление и переимпорт курсов")
    parser.add_argument("--dry-run", action="store_true", help="Только показать что будет удалено")
    parser.add_argument("--check", action="store_true", help="Только проверка текущего состояния")
    parser.add_argument("--reimport", action="store_true", help="Удалить и переимпортировать")

    args = parser.parse_args()

    if args.check or not any([args.dry_run, args.reimport]):
        await check_current_state()
        return

    if args.dry_run:
        print("\n⚠️  DRY RUN - ничего не будет удалено\n")
        await check_current_state()
        print("\n⚠️  Для фактического удаления и переимпорта используйте --reimport")
        return

    if args.reimport:
        # Показываем текущее состояние
        await check_current_state()

        # Подтверждение
        print("\n" + "="*60)
        print("⚠️  ВНИМАНИЕ! Будут удалены ВСЕ уроки и блоки курса English File 4th")
        print("="*60)
        response = input("\nПродолжить? (yes/no): ")

        if response.lower() != 'yes':
            print("Отменено")
            return

        # Удаляем
        await delete_all_lessons_and_blocks(course_id=10)

        # Переимпортируем
        await reimport_all_levels()

        # Проверяем результат
        print("\n" + "="*60)
        print("РЕЗУЛЬТАТ ПОСЛЕ ПЕРЕИМПОРТА")
        print("="*60)
        await check_current_state()

        print("\n✅ Готово! Проверьте курсы на платформе.")


if __name__ == "__main__":
    asyncio.run(main())
