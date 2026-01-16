from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import DBSession, ManagerUser
from app.models.group import Group, GroupStudent
from app.models.transaction import Transaction, TransactionType
from app.models.user import User, UserRole
from app.schemas.user import (
    BalanceChange,
    TransactionListResponse,
    TransactionResponse,
    UserCreate,
    UserGroupResponse,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
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


@router.post("/{user_id}/balance", response_model=UserResponse)
async def change_user_balance(
    user_id: int,
    data: BalanceChange,
    db: DBSession,
    current_user: ManagerUser,
) -> User:
    """Change user balance and create a transaction."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user.role != UserRole.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Balance can only be changed for students",
        )

    # Determine transaction type
    transaction_type = TransactionType.CREDIT if data.amount >= 0 else TransactionType.DEBIT
    abs_amount = abs(data.amount)

    # Update balance
    user.balance = user.balance + data.amount

    # Create transaction record
    transaction = Transaction(
        user_id=user_id,
        amount=abs_amount,
        type=transaction_type,
        description=data.description or ("Пополнение баланса" if data.amount >= 0 else "Списание"),
    )
    db.add(transaction)

    await db.flush()
    await db.refresh(user)

    return user


@router.get("/{user_id}/transactions", response_model=TransactionListResponse)
async def get_user_transactions(
    user_id: int,
    db: DBSession,
    current_user: ManagerUser,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
) -> TransactionListResponse:
    """Get user's transaction history."""
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    query = select(Transaction).where(Transaction.user_id == user_id)
    count_query = select(func.count(Transaction.id)).where(Transaction.user_id == user_id)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * size
    query = query.offset(offset).limit(size).order_by(Transaction.created_at.desc())
    result = await db.execute(query)
    transactions = result.scalars().all()

    pages = (total + size - 1) // size if total > 0 else 1

    items = [
        TransactionResponse(
            id=t.id,
            amount=t.amount,
            type=t.type.value,
            description=t.description,
            lesson_id=t.lesson_id,
            created_at=t.created_at,
        )
        for t in transactions
    ]

    return TransactionListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{user_id}/groups", response_model=list[UserGroupResponse])
async def get_user_groups(
    user_id: int,
    db: DBSession,
    current_user: ManagerUser,
) -> list[UserGroupResponse]:
    """Get groups for a user."""
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # For students, return groups they are members of
    if user.role == UserRole.STUDENT:
        result = await db.execute(
            select(Group, GroupStudent.joined_at)
            .join(GroupStudent, GroupStudent.group_id == Group.id)
            .where(GroupStudent.student_id == user_id, Group.is_active == True)
            .order_by(Group.name)
        )
        groups_data = result.all()

        groups = []
        for group, joined_at in groups_data:
            teacher_name = None
            if group.teacher_id:
                teacher_result = await db.execute(
                    select(User.name).where(User.id == group.teacher_id)
                )
                teacher_name = teacher_result.scalar()

            groups.append(
                UserGroupResponse(
                    id=group.id,
                    name=group.name,
                    description=group.description,
                    teacher_name=teacher_name,
                    joined_at=joined_at,
                )
            )
        return groups

    # For teachers, return groups they teach
    elif user.role == UserRole.TEACHER:
        result = await db.execute(
            select(Group)
            .where(Group.teacher_id == user_id, Group.is_active == True)
            .order_by(Group.name)
        )
        groups = result.scalars().all()

        return [
            UserGroupResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                teacher_name=user.name,
                joined_at=group.created_at,
            )
            for group in groups
        ]

    return []
