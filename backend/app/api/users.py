import os
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, UploadFile, status
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DBSession, ManagerUser, TeacherUser
from app.api.uploads import (
    ALLOWED_PHOTO_EXTENSIONS,
    MAX_PHOTO_FILE_SIZE,
    _upload_file_to_storage,
)
from app.config import settings
from app.models.group import Group, GroupStudent
from app.models.teacher_student import TeacherStudent
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
from app.services.s3_storage import s3_storage
from app.utils.security import get_password_hash

router = APIRouter()


@router.get("", response_model=UserListResponse)
async def list_users(
    db: DBSession,
    current_user: TeacherUser,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    role: str | None = Query(None),
) -> UserListResponse:
    """List all users with pagination and search. Available for teachers, managers, and admins."""
    query = select(User).where(User.is_active == True)
    count_query = select(func.count(User.id)).where(User.is_active == True)

    # Filter by role if specified
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

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
    # Manager can only create teacher and student users
    if current_user.role == UserRole.MANAGER and user_data.role in (
        UserRole.ADMIN,
        UserRole.MANAGER,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Менеджер может создавать только учителей и учеников",
        )

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

    # Create teacher-student assignment if teacher_id provided for student
    if user_data.teacher_id and user_data.role == UserRole.STUDENT:
        assignment = TeacherStudent(teacher_id=user_data.teacher_id, student_id=user.id)
        db.add(assignment)
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

    # Check if balance would go negative
    new_balance = user.balance + data.amount
    if new_balance < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недостаточно средств. Текущий баланс: {user.balance} тг",
        )

    # Determine transaction type
    transaction_type = TransactionType.CREDIT if data.amount >= 0 else TransactionType.DEBIT
    abs_amount = abs(data.amount)

    # Update balance
    user.balance = new_balance

    # Create transaction record
    transaction = Transaction(
        user_id=user_id,
        amount=abs_amount,
        type=transaction_type,
        description=data.description or ("Пополнение баланса" if data.amount >= 0 else "Списание"),
        created_by_id=current_user.id,
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


@router.post("/teachers/reset-balances")
async def reset_teachers_balances(
    db: DBSession,
    current_user: ManagerUser,
) -> dict:
    """Reset balance to zero for all teachers."""
    # Get all teachers with non-zero balance
    result = await db.execute(
        select(User).where(
            User.role == UserRole.TEACHER,
            User.balance != Decimal("0"),
        )
    )
    teachers = result.scalars().all()

    reset_count = 0
    total_amount = Decimal("0")

    for teacher in teachers:
        old_balance = teacher.balance
        total_amount += old_balance

        # Create transaction for the reset
        transaction = Transaction(
            user_id=teacher.id,
            amount=abs(old_balance),
            type=TransactionType.DEBIT if old_balance > 0 else TransactionType.CREDIT,
            description="Обнуление баланса (конец периода)",
            created_by_id=current_user.id,
        )
        db.add(transaction)

        # Reset balance
        teacher.balance = Decimal("0")
        reset_count += 1

    await db.flush()

    return {
        "message": f"Баланс обнулён у {reset_count} преподавателей",
        "reset_count": reset_count,
        "total_amount": str(total_amount),
    }


@router.post("/{user_id}/photo", response_model=UserResponse)
async def upload_user_photo(
    user_id: int,
    file: UploadFile,
    db: DBSession,
    current_user: CurrentUser,
) -> User:
    """Upload a profile photo for a user."""
    # Check permissions: user can upload own photo, or manager can upload for anyone
    is_manager = current_user.role in (UserRole.ADMIN, UserRole.MANAGER)
    if current_user.id != user_id and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only upload your own photo",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Validate file
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    # Read file content
    content = await file.read()

    # Delete old photo if exists
    if user.photo_url:
        if s3_storage.enabled and user.photo_url.startswith("http"):
            try:
                s3_storage.delete_file(user.photo_url)
            except Exception:
                pass  # Ignore deletion errors for old photos
        else:
            old_filename = user.photo_url.split("/")[-1]
            old_file_path = Path(settings.storage_path) / "photos" / old_filename
            if old_file_path.exists():
                os.remove(old_file_path)

    # Upload via shared helper (S3 or local)
    file_url = await _upload_file_to_storage(
        content, file.filename, "photos", ALLOWED_PHOTO_EXTENSIONS, MAX_PHOTO_FILE_SIZE
    )

    # Update user photo_url
    user.photo_url = file_url

    await db.flush()
    await db.refresh(user)

    return user


@router.delete("/{user_id}/photo", response_model=UserResponse)
async def delete_user_photo(
    user_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> User:
    """Delete a user's profile photo."""
    # Check permissions: user can delete own photo, or manager can delete for anyone
    is_manager = current_user.role in (UserRole.ADMIN, UserRole.MANAGER)
    if current_user.id != user_id and not is_manager:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own photo",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if not user.photo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User has no photo",
        )

    # Delete the file from S3 or local storage
    if s3_storage.enabled and user.photo_url.startswith("http"):
        try:
            s3_storage.delete_file(user.photo_url)
        except Exception:
            pass  # Ignore deletion errors
    else:
        uploads_dir = Path(settings.storage_path) / "photos"
        filename = user.photo_url.split("/")[-1]
        file_path = uploads_dir / filename
        if file_path.exists():
            os.remove(file_path)

    # Clear photo_url
    user.photo_url = None

    await db.flush()
    await db.refresh(user)

    return user
