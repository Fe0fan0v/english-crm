"""
Скрипт для обновления паролей студентов из Excel файла.

Usage:
    cd backend
    python -m scripts.update_student_passwords path/to/excel_file.xlsx
"""
import sys
import asyncio
import pandas as pd
from pathlib import Path
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import bcrypt

from app.models.user import User

# Database URL (будет взят из environment или можно передать как аргумент)
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5435/engcrm"


async def update_passwords_from_excel(excel_path: str):
    """Обновляет пароли студентов из Excel файла"""

    # Читаем Excel файл
    print(f"Читаю файл: {excel_path}")
    df = pd.read_excel(excel_path)

    # Проверяем структуру
    print(f"Всего строк: {len(df)}")
    print(f"Колонки: {df.columns.tolist()}")

    # Email в колонке 1 (индекс 1), Пароль в колонке 2 (индекс 2)
    email_col = df.columns[1]
    password_col = df.columns[2]

    print(f"Email колонка: {email_col}")
    print(f"Пароль колонка: {password_col}")

    # Создаем async engine
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    success_count = 0
    not_found_count = 0
    error_count = 0

    print("\nНачинаю обновление паролей...\n")

    async with async_session() as session:
        for idx, row in df.iterrows():
            email = row[email_col]
            password = row[password_col]

            # Пропускаем строки с пустыми значениями
            if pd.isna(email) or pd.isna(password):
                continue

            email = str(email).strip().lower()
            password = str(password).strip()

            if not email or not password:
                continue

            try:
                # Находим студента по email
                result = await session.execute(
                    select(User).where(User.email == email, User.role == 'student')
                )
                user = result.scalar_one_or_none()

                if not user:
                    print(f"❌ Студент не найден: {email}")
                    not_found_count += 1
                    continue

                # Хешируем новый пароль
                hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

                # Обновляем пароль
                user.password_hash = hashed_password
                await session.commit()

                print(f"✅ Обновлен: {user.name} ({email})")
                success_count += 1

            except Exception as e:
                print(f"❌ Ошибка для {email}: {str(e)}")
                error_count += 1
                await session.rollback()

    # Итоговая статистика
    print("\n" + "="*60)
    print("ИТОГИ ОБНОВЛЕНИЯ:")
    print(f"✅ Успешно обновлено: {success_count}")
    print(f"❌ Не найдено в БД: {not_found_count}")
    print(f"⚠️  Ошибки: {error_count}")
    print("="*60)

    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/update_student_passwords.py path/to/excel_file.xlsx")
        sys.exit(1)

    excel_file = sys.argv[1]

    if not Path(excel_file).exists():
        print(f"Файл не найден: {excel_file}")
        sys.exit(1)

    asyncio.run(update_passwords_from_excel(excel_file))
