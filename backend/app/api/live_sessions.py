import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DBSession, TeacherUser
from app.database import get_db
from app.models import Lesson, LessonStudent, User
from app.models.user import UserRole
from app.schemas.live_session import (
    LiveSessionActiveCheck,
    LiveSessionCreate,
    LiveSessionResponse,
)
from app.utils.security import decode_access_token

router = APIRouter()


@dataclass
class LiveSessionInfo:
    lesson_id: int
    interactive_lesson_id: int
    teacher_id: int
    student_id: int
    teacher_name: str
    created_at: datetime = field(default_factory=datetime.now)
    teacher_ws: WebSocket | None = None
    student_ws: WebSocket | None = None
    _cleanup_task: asyncio.Task | None = field(default=None, repr=False)


# In-memory session store
active_sessions: dict[int, LiveSessionInfo] = {}  # lesson_id -> session
user_session_map: dict[int, int] = {}  # user_id -> lesson_id


def _cleanup_session(lesson_id: int) -> None:
    """Remove session from stores."""
    session = active_sessions.pop(lesson_id, None)
    if session:
        user_session_map.pop(session.teacher_id, None)
        user_session_map.pop(session.student_id, None)
        if session._cleanup_task and not session._cleanup_task.done():
            session._cleanup_task.cancel()


async def _delayed_cleanup(lesson_id: int, delay: float = 60.0) -> None:
    """Cleanup session after delay if no one reconnects."""
    await asyncio.sleep(delay)
    session = active_sessions.get(lesson_id)
    if session and session.teacher_ws is None and session.student_ws is None:
        _cleanup_session(lesson_id)


@router.post("/", response_model=LiveSessionResponse)
async def create_live_session(
    data: LiveSessionCreate,
    db: DBSession,
    current_user: TeacherUser,
):
    """Teacher creates a live session for a lesson."""
    # Check no active session for this lesson
    if data.lesson_id in active_sessions:
        raise HTTPException(status_code=409, detail="Active session already exists for this lesson")

    # Verify lesson exists and current user is the teacher (or admin/manager)
    result = await db.execute(
        select(Lesson)
        .where(Lesson.id == data.lesson_id)
        .options(selectinload(Lesson.students))
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    if current_user.role == UserRole.TEACHER and lesson.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not the teacher of this lesson")

    # Verify student is in this lesson
    student_ids = [s.student_id for s in lesson.students]
    if data.student_id not in student_ids:
        raise HTTPException(status_code=400, detail="Student is not in this lesson")

    # Create session
    session = LiveSessionInfo(
        lesson_id=data.lesson_id,
        interactive_lesson_id=data.interactive_lesson_id,
        teacher_id=current_user.id if current_user.role == UserRole.TEACHER else lesson.teacher_id,
        student_id=data.student_id,
        teacher_name=current_user.name,
    )
    active_sessions[data.lesson_id] = session
    user_session_map[session.teacher_id] = data.lesson_id
    user_session_map[data.student_id] = data.lesson_id

    return LiveSessionResponse(
        lesson_id=session.lesson_id,
        interactive_lesson_id=session.interactive_lesson_id,
        teacher_id=session.teacher_id,
        student_id=session.student_id,
        teacher_name=session.teacher_name,
        created_at=session.created_at,
        teacher_connected=False,
        student_connected=False,
    )


@router.get("/active", response_model=LiveSessionActiveCheck)
async def check_active_session(
    current_user: CurrentUser,
):
    """Check if there's an active live session for current user (polling by student)."""
    lesson_id = user_session_map.get(current_user.id)
    if lesson_id and lesson_id in active_sessions:
        session = active_sessions[lesson_id]
        return LiveSessionActiveCheck(
            active=True,
            lesson_id=session.lesson_id,
            interactive_lesson_id=session.interactive_lesson_id,
            teacher_name=session.teacher_name,
        )
    return LiveSessionActiveCheck(active=False)


@router.delete("/{lesson_id}")
async def end_live_session(
    lesson_id: int,
    current_user: TeacherUser,
):
    """Teacher ends a live session."""
    session = active_sessions.get(lesson_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if current_user.role == UserRole.TEACHER and session.teacher_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Notify both sides
    end_msg = json.dumps({"type": "session_end", "reason": "teacher_ended"})
    for ws in [session.teacher_ws, session.student_ws]:
        if ws:
            try:
                await ws.send_text(end_msg)
            except Exception:
                pass

    _cleanup_session(lesson_id)
    return {"status": "ok"}


@router.websocket("/ws/{lesson_id}")
async def websocket_live_session(
    websocket: WebSocket,
    lesson_id: int,
    token: str = Query(...),
):
    """WebSocket endpoint for live session communication."""
    # Authenticate
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

    # Verify user
    async with AsyncSession(bind=websocket.app.state.engine) as db:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if not user or not user.is_active:
            await websocket.close(code=4001, reason="User not found or inactive")
            return

    # Verify session exists
    session = active_sessions.get(lesson_id)
    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Determine role
    if user_id == session.teacher_id:
        role = "teacher"
    elif user_id == session.student_id:
        role = "student"
    else:
        await websocket.close(code=4003, reason="Access denied")
        return

    # Cancel pending cleanup if any
    if session._cleanup_task and not session._cleanup_task.done():
        session._cleanup_task.cancel()
        session._cleanup_task = None

    # Accept connection
    await websocket.accept()

    # Check if this is a reconnect
    is_reconnect = False
    if role == "teacher":
        is_reconnect = session.teacher_ws is not None
        session.teacher_ws = websocket
    else:
        is_reconnect = session.student_ws is not None
        session.student_ws = websocket

    # Notify peer
    peer_ws = session.student_ws if role == "teacher" else session.teacher_ws
    event_type = "peer_reconnected" if is_reconnect else "peer_joined"
    if peer_ws:
        try:
            await peer_ws.send_text(json.dumps({
                "type": event_type,
                "user_id": user_id,
                "role": role,
                "name": user.name,
            }))
        except Exception:
            pass

    # Notify the connecting user about peer status
    peer_role = "student" if role == "teacher" else "teacher"
    peer_connected = (session.student_ws is not None) if role == "teacher" else (session.teacher_ws is not None)
    if peer_connected:
        try:
            peer_user_id = session.student_id if role == "teacher" else session.teacher_id
            await websocket.send_text(json.dumps({
                "type": "peer_joined",
                "user_id": peer_user_id,
                "role": peer_role,
                "name": session.teacher_name if peer_role == "teacher" else "Student",
            }))
        except Exception:
            pass

    try:
        while True:
            data = await websocket.receive_text()

            # Handle ping
            if data == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
                continue

            # Relay message to peer
            peer_ws = session.student_ws if role == "teacher" else session.teacher_ws
            if peer_ws:
                try:
                    await peer_ws.send_text(data)
                except Exception:
                    pass

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Clear the WS reference
        if role == "teacher" and session.teacher_ws == websocket:
            session.teacher_ws = None
        elif role == "student" and session.student_ws == websocket:
            session.student_ws = None

        # Notify peer about disconnect
        peer_ws = session.student_ws if role == "teacher" else session.teacher_ws
        if peer_ws:
            try:
                await peer_ws.send_text(json.dumps({
                    "type": "peer_disconnected",
                    "user_id": user_id,
                    "role": role,
                }))
            except Exception:
                pass

        # Start cleanup timer if both disconnected
        if session.teacher_ws is None and session.student_ws is None:
            session._cleanup_task = asyncio.create_task(
                _delayed_cleanup(lesson_id, delay=60.0)
            )
