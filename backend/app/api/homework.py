from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy import select

from app.api.deps import DBSession, StudentOnlyUser, TeacherUser
from app.models.course import ExerciseBlock, InteractiveLesson
from app.models.exercise_result import ExerciseResult
from app.models.homework import HomeworkAssignment, HomeworkStatus
from app.models.lesson import Lesson, LessonStudent
from app.models.user import User
from app.schemas.homework import (
    HomeworkAssign,
    HomeworkAssignmentResponse,
    StudentHomeworkItem,
)

router = APIRouter()

INTERACTIVE_TYPES = {
    "fill_gaps",
    "test",
    "true_false",
    "word_order",
    "matching",
    "image_choice",
    "essay",
    "flashcards",
    "drag_words",
}


async def _count_interactive_blocks(db, interactive_lesson_id: int) -> int:
    """Count interactive blocks in an interactive lesson."""
    result = await db.execute(
        select(sa_func.count(ExerciseBlock.id)).where(
            ExerciseBlock.lesson_id == interactive_lesson_id,
            ExerciseBlock.block_type.in_(INTERACTIVE_TYPES),
        )
    )
    return result.scalar() or 0


async def _count_student_progress(
    db, student_id: int, interactive_lesson_id: int
) -> int:
    """Count how many interactive blocks a student has answered."""
    result = await db.execute(
        select(sa_func.count(ExerciseResult.id)).where(
            ExerciseResult.student_id == student_id,
            ExerciseResult.lesson_id == interactive_lesson_id,
        )
    )
    return result.scalar() or 0


def _compute_status(hw: HomeworkAssignment, progress: int) -> str:
    """Return display status: in_progress is computed on the fly."""
    if hw.status == HomeworkStatus.PENDING and progress > 0:
        return "in_progress"
    return hw.status.value


# ── Teacher endpoints ───────────────────────────────────────────────


@router.post(
    "/homework/lessons/{lesson_id}/assign",
    response_model=list[HomeworkAssignmentResponse],
)
async def assign_homework(
    lesson_id: int,
    data: HomeworkAssign,
    current_user: TeacherUser,
    db: DBSession,
):
    """Assign an interactive lesson as homework to students of a lesson."""
    # Verify lesson exists
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Verify interactive lesson exists
    interactive_lesson = await db.get(InteractiveLesson, data.interactive_lesson_id)
    if not interactive_lesson:
        raise HTTPException(status_code=404, detail="Interactive lesson not found")

    # Get students of this lesson
    result = await db.execute(
        select(LessonStudent.student_id).where(LessonStudent.lesson_id == lesson_id)
    )
    all_student_ids = {row[0] for row in result.all()}

    if data.student_ids:
        target_ids = set(data.student_ids) & all_student_ids
    else:
        target_ids = all_student_ids

    if not target_ids:
        raise HTTPException(status_code=400, detail="No valid students for assignment")

    # Create assignments (skip duplicates)
    created = []
    for sid in target_ids:
        existing = await db.execute(
            select(HomeworkAssignment).where(
                HomeworkAssignment.lesson_id == lesson_id,
                HomeworkAssignment.interactive_lesson_id == data.interactive_lesson_id,
                HomeworkAssignment.student_id == sid,
            )
        )
        if existing.scalar_one_or_none():
            continue

        hw = HomeworkAssignment(
            lesson_id=lesson_id,
            interactive_lesson_id=data.interactive_lesson_id,
            student_id=sid,
            assigned_by=current_user.id,
        )
        db.add(hw)
        created.append(hw)

    await db.flush()

    # Build response
    total_blocks = await _count_interactive_blocks(db, data.interactive_lesson_id)
    users_result = await db.execute(
        select(User).where(User.id.in_(target_ids))
    )
    users_map = {u.id: u for u in users_result.scalars().all()}

    response = []
    # Return all assignments for this lesson + interactive_lesson (including pre-existing)
    all_hw_result = await db.execute(
        select(HomeworkAssignment).where(
            HomeworkAssignment.lesson_id == lesson_id,
            HomeworkAssignment.interactive_lesson_id == data.interactive_lesson_id,
        )
    )
    for hw in all_hw_result.scalars().all():
        progress = await _count_student_progress(
            db, hw.student_id, hw.interactive_lesson_id
        )
        user = users_map.get(hw.student_id)
        response.append(
            HomeworkAssignmentResponse(
                id=hw.id,
                lesson_id=hw.lesson_id,
                lesson_title=lesson.title,
                interactive_lesson_id=hw.interactive_lesson_id,
                interactive_lesson_title=interactive_lesson.title or "",
                student_id=hw.student_id,
                student_name=user.name if user else f"User #{hw.student_id}",
                status=_compute_status(hw, progress),
                progress=progress,
                total_blocks=total_blocks,
                assigned_at=hw.assigned_at,
                submitted_at=hw.submitted_at,
                accepted_at=hw.accepted_at,
            )
        )

    await db.commit()
    return response


