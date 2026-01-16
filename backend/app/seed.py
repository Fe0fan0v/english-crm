"""
Seed script to create initial test users.
Run with: python -m app.seed
"""
import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker
from app.models.user import User, UserRole
from app.utils.security import get_password_hash


async def seed_users(db: AsyncSession) -> None:
    """Create test users if they don't exist."""

    test_users = [
        {
            "name": "Администратор",
            "email": "admin@engcrm.ru",
            "password": "admin123",
            "role": UserRole.ADMIN,
        },
        {
            "name": "Менеджер",
            "email": "manager@engcrm.ru",
            "password": "manager123",
            "role": UserRole.MANAGER,
        },
        {
            "name": "Преподаватель Тест",
            "email": "teacher@engcrm.ru",
            "password": "teacher123",
            "role": UserRole.TEACHER,
        },
        {
            "name": "Ученик Тест",
            "email": "student@engcrm.ru",
            "password": "student123",
            "role": UserRole.STUDENT,
            "balance": Decimal("5000.00"),
        },
    ]

    for user_data in test_users:
        # Check if user exists
        result = await db.execute(
            select(User).where(User.email == user_data["email"])
        )
        existing_user = result.scalar_one_or_none()

        if existing_user:
            print(f"User {user_data['email']} already exists, skipping...")
            continue

        # Create user
        user = User(
            name=user_data["name"],
            email=user_data["email"],
            password_hash=get_password_hash(user_data["password"]),
            role=user_data["role"],
            balance=user_data.get("balance", Decimal("0.00")),
        )
        db.add(user)
        print(f"Created user: {user_data['email']} ({user_data['role'].value})")

    await db.commit()
    print("Seed completed!")


async def main() -> None:
    async with async_session_maker() as db:
        await seed_users(db)


if __name__ == "__main__":
    asyncio.run(main())
