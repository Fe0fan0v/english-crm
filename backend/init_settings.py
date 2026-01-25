"""
Script to initialize default settings in the database
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.settings import Settings
from app.config import settings as app_settings

async def init_settings():
    engine = create_async_engine(app_settings.database_url, echo=True)
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Check if whatsapp_manager_phone exists
        result = await session.execute(
            select(Settings).where(Settings.key == "whatsapp_manager_phone")
        )
        existing = result.scalar_one_or_none()
        
        if not existing:
            # Create default setting
            setting = Settings(
                key="whatsapp_manager_phone",
                value="+77001234567"  # Default placeholder
            )
            session.add(setting)
            await session.commit()
            print("✅ Created default whatsapp_manager_phone setting")
        else:
            print("✅ whatsapp_manager_phone setting already exists:", existing.value)

if __name__ == "__main__":
    asyncio.run(init_settings())
