"""
Диагностический скрипт для проблем со входом пользователя.

Usage (на production через docker):
    docker compose exec backend python scripts/diagnose_user_login.py 1amellirina28@gmail.com

Или локально:
    cd backend && python scripts/diagnose_user_login.py 1amellirina28@gmail.com
"""
import sys
import asyncio

import bcrypt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Попробуем импортировать из приложения
try:
    from app.models.user import User
    from app.config import settings
    DATABASE_URL = settings.database_url
except ImportError:
    from app.models.user import User
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5435/engcrm"


async def diagnose(email_input: str):
    email = email_input.strip().lower()
    print(f"\n{'='*60}")
    print(f"ДИАГНОСТИКА ВХОДА")
    print(f"Введённый email: {email_input}")
    print(f"Нормализованный: {email}")
    print(f"{'='*60}\n")

    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 1. Поиск по точному email
        result = await session.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if not user:
            # 2. Поиск по LIKE (может есть пробелы/символы)
            result = await session.execute(
                select(User).where(User.email.ilike(f"%{email.split('@')[0]}%"))
            )
            similar = result.scalars().all()
            print(f"❌ Пользователь с email '{email}' НЕ НАЙДЕН")
            if similar:
                print(f"\n   Похожие пользователи:")
                for u in similar:
                    print(f"   - id={u.id}, email='{u.email}', role={u.role}, active={u.is_active}")
            else:
                print(f"   Похожих пользователей тоже не найдено.")

            # 3. Проверим сырой SQL на наличие спецсимволов
            raw = await session.execute(
                text("SELECT id, email, encode(email::bytea, 'hex') as hex_email FROM users WHERE email LIKE :pat"),
                {"pat": f"%amellirina%"}
            )
            rows = raw.fetchall()
            if rows:
                print(f"\n   Сырой поиск 'amellirina' в БД:")
                for r in rows:
                    print(f"   - id={r[0]}, email='{r[1]}', hex={r[2]}")

            await engine.dispose()
            return

        print(f"✅ Пользователь найден:")
        print(f"   ID:       {user.id}")
        print(f"   Email:    '{user.email}'")
        print(f"   Имя:      {user.name}")
        print(f"   Роль:     {user.role}")
        print(f"   Активен:  {user.is_active}")
        print(f"   Hash:     {user.password_hash[:30]}...")
        print(f"   Hash len: {len(user.password_hash)}")
        print()

        # Проверки
        if not user.is_active:
            print(f"⚠️  ПРОБЛЕМА: Пользователь НЕАКТИВЕН (is_active=False)")
            print(f"   Решение: UPDATE users SET is_active = true WHERE id = {user.id};")
            print()

        # Проверка хеша пароля
        hash_val = user.password_hash
        if not hash_val:
            print(f"⚠️  ПРОБЛЕМА: password_hash пуст!")
        elif not hash_val.startswith(("$2a$", "$2b$", "$2y$")):
            print(f"⚠️  ПРОБЛЕМА: Некорректный формат хеша: '{hash_val[:20]}...'")
            print(f"   Ожидается формат bcrypt ($2a$/$2b$/$2y$)")
        else:
            print(f"✅ Формат хеша корректный ({hash_val[:4]})")

        # Тест с паролем если передан
        if len(sys.argv) > 2:
            test_password = sys.argv[2]
            print(f"\n   Тестируем пароль: '{test_password}'")
            try:
                result = bcrypt.checkpw(
                    test_password.encode("utf-8"),
                    hash_val.encode("utf-8")
                )
                if result:
                    print(f"   ✅ Пароль ВЕРНЫЙ — вход должен работать!")
                    if not user.is_active:
                        print(f"   ⚠️  Но пользователь неактивен!")
                else:
                    print(f"   ❌ Пароль НЕ ПОДХОДИТ к хешу в БД")
            except Exception as e:
                print(f"   ❌ Ошибка при проверке: {e}")

            # Установка нового пароля
            print(f"\n   Для сброса пароля выполните:")
            new_hash = bcrypt.hashpw(test_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            print(f"   UPDATE users SET password_hash = '{new_hash}' WHERE id = {user.id};")

        # Проверяем дубликаты
        dup_result = await session.execute(
            select(User).where(User.email == email)
        )
        duplicates = dup_result.scalars().all()
        if len(duplicates) > 1:
            print(f"\n⚠️  ПРОБЛЕМА: Найдено {len(duplicates)} пользователей с одинаковым email!")
            for d in duplicates:
                print(f"   - id={d.id}, role={d.role}, active={d.is_active}")

    await engine.dispose()
    print(f"\n{'='*60}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/diagnose_user_login.py <email> [test_password]")
        print("Example: python scripts/diagnose_user_login.py user@example.com mypassword123")
        sys.exit(1)

    asyncio.run(diagnose(sys.argv[1]))
