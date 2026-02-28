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
    student_ids: set[int]
    teacher_name: str
    created_at: datetime = field(default_factory=datetime.now)
    teacher_ws: WebSocket | None = None
    student_wss: dict[int, WebSocket | None] = field(default_factory=dict)
    _cleanup_task: asyncio.Task | None = field(default=None, repr=False)


# In-memory session store
active_sessions: dict[int, LiveSessionInfo] = {}  # lesson_id -> session
user_session_map: dict[int, int] = {}  # user_id -> lesson_id


def _cleanup_session(lesson_id: int) -> None:
    """Remove session from stores."""
    session = active_sessions.pop(lesson_id, None)
    if session:
        user_session_map.pop(session.teacher_id, None)
        for sid in session.student_ids:
            user_session_map.pop(sid, None)
        if session._cleanup_task and not session._cleanup_task.done():
            session._cleanup_task.cancel()


async def _delayed_cleanup(lesson_id: int, delay: float = 60.0) -> None:
    """Cleanup session after delay if no one reconnects."""
    await asyncio.sleep(delay)
    session = active_sessions.get(lesson_id)
    if session and session.teacher_ws is None and all(ws is None for ws in session.student_wss.values()):
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

    # All students of the lesson participate
    student_ids = {s.student_id for s in lesson.students}
    if not student_ids:
        raise HTTPException(status_code=400, detail="No students in this lesson")

    # Create session
    teacher_id = current_user.id if current_user.role == UserRole.TEACHER else lesson.teacher_id
    session = LiveSessionInfo(
        lesson_id=data.lesson_id,
        interactive_lesson_id=data.interactive_lesson_id,
        teacher_id=teacher_id,
        student_ids=student_ids,
        teacher_name=current_user.name,
    )
    active_sessions[data.lesson_id] = session
    user_session_map[teacher_id] = data.lesson_id
    for sid in student_ids:
        user_session_map[sid] = data.lesson_id

    return LiveSessionResponse(
        lesson_id=session.lesson_id,
        interactive_lesson_id=session.interactive_lesson_id,
        teacher_id=session.teacher_id,
        student_ids=sorted(session.student_ids),
        teacher_name=session.teacher_name,
        created_at=session.created_at,
        teacher_connected=False,
        students_connected=0,
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

    # Notify all participants
    end_msg = json.dumps({"type": "session_end", "reason": "teacher_ended"})
    all_wss = [session.teacher_ws] + list(session.student_wss.values())
    for ws in all_wss:
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
    elif user_id in session.student_ids:
        role = "student"
    else:
        await websocket.close(code=4003, reason="Access denied")
        return

    is_group = len(session.student_ids) > 1

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
        is_reconnect = session.student_wss.get(user_id) is not None
        session.student_wss[user_id] = websocket

    # Broadcast peer_joined/peer_reconnected to all other connected participants
    event_type = "peer_reconnected" if is_reconnect else "peer_joined"
    join_msg = json.dumps({
        "type": event_type,
        "user_id": user_id,
        "role": role,
        "name": user.name,
    })
    if role == "teacher":
        # Notify all connected students
        for sws in session.student_wss.values():
            if sws:
                try:
                    await sws.send_text(join_msg)
                except Exception:
                    pass
    else:
        # Notify teacher
        if session.teacher_ws:
            try:
                await session.teacher_ws.send_text(join_msg)
            except Exception:
                pass
        # Notify other connected students
        for sid, sws in session.student_wss.items():
            if sws and sid != user_id:
                try:
                    await sws.send_text(join_msg)
                except Exception:
                    pass

    # Notify the connecting user about already-connected peers
    if role == "teacher":
        for sid, sws in session.student_wss.items():
            if sws and sid != user_id:
                try:
                    await websocket.send_text(json.dumps({
                        "type": "peer_joined",
                        "user_id": sid,
                        "role": "student",
                        "name": "Student",
                    }))
                except Exception:
                    pass
    else:
        # Notify student about teacher
        if session.teacher_ws:
            try:
                await websocket.send_text(json.dumps({
                    "type": "peer_joined",
                    "user_id": session.teacher_id,
                    "role": "teacher",
                    "name": session.teacher_name,
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

            if role == "teacher":
                # Teacher → broadcast to all connected students
                for sws in session.student_wss.values():
                    if sws:
                        try:
                            await sws.send_text(data)
                        except Exception:
                            pass
            else:
                if is_group:
                    # Group: student messages NOT relayed (independent work)
                    pass
                else:
                    # 1:1: relay student → teacher
                    if session.teacher_ws:
                        try:
                            await session.teacher_ws.send_text(data)
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
        elif role == "student" and session.student_wss.get(user_id) == websocket:
            session.student_wss[user_id] = None

        # Broadcast disconnect to all remaining connected participants
        disconnect_msg = json.dumps({
            "type": "peer_disconnected",
            "user_id": user_id,
            "role": role,
        })
        if role == "teacher":
            for sws in session.student_wss.values():
                if sws:
                    try:
                        await sws.send_text(disconnect_msg)
                    except Exception:
                        pass
        else:
            if session.teacher_ws:
                try:
                    await session.teacher_ws.send_text(disconnect_msg)
                except Exception:
                    pass
            for sid, sws in session.student_wss.items():
                if sws and sid != user_id:
                    try:
                        await sws.send_text(disconnect_msg)
                    except Exception:
                        pass

        # Start cleanup timer if all disconnected
        all_students_disconnected = all(ws is None for ws in session.student_wss.values())
        if session.teacher_ws is None and all_students_disconnected:
            session._cleanup_task = asyncio.create_task(
                _delayed_cleanup(lesson_id, delay=60.0)
            )
