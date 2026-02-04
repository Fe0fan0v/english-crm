"""
Импорт спарсенных данных Edvibe в базу данных JSI LMS.

Использование:
    cd backend
    python -m scripts.edvibe_parser.import_to_jsi ../scripts/edvibe_parser/output/jsi_lesson.json

Или из корня проекта:
    python scripts/edvibe_parser/import_to_jsi.py output/jsi_lesson.json
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
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.models.course import Course, CourseSection, InteractiveLesson, ExerciseBlock
    from app.config import settings
    DATABASE_URL = settings.database_url
except ImportError as e:
    print(f"Ошибка импорта: {e}")
    print("Запустите скрипт из директории backend или убедитесь что зависимости установлены")
    sys.exit(1)


async def import_course(json_path: str, created_by_id: int = 1, course_title: str = None):
    """Импорт курса из JSON файла"""

    # Читаем JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Определяем название курса
    title = course_title or data.get("title") or "Импортированный курс"
    print(f"Импорт курса: {title}")
    print(f"Разделов: {len(data.get('sections', []))}")

    # Подключаемся к БД
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Создаем курс
        course = Course(
            title=title,
            description=data.get("description", ""),
            is_published=False,  # По умолчанию черновик
            created_by_id=created_by_id
        )
        session.add(course)
        await session.flush()
        print(f"Создан курс: ID={course.id}")

        # Создаем секции и уроки
        for section_pos, section_data in enumerate(data.get("sections", []), start=1):
            section = CourseSection(
                course_id=course.id,
                title=section_data.get("title", f"Раздел {section_pos}"),
                description="",
                position=section_pos
            )
            session.add(section)
            await session.flush()
            print(f"  Создана секция: {section.title}")

            # Создаем уроки секции
            for lesson_pos, lesson_data in enumerate(section_data.get("lessons", []), start=1):
                lesson = InteractiveLesson(
                    section_id=section.id,
                    title=lesson_data.get("title", f"Урок {lesson_pos}"),
                    description="",
                    position=lesson_pos,
                    is_published=False,
                    is_homework=False
                )
                session.add(lesson)
                await session.flush()
                print(f"    Создан урок: {lesson.title}")

                # Создаем блоки урока
                for block_data in lesson_data.get("blocks", []):
                    block = ExerciseBlock(
                        lesson_id=lesson.id,
                        block_type=block_data.get("block_type", "text"),
                        content=block_data.get("content", {}),
                        position=block_data.get("position", 1)
                    )
                    session.add(block)

                await session.flush()
                block_count = len(lesson_data.get("blocks", []))
                print(f"      Добавлено блоков: {block_count}")

        await session.commit()
        print(f"\nИмпорт завершен! Курс ID: {course.id}")
        print(f"Откройте в редакторе: /courses/{course.id}/edit")

        return course.id


def main():
    parser = argparse.ArgumentParser(description="Импорт Edvibe курса в JSI LMS")
    parser.add_argument("json_file", help="Путь к JSON файлу с данными курса")
    parser.add_argument("--user-id", "-u", type=int, default=1, help="ID пользователя-создателя (по умолчанию 1)")
    parser.add_argument("--title", "-t", type=str, default=None, help="Название курса (переопределяет название из JSON)")

    args = parser.parse_args()

    json_path = Path(args.json_file)
    if not json_path.exists():
        print(f"Файл не найден: {json_path}")
        sys.exit(1)

    asyncio.run(import_course(str(json_path), args.user_id, args.title))


if __name__ == "__main__":
    main()
