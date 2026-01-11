from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, get_db
from app.models.test import Test
from app.schemas.test import (
    TestCreate,
    TestUpdate,
    TestResponse,
    TestListResponse,
)

router = APIRouter()


@router.get("", response_model=TestListResponse)
async def list_tests(
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get all tests."""
    query = select(Test)

    if search:
        query = query.where(Test.title.ilike(f"%{search}%"))

    query = query.order_by(Test.created_at.desc())

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    result = await db.execute(query)
    items = result.scalars().all()

    return TestListResponse(items=items, total=total or 0)


@router.get("/{test_id}", response_model=TestResponse)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Get a specific test."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    return test


@router.post("", response_model=TestResponse, status_code=status.HTTP_201_CREATED)
async def create_test(
    data: TestCreate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Create a new test."""
    test = Test(**data.model_dump())
    db.add(test)
    await db.commit()
    await db.refresh(test)

    return test


@router.put("/{test_id}", response_model=TestResponse)
async def update_test(
    test_id: int,
    data: TestUpdate,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Update a test."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(test, field, value)

    await db.commit()
    await db.refresh(test)

    return test


@router.delete("/{test_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db),
    _: AdminUser = None,
):
    """Delete a test."""
    result = await db.execute(select(Test).where(Test.id == test_id))
    test = result.scalar_one_or_none()

    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test not found",
        )

    await db.delete(test)
    await db.commit()
