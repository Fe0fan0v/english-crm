"""
Одноразовый скрипт: синхронизация учеников групп с будущими запланированными уроками.

Находит все будущие групповые уроки, сравнивает список учеников урока
со списком учеников группы и добавляет недостающих.

Запуск: cd backend && python sync_group_students.py
Для применения изменений: python sync_group_students.py --apply
"""

import argparse
import asyncio
from datetime import datetime

from sqlalchemy import select

from app.config import settings
from app.database import async_session_maker, engine
from app.models.group import Group, GroupStudent
from app.models.lesson import AttendanceStatus, Lesson, LessonStatus, LessonStudent


async def sync():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Применить изменения (без флага — dry run)")
    args = parser.parse_args()

    dry_run = not args.apply

    if dry_run:
        print("=== DRY RUN (без изменений в БД). Для применения: python sync_group_students.py --apply ===\n")
    else:
        print("=== ПРИМЕНЕНИЕ ИЗМЕНЕНИЙ ===\n")

    async with async_session_maker() as db:
        # Все будущие запланированные уроки с group_id
        result = await db.execute(
            select(Lesson).where(
                Lesson.group_id.isnot(None),
                Lesson.status == LessonStatus.SCHEDULED,
                Lesson.scheduled_at > datetime.now(),
            ).order_by(Lesson.scheduled_at)
        )
        future_lessons = result.scalars().all()

        if not future_lessons:
            print("Нет будущих запланированных групповых уроков.")
            return

        print(f"Найдено будущих групповых уроков: {len(future_lessons)}\n")

        total_added = 0

        for lesson in future_lessons:
            # Ученики группы
            group_students_result = await db.execute(
                select(GroupStudent.student_id).where(GroupStudent.group_id == lesson.group_id)
            )
            group_student_ids = {row[0] for row in group_students_result.all()}

            # Ученики уже в уроке
            lesson_students_result = await db.execute(
                select(LessonStudent.student_id).where(LessonStudent.lesson_id == lesson.id)
            )
            lesson_student_ids = {row[0] for row in lesson_students_result.all()}

            # Недостающие
            missing_ids = group_student_ids - lesson_student_ids

            if missing_ids:
                print(f"Урок #{lesson.id} «{lesson.title}» ({lesson.scheduled_at.strftime('%d.%m.%Y %H:%M')}), "
                      f"группа #{lesson.group_id}: "
                      f"в уроке {len(lesson_student_ids)}, в группе {len(group_student_ids)}, "
                      f"добавляем {len(missing_ids)} учеников: {missing_ids}")

                if not dry_run:
                    for student_id in missing_ids:
                        db.add(LessonStudent(lesson_id=lesson.id, student_id=student_id))

                total_added += len(missing_ids)

        if total_added == 0:
            print("Все уроки уже синхронизированы, недостающих учеников нет.")
        else:
            print(f"\nИтого: {total_added} записей для добавления.")
            if not dry_run:
                await db.commit()
                print("Изменения сохранены в БД.")
            else:
                print("Это dry run. Для применения запустите: python sync_group_students.py --apply")


if __name__ == "__main__":
    asyncio.run(sync())
