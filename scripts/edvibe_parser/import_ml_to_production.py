"""
Импорт Market Leader в production базу данных (через Docker)

Использование:
    scp output/jsi_hierarchy_Market_Leader_ALL_LEVELS_*.json jsi:~/ml_data.json
    scp import_ml_to_production.py jsi:~/import_ml.py
    ssh jsi "cd ~/english-crm && sudo docker compose cp ~/ml_data.json backend:/app/ml_data.json"
    ssh jsi "cd ~/english-crm && sudo docker compose cp ~/import_ml.py backend:/app/import_ml.py"
    ssh jsi "cd ~/english-crm && sudo docker compose exec backend python /app/import_ml.py"
"""

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.course import Course, CourseSection, InteractiveLesson, ExerciseBlock
from app.config import settings


async def import_market_leader(json_path: str = "/app/ml_data.json", created_by_id: int = 1):
    """Импорт Market Leader из JSON файла"""

    # Читаем JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    title = data.get("course_name", "Business English Market Leader")
    sections_data = data.get("sections", [])

    print(f"=" * 70)
    print(f"ИМПОРТ: {title}")
    print(f"=" * 70)
    print(f"Секций (уровней): {len(sections_data)}")

    for section in sections_data:
        lessons_count = len(section.get("lessons", []))
        blocks_count = sum(len(l.get("blocks", [])) for l in section.get("lessons", []))
        print(f"  {section['title']}: {lessons_count} уроков, {blocks_count} блоков")

    # Подключаемся к БД
    engine = create_async_engine(settings.database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Создаем курс
        course = Course(
            title=title,
            description=f"Business English курс с {len(sections_data)} уровнями",
            is_published=True,  # Публикуем сразу
            created_by_id=created_by_id
        )
        session.add(course)
        await session.flush()
        print(f"\n✓ Создан курс: ID={course.id}, '{course.title}'")

        total_sections = 0
        total_lessons = 0
        total_blocks = 0

        # Создаем секции и уроки
        for section_data in sections_data:
            section = CourseSection(
                course_id=course.id,
                title=section_data.get("title", "Без названия"),
                description=section_data.get("description", ""),
                position=section_data.get("position", 1)
            )
            session.add(section)
            await session.flush()
            total_sections += 1
            print(f"\n  ✓ Секция: {section.title}")

            # Создаем уроки секции
            for lesson_data in section_data.get("lessons", []):
                lesson = InteractiveLesson(
                    section_id=section.id,
                    title=lesson_data.get("title", "Без названия"),
                    description=lesson_data.get("description", ""),
                    position=lesson_data.get("position", total_lessons + 1),
                    is_published=True,
                    is_homework=lesson_data.get("is_homework", False),
                    created_by_id=created_by_id
                )
                session.add(lesson)
                await session.flush()
                total_lessons += 1

                # Создаем блоки урока
                blocks = lesson_data.get("blocks", [])
                for block_data in blocks:
                    # Обрезаем title до 255 символов (ограничение БД)
                    title = block_data.get("title", "")
                    if len(title) > 255:
                        title = title[:252] + "..."

                    block = ExerciseBlock(
                        lesson_id=lesson.id,
                        block_type=block_data.get("block_type", "text"),
                        content=block_data.get("content", {}),
                        position=block_data.get("position", 1),
                        title=title
                    )
                    session.add(block)
                    total_blocks += 1

                print(f"    ✓ Урок '{lesson.title}': {len(blocks)} блоков")

        await session.commit()

        print(f"\n" + "=" * 70)
        print(f"ИМПОРТ ЗАВЕРШЕН!")
        print(f"=" * 70)
        print(f"Курс ID: {course.id}")
        print(f"Секций: {total_sections}")
        print(f"Уроков: {total_lessons}")
        print(f"Блоков: {total_blocks}")
        print(f"\nРедактор: https://lms.jsi.kz/courses/{course.id}/edit")
        print(f"=" * 70)

        return course.id


if __name__ == "__main__":
    asyncio.run(import_market_leader())
