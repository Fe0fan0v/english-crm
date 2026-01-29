from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, or_, and_, func, case
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, CurrentUser
from app.models.direct_message import DirectMessage
from app.models.teacher_student import TeacherStudent
from app.models.user import User, UserRole
from app.schemas.direct_message import (
    DirectMessageCreate,
    DirectMessageResponse,
    ConversationSummary,
    ConversationListResponse,
)
from app.utils.email import send_message_notification

router = APIRouter()


async def can_message_user(db, sender: User, recipient: User) -> bool:
    """Check if sender can message recipient based on their roles and assignments."""
    # Admins and managers can message anyone
    if sender.role in (UserRole.ADMIN, UserRole.MANAGER):
        return True

    # Teachers can message their assigned students
    if sender.role == UserRole.TEACHER and recipient.role == UserRole.STUDENT:
        result = await db.execute(
            select(TeacherStudent).where(
                TeacherStudent.teacher_id == sender.id,
                TeacherStudent.student_id == recipient.id,
            )
        )
        return result.scalar_one_or_none() is not None

    # Students can message their assigned teachers
    if sender.role == UserRole.STUDENT and recipient.role == UserRole.TEACHER:
        result = await db.execute(
            select(TeacherStudent).where(
                TeacherStudent.teacher_id == recipient.id,
                TeacherStudent.student_id == sender.id,
            )
        )
        return result.scalar_one_or_none() is not None

    # Students can message admins/managers (for support)
    if sender.role == UserRole.STUDENT and recipient.role in (UserRole.ADMIN, UserRole.MANAGER):
        return True

    # Teachers can message admins/managers
    if sender.role == UserRole.TEACHER and recipient.role in (UserRole.ADMIN, UserRole.MANAGER):
        return True

    return False


@router.get("/unread/count")
async def get_unread_count(
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Get total count of unread messages."""
    result = await db.execute(
        select(func.count(DirectMessage.id)).where(
            DirectMessage.recipient_id == current_user.id,
            DirectMessage.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": count}


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    db: DBSession,
    current_user: CurrentUser,
):
    """Get list of all conversations for current user."""
    user_id = current_user.id

    # Subquery to get the last message for each conversation
    # A conversation is identified by the pair of users
    subquery = (
        select(
            DirectMessage.id,
            DirectMessage.sender_id,
            DirectMessage.recipient_id,
            DirectMessage.content,
            DirectMessage.created_at,
            DirectMessage.is_read,
            case(
                (DirectMessage.sender_id == user_id, DirectMessage.recipient_id),
                else_=DirectMessage.sender_id,
            ).label("other_user_id"),
        )
        .where(
            or_(
                DirectMessage.sender_id == user_id,
                DirectMessage.recipient_id == user_id,
            )
        )
        .subquery()
    )

    # Get unique conversations with last message
    # Using a different approach: get all messages and process in Python
    result = await db.execute(
        select(DirectMessage)
        .where(
            or_(
                DirectMessage.sender_id == user_id,
                DirectMessage.recipient_id == user_id,
            )
        )
        .options(
            selectinload(DirectMessage.sender),
            selectinload(DirectMessage.recipient),
        )
        .order_by(DirectMessage.created_at.desc())
    )
    messages = result.scalars().all()

    # Group by conversation partner
    conversations: dict[int, dict] = {}
    for msg in messages:
        other_user_id = msg.recipient_id if msg.sender_id == user_id else msg.sender_id
        other_user = msg.recipient if msg.sender_id == user_id else msg.sender

        if other_user_id not in conversations:
            conversations[other_user_id] = {
                "user_id": other_user_id,
                "user_name": other_user.name,
                "user_photo_url": other_user.photo_url,
                "last_message": msg.content[:100],
                "last_message_at": msg.created_at,
                "unread_count": 0,
            }

        # Count unread messages (only those sent to current user)
        if msg.recipient_id == user_id and not msg.is_read:
            conversations[other_user_id]["unread_count"] += 1

    # Sort by last message time
    sorted_conversations = sorted(
        conversations.values(),
        key=lambda x: x["last_message_at"],
        reverse=True,
    )

    return ConversationListResponse(
        items=[ConversationSummary(**c) for c in sorted_conversations]
    )


@router.get("/{user_id}", response_model=list[DirectMessageResponse])
async def get_messages_with_user(
    user_id: int,
    db: DBSession,
    current_user: CurrentUser,
    limit: int = Query(50, ge=1, le=100),
    before_id: int | None = Query(None),
):
    """Get messages between current user and specified user."""
    current_id = current_user.id

    # Verify the other user exists
    other_user = await db.get(User, user_id)
    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    # Check if user can access this conversation
    if not await can_message_user(db, current_user, other_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к переписке с этим пользователем",
        )

    query = (
        select(DirectMessage)
        .where(
            or_(
                and_(
                    DirectMessage.sender_id == current_id,
                    DirectMessage.recipient_id == user_id,
                ),
                and_(
                    DirectMessage.sender_id == user_id,
                    DirectMessage.recipient_id == current_id,
                ),
            )
        )
        .options(
            selectinload(DirectMessage.sender),
            selectinload(DirectMessage.recipient),
        )
    )

    if before_id:
        query = query.where(DirectMessage.id < before_id)

    query = query.order_by(DirectMessage.created_at.desc()).limit(limit)

    result = await db.execute(query)
    messages = result.scalars().all()

    # Mark messages as read (those sent to current user)
    for msg in messages:
        if msg.recipient_id == current_id and not msg.is_read:
            msg.is_read = True

    await db.commit()

    # Return in chronological order
    return [
        DirectMessageResponse(
            id=msg.id,
            sender_id=msg.sender_id,
            sender_name=msg.sender.name,
            recipient_id=msg.recipient_id,
            recipient_name=msg.recipient.name,
            content=msg.content,
            file_url=msg.file_url,
            is_read=msg.is_read,
            created_at=msg.created_at,
        )
        for msg in reversed(messages)
    ]


@router.post("", response_model=DirectMessageResponse)
async def send_message(
    data: DirectMessageCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Send a direct message to another user."""
    # Verify recipient exists
    recipient = await db.get(User, data.recipient_id)
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient not found",
        )

    # Can't send message to yourself
    if data.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to yourself",
        )

    # Check if user is allowed to message this recipient
    if not await can_message_user(db, current_user, recipient):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к переписке с этим пользователем",
        )

    # Validate that message has content or file
    if not data.content.strip() and not data.file_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message must have content or file",
        )

    message = DirectMessage(
        sender_id=current_user.id,
        recipient_id=data.recipient_id,
        content=data.content,
        file_url=data.file_url,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    # Get sender info
    sender = await db.get(User, current_user.id)

    # Send email notification if recipient is a student
    if recipient.role == UserRole.STUDENT and recipient.email:
        # Prepare message preview
        message_preview = data.content[:100] if data.content else "[Файл]"
        if len(data.content) > 100:
            message_preview += "..."

        # Send email asynchronously (don't wait for it)
        try:
            await send_message_notification(
                recipient_email=recipient.email,
                recipient_name=recipient.name,
                sender_name=sender.name,
                message_preview=message_preview,
            )
        except Exception as e:
            # Log error but don't fail the request
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Failed to send email notification: {str(e)}")

    return DirectMessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        sender_name=sender.name,
        recipient_id=message.recipient_id,
        recipient_name=recipient.name,
        content=message.content,
        file_url=message.file_url,
        is_read=message.is_read,
        created_at=message.created_at,
    )
