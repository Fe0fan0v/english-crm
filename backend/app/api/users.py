from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import DBSession, ManagerUser
from app.models.user import User
from app.schemas.user import UserCreate, UserListResponse, UserResponse, UserUpdate
from app.utils.security import get_password_hash

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    db: DBSession,
    current_user: ManagerUser,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
) -> UserListResponse:
    """List all users with pagination and search."""
    query = select(User)
    count_query = select(func.count(User.id))

    if search:
        search_filter = or_(
            User.name.ilike(f"%{search}%"),
            User.email.ilike(f"%{search}%"),
            User.phone.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * size
    query = query.offset(offset).limit(size).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    pages = (total + size - 1) // size if total > 0 else 1

    return UserListResponse(
        items=users,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: DBSession,
    current_user: ManagerUser,
) -> User:
    """Get a specific user by ID."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: DBSession,
    current_user: ManagerUser,
) -> User:
    """Create a new user."""
    # Check if email already exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role,
        level_id=user_data.level_id,
        photo_url=user_data.photo_url,
    )

    db.add(user)
    await db.flush()
    await db.refresh(user)

    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: DBSession,
    current_user: ManagerUser,
) -> User:
    """Update a user."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check email uniqueness if changing
    if user_data.email and user_data.email != user.email:
        result = await db.execute(select(User).where(User.email == user_data.email))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    update_data = user_data.model_dump(exclude_unset=True)

    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)

    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: DBSession,
    current_user: ManagerUser,
) -> None:
    """Delete a user (soft delete - set is_active to False)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )

    user.is_active = False
    await db.flush()