@router.get(
    "/homework/lessons/{lesson_id}",
    response_model=list[HomeworkAssignmentResponse],
)
async def get_lesson_homework(
    lesson_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Get all homework assignments for a lesson."""
    lesson = await db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    result = await db.execute(
        select(HomeworkAssignment).where(HomeworkAssignment.lesson_id == lesson_id)
    )
    assignments = result.scalars().all()

    if not assignments:
        return []

    # Collect unique interactive lesson ids and student ids
    il_ids = {hw.interactive_lesson_id for hw in assignments}
    student_ids = {hw.student_id for hw in assignments}

    # Fetch interactive lessons
    il_result = await db.execute(
        select(InteractiveLesson).where(InteractiveLesson.id.in_(il_ids))
    )
    il_map = {il.id: il for il in il_result.scalars().all()}

    # Fetch users
    users_result = await db.execute(select(User).where(User.id.in_(student_ids)))
    users_map = {u.id: u for u in users_result.scalars().all()}

    # Precompute total blocks per interactive lesson
    blocks_cache: dict[int, int] = {}
    for il_id in il_ids:
        blocks_cache[il_id] = await _count_interactive_blocks(db, il_id)

    response = []
    for hw in assignments:
        progress = await _count_student_progress(
            db, hw.student_id, hw.interactive_lesson_id
        )
        il = il_map.get(hw.interactive_lesson_id)
        user = users_map.get(hw.student_id)
        response.append(
            HomeworkAssignmentResponse(
                id=hw.id,
                lesson_id=hw.lesson_id,
                lesson_title=lesson.title,
                interactive_lesson_id=hw.interactive_lesson_id,
                interactive_lesson_title=il.title if il else "",
                student_id=hw.student_id,
                student_name=user.name if user else f"User #{hw.student_id}",
                status=_compute_status(hw, progress),
                progress=progress,
                total_blocks=blocks_cache.get(hw.interactive_lesson_id, 0),
                assigned_at=hw.assigned_at,
                submitted_at=hw.submitted_at,
                accepted_at=hw.accepted_at,
            )
        )

    return response


@router.delete("/homework/{homework_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_homework(
    homework_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Delete a homework assignment."""
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    await db.delete(hw)
    await db.commit()


@router.put(
    "/homework/{homework_id}/accept",
    response_model=HomeworkAssignmentResponse,
)
async def accept_homework(
    homework_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Accept a submitted homework."""
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if hw.status != HomeworkStatus.SUBMITTED:
        raise HTTPException(status_code=400, detail="Homework is not in submitted status")

    hw.status = HomeworkStatus.ACCEPTED
    hw.accepted_at = datetime.now()
    await db.flush()

    lesson = await db.get(Lesson, hw.lesson_id)
    il = await db.get(InteractiveLesson, hw.interactive_lesson_id)
    student = await db.get(User, hw.student_id)
    total_blocks = await _count_interactive_blocks(db, hw.interactive_lesson_id)
    progress = await _count_student_progress(db, hw.student_id, hw.interactive_lesson_id)

    await db.commit()

    return HomeworkAssignmentResponse(
        id=hw.id,
        lesson_id=hw.lesson_id,
        lesson_title=lesson.title if lesson else "",
        interactive_lesson_id=hw.interactive_lesson_id,
        interactive_lesson_title=il.title if il else "",
        student_id=hw.student_id,
        student_name=student.name if student else "",
        status=_compute_status(hw, progress),
        progress=progress,
        total_blocks=total_blocks,
        assigned_at=hw.assigned_at,
        submitted_at=hw.submitted_at,
        accepted_at=hw.accepted_at,
    )


# ── Student endpoints ───────────────────────────────────────────────


@router.get(
    "/student/homework-assignments",
    response_model=list[StudentHomeworkItem],
)
async def get_my_homework(
    current_user: StudentOnlyUser,
    db: DBSession,
):
    """Get all homework assignments for the current student."""
    result = await db.execute(
        select(HomeworkAssignment)
        .where(HomeworkAssignment.student_id == current_user.id)
        .order_by(HomeworkAssignment.assigned_at.desc())
    )
    assignments = result.scalars().all()

    if not assignments:
        return []

    # Collect ids
    lesson_ids = {hw.lesson_id for hw in assignments}
    il_ids = {hw.interactive_lesson_id for hw in assignments}

    # Fetch lessons
    lessons_result = await db.execute(
        select(Lesson).where(Lesson.id.in_(lesson_ids))
    )
    lessons_map = {l.id: l for l in lessons_result.scalars().all()}

    # Fetch interactive lessons
    il_result = await db.execute(
        select(InteractiveLesson).where(InteractiveLesson.id.in_(il_ids))
    )
    il_map = {il.id: il for il in il_result.scalars().all()}

    # Fetch teacher names (assigned_by)
    teacher_ids = {hw.assigned_by for hw in assignments}
    teachers_result = await db.execute(
        select(User).where(User.id.in_(teacher_ids))
    )
    teachers_map = {t.id: t for t in teachers_result.scalars().all()}

    # Precompute total blocks
    blocks_cache: dict[int, int] = {}
    for il_id in il_ids:
        blocks_cache[il_id] = await _count_interactive_blocks(db, il_id)

    response = []
    for hw in assignments:
        progress = await _count_student_progress(
            db, current_user.id, hw.interactive_lesson_id
        )
        lesson = lessons_map.get(hw.lesson_id)
        il = il_map.get(hw.interactive_lesson_id)
        teacher = teachers_map.get(hw.assigned_by)
        response.append(
            StudentHomeworkItem(
                id=hw.id,
                lesson_title=lesson.title if lesson else "",
                interactive_lesson_id=hw.interactive_lesson_id,
                interactive_lesson_title=il.title if il else "",
                teacher_name=teacher.name if teacher else "",
                status=_compute_status(hw, progress),
                progress=progress,
                total_blocks=blocks_cache.get(hw.interactive_lesson_id, 0),
                assigned_at=hw.assigned_at,
            )
        )

    return response


@router.put(
    "/student/homework/{homework_id}/submit",
    response_model=StudentHomeworkItem,
)
async def submit_homework(
    homework_id: int,
    current_user: StudentOnlyUser,
    db: DBSession,
):
    """Submit homework for review."""
    hw = await db.get(HomeworkAssignment, homework_id)
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if hw.student_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your homework")

    if hw.status not in (HomeworkStatus.PENDING,):
        raise HTTPException(
            status_code=400, detail="Homework already submitted or accepted"
        )

    # Check that student has at least some progress
    progress = await _count_student_progress(
        db, current_user.id, hw.interactive_lesson_id
    )
    if progress == 0:
        raise HTTPException(
            status_code=400, detail="Complete at least one exercise before submitting"
        )

    hw.status = HomeworkStatus.SUBMITTED
    hw.submitted_at = datetime.now()
    await db.flush()

    lesson = await db.get(Lesson, hw.lesson_id)
    il = await db.get(InteractiveLesson, hw.interactive_lesson_id)
    teacher = await db.get(User, hw.assigned_by)
    total_blocks = await _count_interactive_blocks(db, hw.interactive_lesson_id)

    await db.commit()

    return StudentHomeworkItem(
        id=hw.id,
        lesson_title=lesson.title if lesson else "",
        interactive_lesson_id=hw.interactive_lesson_id,
        interactive_lesson_title=il.title if il else "",
        teacher_name=teacher.name if teacher else "",
        status="submitted",
        progress=progress,
        total_blocks=total_blocks,
        assigned_at=hw.assigned_at,
    )
