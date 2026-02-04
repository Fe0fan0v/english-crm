"""
Обновление существующего курса в базе данных JSI LMS.

Удаляет все старые секции, уроки и блоки, затем импортирует новые данные.

Использование:
    cd backend
    python -m scripts.edvibe_parser.update_course --course-id 10 ../scripts/edvibe_parser/output/jsi_hierarchy_Beginner_20260203_211912.json

На сервере:
    docker compose exec backend python /app/update_course.py --course-id 10 /app/data.json
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

# Добавляем backend в path для импорта моделей
backend_path = Path(__file__).parent.parent.parent / "backend"
sys.path.insert(0, str(backend_path))

try:
    from sqlalchemy import text, delete
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.models.course import Course, CourseSection, InteractiveLesson, ExerciseBlock
    from app.config import settings
    DATABASE_URL = settings.database_url
except ImportError as e:
    print(f"Ошибка импорта: {e}")
    print("Запустите скрипт из директории backend или убедитесь что зависимости установлены")
    sys.exit(1)


async def update_course(json_path: str, course_id: int):
    """Обновление курса из JSON файла"""

    # Читаем JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("=" * 60)
    print(f"Обновление курса ID={course_id}")
    print("=" * 60)

    # Подключаемся к БД
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Проверяем что курс существует
        course = await session.get(Course, course_id)
        if not course:
            print(f"[ERROR] Курс с ID={course_id} не найден!")
            return

        print(f"Найден курс: {course.title}")

        # Получаем статистику до удаления
        stats_query = text("""
            SELECT
                (SELECT COUNT(*) FROM course_sections WHERE course_id = :course_id) as sections,
                (SELECT COUNT(*) FROM interactive_lessons il
                 JOIN course_sections cs ON il.section_id = cs.id
                 WHERE cs.course_id = :course_id) as lessons,
                (SELECT COUNT(*) FROM exercise_blocks eb
                 JOIN interactive_lessons il ON eb.lesson_id = il.id
                 JOIN course_sections cs ON il.section_id = cs.id
                 WHERE cs.course_id = :course_id) as blocks
        """)
        result = await session.execute(stats_query, {"course_id": course_id})
        old_stats = result.fetchone()
        print(f"\nТекущая структура:")
        print(f"  Секций: {old_stats[0]}")
        print(f"  Уроков: {old_stats[1]}")
        print(f"  Блоков: {old_stats[2]}")

        # Удаляем блоки → уроки → секции (в правильном порядке)
        print("\nУдаление старых данных...")

        # 1. Удаляем блоки
        delete_blocks = text("""
            DELETE FROM exercise_blocks
            WHERE lesson_id IN (
                SELECT il.id FROM interactive_lessons il
                JOIN course_sections cs ON il.section_id = cs.id
                WHERE cs.course_id = :course_id
            )
        """)
        result = await session.execute(delete_blocks, {"course_id": course_id})
        print(f"  Удалено блоков: {result.rowcount}")

        # 2. Удаляем уроки
        delete_lessons = text("""
            DELETE FROM interactive_lessons
            WHERE section_id IN (
                SELECT id FROM course_sections WHERE course_id = :course_id
            )
        """)
        result = await session.execute(delete_lessons, {"course_id": course_id})
        print(f"  Удалено уроков: {result.rowcount}")

        # 3. Удаляем секции
        delete_sections = text("""
            DELETE FROM course_sections WHERE course_id = :course_id
        """)
        result = await session.execute(delete_sections, {"course_id": course_id})
        print(f"  Удалено секций: {result.rowcount}")

        # Обновляем название курса если нужно
        new_title = data.get("title")
        if new_title and new_title != course.title:
            print(f"\nОбновление названия курса: {course.title} → {new_title}")
            course.title = new_title

        # Импортируем новые данные
        print("\nИмпорт новых данных...")
        total_lessons = 0
        total_blocks = 0

        for section_pos, section_data in enumerate(data.get("sections", []), start=1):
            section = CourseSection(
                course_id=course.id,
                title=section_data.get("title", f"Раздел {section_pos}"),
                description="",
                position=section_pos
            )
            session.add(section)
            await session.flush()
            print(f"\n  Секция: {section.title}")

            # Создаем уроки секции
            lessons = section_data.get("lessons", [])
            for lesson_pos, lesson_data in enumerate(lessons, start=1):
                lesson = InteractiveLesson(
                    section_id=section.id,
                    title=lesson_data.get("title", f"Урок {lesson_pos}"),
                    description="",
                    position=lesson_pos,
                    is_published=True,  # Сразу опубликован
                    is_homework=False
                )
                session.add(lesson)
                await session.flush()
                total_lessons += 1

                # Создаем блоки урока
                blocks = lesson_data.get("blocks", [])
                for block_data in blocks:
                    # Добавляем title если есть
                    block = ExerciseBlock(
                        lesson_id=lesson.id,
                        block_type=block_data.get("block_type", "text"),
                        content=block_data.get("content", {}),
                        position=block_data.get("position", 1),
                        title=block_data.get("title", "")
                    )
                    session.add(block)
                    total_blocks += 1

                await session.flush()
                print(f"    [{lesson_pos:2d}] {lesson.title[:50]:<50} ({len(blocks)} блоков)")

        await session.commit()

        print("\n" + "=" * 60)
        print("[OK] Обновление завершено!")
        print("=" * 60)
        print(f"  Курс: {course.title} (ID={course.id})")
        print(f"  Секций: {len(data.get('sections', []))}")
        print(f"  Уроков: {total_lessons}")
        print(f"  Блоков: {total_blocks}")
        print(f"\nОткройте в редакторе: /courses/{course.id}/edit")

    await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Обновление курса в JSI LMS")
    parser.add_argument("json_file", help="Путь к JSON файлу с данными курса")
    parser.add_argument("--course-id", "-c", type=int, required=True, help="ID курса для обновления")

    args = parser.parse_args()

    json_path = Path(args.json_file)
    if not json_path.exists():
        print(f"Файл не найден: {json_path}")
        sys.exit(1)

    asyncio.run(update_course(str(json_path), args.course_id))


if __name__ == "__main__":
    main()
