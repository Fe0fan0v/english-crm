from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import DBSession, ManagerUser
from app.models.group import Group, GroupStudent
from app.models.user import User, UserRole
from app.schemas.group import (
    GroupCreate,
    GroupDetailResponse,
    GroupListResponse,
    GroupResponse,
    GroupStudentAdd,
    GroupStudentRemove,
    GroupStudentResponse,
    GroupUpdate,
)

router = APIRouter()


@router.get("", response_model=GroupListResponse)
async def list_groups(
    db: DBSession,
    current_user: ManagerUser,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    teacher_id: int | None = Query(None),
) -> GroupListResponse:
    """List all groups with pagination and search."""
    query = select(Group).where(Group.is_active == True)
    count_query = select(func.count(Group.id)).where(Group.is_active == True)

    if search:
        search_filter = or_(
            Group.name.ilike(f"%{search}%"),
            Group.description.ilike(f"%{search}%"),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if teacher_id:
        query = query.where(Group.teacher_id == teacher_id)
        count_query = count_query.where(Group.teacher_id == teacher_id)

    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    offset = (page - 1) * size
    query = query.offset(offset).limit(size).order_by(Group.created_at.desc())
    result = await db.execute(query)
    groups = result.scalars().all()

    # Build response with teacher names and student counts
    items = []
    for group in groups:
        teacher_name = None
        if group.teacher_id:
            teacher_result = await db.execute(
                select(User.name).where(User.id == group.teacher_id)
            )
            teacher_name = teacher_result.scalar()

        # Count students
        students_count_result = await db.execute(
            select(func.count(GroupStudent.id)).where(GroupStudent.group_id == group.id)
        )
        students_count = students_count_result.scalar() or 0

        items.append(
            GroupResponse(
                id=group.id,
                name=group.name,
                description=group.description,
                teacher_id=group.teacher_id,
                teacher_name=teacher_name,
                students_count=students_count,
                is_active=group.is_active,
                created_at=group.created_at,
                updated_at=group.updated_at,
            )
        )

    pages = (total + size - 1) // size if total > 0 else 1

    return GroupListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group(
    group_id: int,
    db: DBSession,
    current_user: ManagerUser,
) -> GroupDetailResponse:
    """Get a specific group by ID with students."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    teacher_name = None
    if group.teacher_id:
        teacher_result = await db.execute(
            select(User.name).where(User.id == group.teacher_id)
        )
        teacher_name = teacher_result.scalar()

    # Get students
    students_result = await db.execute(
        select(GroupStudent, User)
        .join(User, GroupStudent.student_id == User.id)
        .where(GroupStudent.group_id == group_id)
        .order_by(User.name)
    )
    students_data = students_result.all()

    students = [
        GroupStudentResponse(
            id=gs.id,
            student_id=user.id,
            student_name=user.name,
            student_email=user.email,
            balance=user.balance,
            joined_at=gs.joined_at,
        )
        for gs, user in students_data
    ]

    return GroupDetailResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        teacher_id=group.teacher_id,
        teacher_name=teacher_name,
        students=students,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_data: GroupCreate,
    db: DBSession,
    current_user: ManagerUser,
) -> GroupResponse:
    """Create a new group."""
    # Validate teacher if provided
    if group_data.teacher_id:
        teacher_result = await db.execute(
            select(User).where(
                User.id == group_data.teacher_id,
                User.role == UserRole.TEACHER,
                User.is_active == True,
            )
        )
        teacher = teacher_result.scalar_one_or_none()
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid teacher ID",
            )

    group = Group(
        name=group_data.name,
        description=group_data.description,
        teacher_id=group_data.teacher_id,
    )

    db.add(group)
    await db.flush()
    await db.refresh(group)

    teacher_name = None
    if group.teacher_id:
        teacher_result = await db.execute(
            select(User.name).where(User.id == group.teacher_id)
        )
        teacher_name = teacher_result.scalar()

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        teacher_id=group.teacher_id,
        teacher_name=teacher_name,
        students_count=0,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    group_data: GroupUpdate,
    db: DBSession,
    current_user: ManagerUser,
) -> GroupResponse:
    """Update a group."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    update_data = group_data.model_dump(exclude_unset=True)

    # Validate teacher if changing
    if "teacher_id" in update_data and update_data["teacher_id"] is not None:
        teacher_result = await db.execute(
            select(User).where(
                User.id == update_data["teacher_id"],
                User.role == UserRole.TEACHER,
                User.is_active == True,
            )
        )
        teacher = teacher_result.scalar_one_or_none()
        if not teacher:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid teacher ID",
            )

    for field, value in update_data.items():
        setattr(group, field, value)

    await db.flush()
    await db.refresh(group)

    teacher_name = None
    if group.teacher_id:
        teacher_result = await db.execute(
            select(User.name).where(User.id == group.teacher_id)
        )
        teacher_name = teacher_result.scalar()

    students_count_result = await db.execute(
        select(func.count(GroupStudent.id)).where(GroupStudent.group_id == group.id)
    )
    students_count = students_count_result.scalar() or 0

    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        teacher_id=group.teacher_id,
        teacher_name=teacher_name,
        students_count=students_count,
        is_active=group.is_active,
        created_at=group.created_at,
        updated_at=group.updated_at,
    )


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    db: DBSession,
    current_user: ManagerUser,
) -> None:
    """Delete a group (soft delete)."""
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    group.is_active = False
    await db.flush()


@router.post("/{group_id}/students", response_model=GroupDetailResponse)
async def add_students_to_group(
    group_id: int,
    data: GroupStudentAdd,
    db: DBSession,
    current_user: ManagerUser,
) -> GroupDetailResponse:
    """Add students to a group."""
    result = await db.execute(select(Group).where(Group.id == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Validate all students exist and are students
    students_result = await db.execute(
        select(User).where(
            User.id.in_(data.student_ids),
            User.role == UserRole.STUDENT,
            User.is_active == True,
        )
    )
    valid_students = students_result.scalars().all()
    valid_student_ids = {s.id for s in valid_students}

    if len(valid_student_ids) != len(data.student_ids):
        invalid_ids = set(data.student_ids) - valid_student_ids
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid student IDs: {invalid_ids}",
        )

    # Get existing group students
    existing_result = await db.execute(
        select(GroupStudent.student_id).where(GroupStudent.group_id == group_id)
    )
    existing_student_ids = {row[0] for row in existing_result.all()}

    # Add new students
    for student_id in data.student_ids:
        if student_id not in existing_student_ids:
            group_student = GroupStudent(
                group_id=group_id,
                student_id=student_id,
            )
            db.add(group_student)

    await db.flush()

    # Return updated group details
    return await get_group(group_id, db, current_user)


@router.delete("/{group_id}/students", response_model=GroupDetailResponse)
async def remove_students_from_group(
    group_id: int,
    data: GroupStudentRemove,
    db: DBSession,
    current_user: ManagerUser,
) -> GroupDetailResponse:
    """Remove students from a group."""
    result = await db.execute(select(Group).where(Group.id == group_id, Group.is_active == True))
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found",
        )

    # Delete group students
    group_students_result = await db.execute(
        select(GroupStudent).where(
            GroupStudent.group_id == group_id,
            GroupStudent.student_id.in_(data.student_ids),
        )
    )
    group_students = group_students_result.scalars().all()

    for gs in group_students:
        await db.delete(gs)

    await db.flush()

    # Return updated group details
    return await get_group(group_id, db, current_user)
