#!/usr/bin/env python3
"""
Скрипт для обновления курса Family and Friends (ID=12) в Docker контейнере на сервере.

Использование:
    1. Скопировать файлы на сервер:
       scp scripts/edvibe_parser/output/jsi_merged_FF_all_levels_fixed.json jsi:~/ff_data.json
       scp scripts/edvibe_parser/update_ff_docker.py jsi:~/update_ff.py

    2. Скопировать в контейнер и запустить:
       ssh jsi "cd ~/english-crm && sudo docker compose cp ~/ff_data.json backend:/app/ff_data.json"
       ssh jsi "cd ~/english-crm && sudo docker compose cp ~/update_ff.py backend:/app/update_ff.py"
       ssh jsi "cd ~/english-crm && sudo docker compose exec backend python /app/update_ff.py"
"""

import asyncio
import json
import sys
import os

# В Docker контейнере app уже в path
sys.path.insert(0, "/app")

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.course import Course, CourseSection, InteractiveLesson, ExerciseBlock
from app.config import settings

DATABASE_URL = settings.database_url

# Конфигурация
COURSE_ID = 12  # ID курса Family and Friends
JSON_FILE = "/app/ff_data.json"
CREATED_BY_ID = 1  # ID пользователя-создателя (admin)


async def update_course():
    """Обновление курса Family and Friends"""

    # Читаем JSON
    if not os.path.exists(JSON_FILE):
        print(f"[ERROR] Файл не найден: {JSON_FILE}")
        sys.exit(1)

    with open(JSON_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print("=" * 60)
    print(f"Обновление курса ID={COURSE_ID} (Family and Friends)")
    print("=" * 60)

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Проверяем курс
        course = await session.get(Course, COURSE_ID)
        if not course:
            print(f"[ERROR] Курс с ID={COURSE_ID} не найден!")
            return

        print(f"Найден курс: {course.title}")

        # Статистика до
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
        result = await session.execute(stats_query, {"course_id": COURSE_ID})
        old_stats = result.fetchone()
        print(f"\nТекущая структура:")
        print(f"  Секций: {old_stats[0]}")
        print(f"  Уроков: {old_stats[1]}")
        print(f"  Блоков: {old_stats[2]}")

        # Статистика типов блоков до обновления
        types_query = text("""
            SELECT eb.block_type, COUNT(*)
            FROM exercise_blocks eb
            JOIN interactive_lessons il ON eb.lesson_id = il.id
            JOIN course_sections cs ON il.section_id = cs.id
            WHERE cs.course_id = :course_id
            GROUP BY eb.block_type
            ORDER BY COUNT(*) DESC
        """)
        result = await session.execute(types_query, {"course_id": COURSE_ID})
        print(f"\n  Типы блоков (до):")
        for row in result:
            print(f"    {row[0]:20s}: {row[1]}")

        # Удаляем блоки → уроки → секции
        print("\nУдаление старых данных...")

        delete_blocks = text("""
            DELETE FROM exercise_blocks
            WHERE lesson_id IN (
                SELECT il.id FROM interactive_lessons il
                JOIN course_sections cs ON il.section_id = cs.id
                WHERE cs.course_id = :course_id
            )
        """)
        result = await session.execute(delete_blocks, {"course_id": COURSE_ID})
        print(f"  Удалено блоков: {result.rowcount}")

        delete_lessons = text("""
            DELETE FROM interactive_lessons
            WHERE section_id IN (
                SELECT id FROM course_sections WHERE course_id = :course_id
            )
        """)
        result = await session.execute(delete_lessons, {"course_id": COURSE_ID})
        print(f"  Удалено уроков: {result.rowcount}")

        delete_sections = text("""
            DELETE FROM course_sections WHERE course_id = :course_id
        """)
        result = await session.execute(delete_sections, {"course_id": COURSE_ID})
        print(f"  Удалено секций: {result.rowcount}")

        # Обновляем название
        new_title = data.get("title")
        if new_title:
            course.title = new_title

        # Импорт новых данных
        print("\nИмпорт новых данных...")
        total_lessons = 0
        total_blocks = 0
        block_type_counts = {}

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

            lessons = section_data.get("lessons", [])
            for lesson_pos, lesson_data in enumerate(lessons, start=1):
                lesson = InteractiveLesson(
                    section_id=section.id,
                    title=lesson_data.get("title", f"Урок {lesson_pos}"),
                    description="",
                    position=lesson_pos,
                    is_published=True,
                    is_homework=False,
                    created_by_id=CREATED_BY_ID
                )
                session.add(lesson)
                await session.flush()
                total_lessons += 1

                blocks = lesson_data.get("blocks", [])
                for block_data in blocks:
                    # Обрезаем title до 255 символов
                    block_title = block_data.get("title", "") or ""
                    if len(block_title) > 255:
                        block_title = block_title[:252] + "..."

                    bt = block_data.get("block_type", "text")
                    block = ExerciseBlock(
                        lesson_id=lesson.id,
                        block_type=bt,
                        content=block_data.get("content", {}),
                        position=block_data.get("position", 1),
                        title=block_title
                    )
                    session.add(block)
                    total_blocks += 1
                    block_type_counts[bt] = block_type_counts.get(bt, 0) + 1

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
        print(f"\n  Типы блоков (после):")
        for bt, count in sorted(block_type_counts.items(), key=lambda x: -x[1]):
            print(f"    {bt:20s}: {count}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(update_course())
