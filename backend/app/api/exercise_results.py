from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func as sa_func
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, StudentOnlyUser, TeacherUser
from app.models.course import ExerciseBlock, InteractiveLesson
from app.models.exercise_result import ExerciseResult
from app.models.user import User
from app.schemas.exercise_result import (
    ExerciseResultResponse,
    ExerciseResultSubmit,
    LessonResultsResponse,
    LessonStudentResultsResponse,
    StudentBlockResult,
    StudentLessonDetailResponse,
    StudentLessonSummary,
)
from app.utils.grading import grade_answer, grade_answer_detailed

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
}


@router.post(
    "/lessons/{lesson_id}/submit",
    response_model=ExerciseResultResponse,
)
async def submit_answer(
    lesson_id: int,
    data: ExerciseResultSubmit,
    current_user: StudentOnlyUser,
    db: DBSession,
):
    """Save or update a student's answer for an exercise block."""
    # Verify block belongs to lesson
    block = await db.get(ExerciseBlock, data.block_id)
    if not block or block.lesson_id != lesson_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Block not found in this lesson",
        )

    is_correct = grade_answer(block.block_type, block.content, data.answer)
    details = grade_answer_detailed(block.block_type, block.content, data.answer)

    # Wrap answer in dict for JSONB storage
    answer_value = {"value": data.answer}

    stmt = pg_insert(ExerciseResult).values(
        student_id=current_user.id,
        block_id=data.block_id,
        lesson_id=lesson_id,
        answer=answer_value,
        is_correct=is_correct,
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_exercise_result_student_block",
        set_={
            "answer": answer_value,
            "is_correct": is_correct,
            "updated_at": sa_func.now(),
        },
    )
    await db.execute(stmt)
    await db.flush()

    # Fetch the upserted row
    result = await db.execute(
        select(ExerciseResult).where(
            ExerciseResult.student_id == current_user.id,
            ExerciseResult.block_id == data.block_id,
        )
    )
    row = result.scalar_one()
    return ExerciseResultResponse(
        id=row.id,
        student_id=row.student_id,
        block_id=row.block_id,
        lesson_id=row.lesson_id,
        answer=row.answer.get("value")
        if isinstance(row.answer, dict) and "value" in row.answer
        else row.answer,
        is_correct=row.is_correct,
        details=details,
        updated_at=row.updated_at,
    )


@router.get(
    "/lessons/{lesson_id}/my-results",
    response_model=LessonResultsResponse,
)
async def get_my_results(
    lesson_id: int,
    current_user: StudentOnlyUser,
    db: DBSession,
):
    """Get student's own saved results for a lesson."""
    result = await db.execute(
        select(ExerciseResult).where(
            ExerciseResult.lesson_id == lesson_id,
            ExerciseResult.student_id == current_user.id,
        )
    )
    rows = result.scalars().all()

    results = []
    score = 0
    total = 0
    for r in rows:
        answer_val = (
            r.answer.get("value")
            if isinstance(r.answer, dict) and "value" in r.answer
            else r.answer
        )
        results.append(
            ExerciseResultResponse(
                id=r.id,
                student_id=r.student_id,
                block_id=r.block_id,
                lesson_id=r.lesson_id,
                answer=answer_val,
                is_correct=r.is_correct,
                updated_at=r.updated_at,
            )
        )
        if r.is_correct is not None:
            total += 1
            if r.is_correct:
                score += 1

    return LessonResultsResponse(
        lesson_id=lesson_id,
        results=results,
        score=score,
        total=total,
        answered=len(rows),
    )


@router.get(
    "/lessons/{lesson_id}/students",
    response_model=LessonStudentResultsResponse,
)
async def get_lesson_student_summaries(
    lesson_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Get summary of all students' results for a lesson (teacher view)."""
    lesson = await db.get(InteractiveLesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Count interactive blocks
    blocks_result = await db.execute(
        select(sa_func.count(ExerciseBlock.id)).where(
            ExerciseBlock.lesson_id == lesson_id,
            ExerciseBlock.block_type.in_(INTERACTIVE_TYPES),
        )
    )
    total_blocks = blocks_result.scalar() or 0

    # Get all results for this lesson grouped by student
    results = await db.execute(
        select(ExerciseResult).where(ExerciseResult.lesson_id == lesson_id)
    )
    rows = results.scalars().all()

    # Group by student
    student_data: dict[int, dict] = {}
    for r in rows:
        if r.student_id not in student_data:
            student_data[r.student_id] = {
                "score": 0,
                "total": 0,
                "answered": 0,
                "last_activity": None,
            }
        sd = student_data[r.student_id]
        sd["answered"] += 1
        if r.is_correct is not None:
            sd["total"] += 1
            if r.is_correct:
                sd["score"] += 1
        if sd["last_activity"] is None or r.updated_at > sd["last_activity"]:
            sd["last_activity"] = r.updated_at

    # Fetch student names
    if student_data:
        users_result = await db.execute(
            select(User).where(User.id.in_(student_data.keys()))
        )
        users = {u.id: u for u in users_result.scalars().all()}
    else:
        users = {}

    students = []
    for sid, sd in student_data.items():
        u = users.get(sid)
        students.append(
            StudentLessonSummary(
                student_id=sid,
                student_name=u.name if u else f"User #{sid}",
                score=sd["score"],
                total=sd["total"],
                answered=sd["answered"],
                total_blocks=total_blocks,
                last_activity=sd["last_activity"],
            )
        )

    students.sort(key=lambda s: s.student_name)

    return LessonStudentResultsResponse(
        lesson_id=lesson_id,
        lesson_title=lesson.title,
        students=students,
    )


@router.get(
    "/lessons/{lesson_id}/students/{student_id}",
    response_model=StudentLessonDetailResponse,
)
async def get_student_lesson_detail(
    lesson_id: int,
    student_id: int,
    current_user: TeacherUser,
    db: DBSession,
):
    """Get detailed answers of a specific student for a lesson."""
    lesson = await db.execute(
        select(InteractiveLesson)
        .options(selectinload(InteractiveLesson.blocks))
        .where(InteractiveLesson.id == lesson_id)
    )
    lesson_obj = lesson.scalar_one_or_none()
    if not lesson_obj:
        raise HTTPException(status_code=404, detail="Lesson not found")

    student = await db.get(User, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Get results for this student and lesson
    results_q = await db.execute(
        select(ExerciseResult).where(
            ExerciseResult.lesson_id == lesson_id,
            ExerciseResult.student_id == student_id,
        )
    )
    results_map = {r.block_id: r for r in results_q.scalars().all()}

    blocks = []
    score = 0
    total = 0
    for block in sorted(lesson_obj.blocks, key=lambda b: b.position):
        if block.block_type not in INTERACTIVE_TYPES:
            continue
        r = results_map.get(block.id)
        answer_val = None
        is_correct = None
        updated_at = None
        if r:
            answer_val = (
                r.answer.get("value")
                if isinstance(r.answer, dict) and "value" in r.answer
                else r.answer
            )
            is_correct = r.is_correct
            updated_at = r.updated_at
            if r.is_correct is not None:
                total += 1
                if r.is_correct:
                    score += 1

        blocks.append(
            StudentBlockResult(
                block_id=block.id,
                block_type=block.block_type,
                block_title=block.title,
                block_content=block.content,
                answer=answer_val,
                is_correct=is_correct,
                updated_at=updated_at,
            )
        )

    return StudentLessonDetailResponse(
        student_id=student_id,
        student_name=student.name,
        lesson_id=lesson_id,
        lesson_title=lesson_obj.title,
        score=score,
        total=total,
        blocks=blocks,
    )
