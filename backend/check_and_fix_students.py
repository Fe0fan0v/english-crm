"""
Скрипт для проверки и активации всех учеников в базе данных.
Исправляет проблему с деактивированными учениками.
"""
import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import select, update
from app.database import async_session_maker
from app.models.user import User, UserRole


async def check_and_fix_students():
    async with async_session_maker() as db:
        print("=" * 60)
        print("ПРОВЕРКА УЧЕНИКОВ В БАЗЕ ДАННЫХ")
        print("=" * 60)

        # Подсчитать всех учеников
        result = await db.execute(
            select(User).where(User.role == UserRole.STUDENT)
        )
        all_students = result.scalars().all()
        print(f"\n✓ Всего учеников в базе: {len(all_students)}")

        # Подсчитать активных учеников
        result = await db.execute(
            select(User).where(User.role == UserRole.STUDENT, User.is_active == True)
        )
        active_students = result.scalars().all()
        print(f"✓ Активных учеников: {len(active_students)}")

        # Найти неактивных учеников
        inactive_students = [s for s in all_students if not s.is_active]

        if inactive_students:
            print(f"\n⚠️  ВНИМАНИЕ: Найдено {len(inactive_students)} неактивных учеников!")
            print("\nСписок неактивных учеников:")
            for i, student in enumerate(inactive_students, 1):
                print(f"  {i}. {student.name} ({student.email})")

            # Спросить подтверждение на активацию
            print("\n" + "=" * 60)
            response = input("Активировать всех неактивных учеников? (yes/no): ").strip().lower()

            if response == "yes":
                # Активировать всех неактивных учеников
                for student in inactive_students:
                    student.is_active = True

                await db.commit()
                print(f"\n✓ Успешно активировано {len(inactive_students)} учеников!")
            else:
                print("\n❌ Активация отменена")
        else:
            print("\n✓ Все ученики активны!")

        # Показать первых 10 учеников
        if active_students:
            print("\n" + "=" * 60)
            print("ПЕРВЫЕ 10 АКТИВНЫХ УЧЕНИКОВ:")
            print("=" * 60)
            for i, student in enumerate(active_students[:10], 1):
                print(f"  {i}. {student.name} ({student.email})")

        print("\n" + "=" * 60)
        print("ПРОВЕРКА ЗАВЕРШЕНА")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(check_and_fix_students())
