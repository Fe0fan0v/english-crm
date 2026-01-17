import json
from collections import defaultdict
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession
from app.database import get_db
from app.models import Group, GroupMessage, GroupStudent, User
from app.models.user import UserRole
from app.schemas.group_message import (
    GroupMessageCreate,
    GroupMessageResponse,
    GroupMessagesListResponse,
)
from app.utils.security import decode_access_token

router = APIRouter()


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        # group_id -> list of (websocket, user_id)
        self.active_connections: dict[int, list[tuple[WebSocket, int]]] = defaultdict(list)

    async def connect(self, websocket: WebSocket, group_id: int, user_id: int):
        await websocket.accept()
        self.active_connections[group_id].append((websocket, user_id))

    def disconnect(self, websocket: WebSocket, group_id: int):
        self.active_connections[group_id] = [
            (ws, uid) for ws, uid in self.active_connections[group_id]
            if ws != websocket
        ]

    async def broadcast_to_group(self, group_id: int, message: dict):
        """Send message to all connections in a group."""
        for websocket, _ in self.active_connections[group_id]:
            try:
                await websocket.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


async def verify_group_access(group_id: int, user: User, db: AsyncSession) -> Group:
    """Verify user has access to group messages."""
    result = await db.execute(
        select(Group).where(and_(Group.id == group_id, Group.is_active == True))
    )
    group = result.scalar_one_or_none()

    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Admin/Manager always have access
    if user.role in [UserRole.ADMIN, UserRole.MANAGER]:
        return group

    # Teacher access - must be the group's teacher
    if user.role == UserRole.TEACHER:
        if group.teacher_id == user.id:
            return group
        raise HTTPException(status_code=403, detail="Access denied")

    # Student access - must be a member of the group
    if user.role == UserRole.STUDENT:
        gs_result = await db.execute(
            select(GroupStudent).where(
                and_(
                    GroupStudent.group_id == group_id,
                    GroupStudent.student_id == user.id,
                )
            )
        )
        if gs_result.scalar_one_or_none():
            return group
        raise HTTPException(status_code=403, detail="Access denied")

    raise HTTPException(status_code=403, detail="Access denied")


@router.get("/{group_id}/messages", response_model=GroupMessagesListResponse)
async def get_group_messages(
    group_id: int,
    db: DBSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
):
    """Get messages for a group (paginated, newest first)."""
    await verify_group_access(group_id, current_user, db)

    # Count total messages
    count_result = await db.execute(
        select(func.count(GroupMessage.id)).where(GroupMessage.group_id == group_id)
    )
    total = count_result.scalar() or 0

    # Get messages with pagination (newest first)
    offset = (page - 1) * size
    result = await db.execute(
        select(GroupMessage)
        .where(GroupMessage.group_id == group_id)
        .options(selectinload(GroupMessage.sender))
        .order_by(GroupMessage.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    messages = result.scalars().all()

    # Reverse to show oldest first in the batch
    messages = list(reversed(messages))

    has_more = (page * size) < total

    return GroupMessagesListResponse(
        items=[
            GroupMessageResponse(
                id=msg.id,
                group_id=msg.group_id,
                sender_id=msg.sender_id,
                sender_name=msg.sender.name,
                content=msg.content,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
        total=total,
        has_more=has_more,
    )


@router.post("/{group_id}/messages", response_model=GroupMessageResponse)
async def send_group_message(
    group_id: int,
    data: GroupMessageCreate,
    db: DBSession,
    current_user: CurrentUser,
):
    """Send a message to a group (REST endpoint, fallback for WebSocket)."""
    await verify_group_access(group_id, current_user, db)

    # Create message
    message = GroupMessage(
        group_id=group_id,
        sender_id=current_user.id,
        content=data.content,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    response = GroupMessageResponse(
        id=message.id,
        group_id=message.group_id,
        sender_id=message.sender_id,
        sender_name=current_user.name,
        content=message.content,
        created_at=message.created_at,
    )

    # Broadcast to WebSocket connections
    await manager.broadcast_to_group(
        group_id,
        {
            "type": "new_message",
            "message": response.model_dump(mode="json"),
        },
    )

    return response


@router.websocket("/ws/{group_id}/chat")
async def websocket_chat(
    websocket: WebSocket,
    group_id: int,
    token: str = Query(...),
):
    """
    WebSocket endpoint for real-time group chat.

    Connect with: ws://host/api/groups/ws/{group_id}/chat?token=<jwt_token>
    """
    # Authenticate user
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4001, reason="Invalid token")
        return

    user_id_str = payload.get("sub")
    if not user_id_str:
        await websocket.close(code=4001, reason="Invalid token")
        return

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Get user and verify access
    async with AsyncSession(bind=websocket.app.state.engine) as db:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()

        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return

        try:
            await verify_group_access(group_id, user, db)
        except HTTPException:
            await websocket.close(code=4003, reason="Access denied")
            return

    # Connect to the group
    await manager.connect(websocket, group_id, user_id)

    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            message_data = json.loads(data)

            if message_data.get("type") == "message":
                content = message_data.get("content", "").strip()
                if not content:
                    continue

                # Save message to database
                async with AsyncSession(bind=websocket.app.state.engine) as db:
                    message = GroupMessage(
                        group_id=group_id,
                        sender_id=user_id,
                        content=content[:5000],  # Limit content length
                    )
                    db.add(message)
                    await db.commit()
                    await db.refresh(message)

                    # Get sender name
                    user_result = await db.execute(select(User).where(User.id == user_id))
                    sender = user_result.scalar_one()

                    response = {
                        "type": "new_message",
                        "message": {
                            "id": message.id,
                            "group_id": message.group_id,
                            "sender_id": message.sender_id,
                            "sender_name": sender.name,
                            "content": message.content,
                            "created_at": message.created_at.isoformat(),
                        },
                    }

                    # Broadcast to all group members
                    await manager.broadcast_to_group(group_id, response)

    except WebSocketDisconnect:
        manager.disconnect(websocket, group_id)
    except Exception:
        manager.disconnect(websocket, group_id)
