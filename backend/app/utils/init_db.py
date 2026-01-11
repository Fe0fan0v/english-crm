import asyncio

from sqlalchemy import select

from app.database import Base, async_session_maker, engine
from app.models.user import User, UserRole
from app.utils.security import get_password_hash


async def init_db():
    """Initialize database with default admin user."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        result = await session.execute(select(User).where(User.role == UserRole.ADMIN))
        )
        admin = result.scalar_one_or_none()

        if not admin:
            # Create default admin
            admin = User(
                name="Администратор",
                email="admin@engcrm.local",
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN,
            )
            session.add(admin)
            await session.commit()
            print("Default admin user created:")
            print("  Email: admin@engcrm.local")
            print("  Password: admin123")
        else:
            print("Admin user already exists")


if __name__ == "__main__":
    asyncio.run(init_db())
