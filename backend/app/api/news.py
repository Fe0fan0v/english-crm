from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, get_db
from app.models.news import News
from app.schemas.news import (
    NewsCreate,
    NewsListResponse,
    NewsResponse,
    NewsUpdate,
)

router = APIRouter(prefix="/news", tags=["news"])


@router.get("", response_model=NewsListResponse)
async def list_news(
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = ...,
    page: int = 1,
    size: int = 20,
    show_unpublished: bool = False,
):
    """List news. Regular users only see published news."""
    offset = (page - 1) * size

    # Build base query
    query = select(News)
    if not show_unpublished:
        query = query.where(News.is_published == True)  # noqa: E712
    query = query.order_by(News.created_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(News)
    if not show_unpublished:
        count_query = count_query.where(News.is_published == True)  # noqa: E712
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated items
    query = query.offset(offset).limit(size)
    result = await db.execute(query)
    items = result.scalars().all()

    return NewsListResponse(items=items, total=total)


@router.get("/{news_id}", response_model=NewsResponse)
async def get_news(
    news_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: CurrentUser = ...,
):
    """Get a single news article."""
    result = await db.execute(select(News).where(News.id == news_id))
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    return news


@router.post("", response_model=NewsResponse)
async def create_news(
    news_data: NewsCreate,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Create a new news article (admin only)."""
    news = News(**news_data.model_dump())
    db.add(news)
    await db.commit()
    await db.refresh(news)
    return news


@router.patch("/{news_id}", response_model=NewsResponse)
async def update_news(
    news_id: int,
    news_data: NewsUpdate,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Update a news article (admin only)."""
    result = await db.execute(select(News).where(News.id == news_id))
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")

    update_data = news_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(news, field, value)

    await db.commit()
    await db.refresh(news)
    return news


@router.delete("/{news_id}")
async def delete_news(
    news_id: int,
    db: AsyncSession = Depends(get_db),
    _current_user: AdminUser = ...,
):
    """Delete a news article (admin only)."""
    result = await db.execute(select(News).where(News.id == news_id))
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")

    await db.delete(news)
    await db.commit()
    return {"message": "News deleted"}
