"""Vocabulary API — personal dictionary for students."""

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.api.deps import CurrentUser, DBSession, StudentOnlyUser, TeacherUser
from app.models.teacher_student import TeacherStudent
from app.models.user import User, UserRole
from app.models.vocabulary import VocabularyWord
from app.schemas.vocabulary import (
    VocabularyWordBulkCreate,
    VocabularyWordCreate,
    VocabularyWordListResponse,
    VocabularyWordResponse,
    VocabularyWordUpdate,
)

router = APIRouter()


@router.get("/lookup")
async def lookup_word_endpoint(
    word: str = Query(..., min_length=1, max_length=100),
    current_user: CurrentUser = None,
):
    """Look up word phonetics and definition from Free Dictionary API."""
    from app.utils.dictionary import lookup_word

    result = await lookup_word(word.strip().lower())
    if result is None:
        return {"phonetic": "", "definition": ""}
    return result


def _word_to_response(word: VocabularyWord) -> VocabularyWordResponse:
    return VocabularyWordResponse(
        id=word.id,
        student_id=word.student_id,
        english=word.english,
        translation=word.translation,
        transcription=word.transcription,
        example=word.example,
        added_by_id=word.added_by_id,
        added_by_name=word.added_by.name if word.added_by else None,
        created_at=word.created_at,
        updated_at=word.updated_at,
    )


# ── Student endpoints ──────────────────────────────────────────────


@router.get("/my", response_model=VocabularyWordListResponse)
async def get_my_words(
    db: DBSession,
    current_user: StudentOnlyUser,
    search: str | None = Query(None),
):
    """Get current student's vocabulary words."""
    query = (
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.student_id == current_user.id)
    )
    if search:
        like = f"%{search}%"
        query = query.where(
            (VocabularyWord.english.ilike(like))
            | (VocabularyWord.translation.ilike(like))
        )
    query = query.order_by(VocabularyWord.created_at.desc())

    count_query = select(func.count()).select_from(
        select(VocabularyWord.id)
        .where(VocabularyWord.student_id == current_user.id)
        .subquery()
    )
    if search:
        like = f"%{search}%"
        count_query = select(func.count()).select_from(
            select(VocabularyWord.id)
            .where(VocabularyWord.student_id == current_user.id)
            .where(
                (VocabularyWord.english.ilike(like))
                | (VocabularyWord.translation.ilike(like))
            )
            .subquery()
        )

    result = await db.execute(query)
    words = result.scalars().all()
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return VocabularyWordListResponse(
        items=[_word_to_response(w) for w in words],
        total=total,
    )


@router.post("/my", response_model=VocabularyWordResponse, status_code=status.HTTP_201_CREATED)
async def add_my_word(
    data: VocabularyWordCreate,
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Add a word to current student's vocabulary."""
    word = VocabularyWord(
        student_id=current_user.id,
        english=data.english,
        translation=data.translation,
        transcription=data.transcription,
        example=data.example,
        added_by_id=current_user.id,
    )
    db.add(word)
    await db.commit()
    await db.refresh(word)
    # Load relationship
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word.id)
    )
    word = result.scalar_one()
    return _word_to_response(word)


@router.put("/my/{word_id}", response_model=VocabularyWordResponse)
async def update_my_word(
    word_id: int,
    data: VocabularyWordUpdate,
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Update a word in current student's vocabulary."""
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word_id, VocabularyWord.student_id == current_user.id)
    )
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(word, key, value)

    await db.commit()
    await db.refresh(word)
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word.id)
    )
    word = result.scalar_one()
    return _word_to_response(word)


@router.delete("/my/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_word(
    word_id: int,
    db: DBSession,
    current_user: StudentOnlyUser,
):
    """Delete a word from current student's vocabulary."""
    result = await db.execute(
        select(VocabularyWord).where(
            VocabularyWord.id == word_id, VocabularyWord.student_id == current_user.id
        )
    )
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.delete(word)
    await db.commit()


# ── Teacher / Admin / Manager endpoints ────────────────────────────


async def _check_teacher_access(db: DBSession, user: User, student_id: int) -> None:
    """Check that a teacher has access to this student (via TeacherStudent assignment).
    Admins and managers bypass the check."""
    if user.role in (UserRole.ADMIN, UserRole.MANAGER):
        return
    # Teacher — must be assigned
    result = await db.execute(
        select(TeacherStudent).where(
            TeacherStudent.teacher_id == user.id,
            TeacherStudent.student_id == student_id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="No access to this student")


@router.get("/student/{student_id}", response_model=VocabularyWordListResponse)
async def get_student_words(
    student_id: int,
    db: DBSession,
    current_user: TeacherUser,
    search: str | None = Query(None),
):
    """Get vocabulary words for a specific student (teacher/admin/manager)."""
    await _check_teacher_access(db, current_user, student_id)

    query = (
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.student_id == student_id)
    )
    if search:
        like = f"%{search}%"
        query = query.where(
            (VocabularyWord.english.ilike(like))
            | (VocabularyWord.translation.ilike(like))
        )
    query = query.order_by(VocabularyWord.created_at.desc())

    count_base = select(VocabularyWord.id).where(VocabularyWord.student_id == student_id)
    if search:
        like = f"%{search}%"
        count_base = count_base.where(
            (VocabularyWord.english.ilike(like))
            | (VocabularyWord.translation.ilike(like))
        )
    count_query = select(func.count()).select_from(count_base.subquery())

    result = await db.execute(query)
    words = result.scalars().all()
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    return VocabularyWordListResponse(
        items=[_word_to_response(w) for w in words],
        total=total,
    )


@router.post(
    "/student/{student_id}",
    response_model=VocabularyWordResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_student_word(
    student_id: int,
    data: VocabularyWordCreate,
    db: DBSession,
    current_user: TeacherUser,
):
    """Add a word to a student's vocabulary (teacher/admin/manager)."""
    await _check_teacher_access(db, current_user, student_id)

    word = VocabularyWord(
        student_id=student_id,
        english=data.english,
        translation=data.translation,
        transcription=data.transcription,
        example=data.example,
        added_by_id=current_user.id,
    )
    db.add(word)
    await db.commit()
    await db.refresh(word)
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word.id)
    )
    word = result.scalar_one()
    return _word_to_response(word)


@router.post(
    "/student/{student_id}/bulk",
    response_model=VocabularyWordListResponse,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_add_student_words(
    student_id: int,
    data: VocabularyWordBulkCreate,
    db: DBSession,
    current_user: TeacherUser,
):
    """Bulk add words to a student's vocabulary (teacher/admin/manager)."""
    await _check_teacher_access(db, current_user, student_id)

    created_words = []
    for w in data.words:
        word = VocabularyWord(
            student_id=student_id,
            english=w.english,
            translation=w.translation,
            transcription=w.transcription,
            example=w.example,
            added_by_id=current_user.id,
        )
        db.add(word)
        created_words.append(word)

    await db.commit()

    # Reload with relationships
    ids = [w.id for w in created_words]
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id.in_(ids))
        .order_by(VocabularyWord.id)
    )
    words = result.scalars().all()

    return VocabularyWordListResponse(
        items=[_word_to_response(w) for w in words],
        total=len(words),
    )


@router.put("/student/{student_id}/{word_id}", response_model=VocabularyWordResponse)
async def update_student_word(
    student_id: int,
    word_id: int,
    data: VocabularyWordUpdate,
    db: DBSession,
    current_user: TeacherUser,
):
    """Update a word in a student's vocabulary (teacher/admin/manager)."""
    await _check_teacher_access(db, current_user, student_id)

    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word_id, VocabularyWord.student_id == student_id)
    )
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(word, key, value)

    await db.commit()
    await db.refresh(word)
    result = await db.execute(
        select(VocabularyWord)
        .options(joinedload(VocabularyWord.added_by))
        .where(VocabularyWord.id == word.id)
    )
    word = result.scalar_one()
    return _word_to_response(word)


@router.delete("/student/{student_id}/{word_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_word(
    student_id: int,
    word_id: int,
    db: DBSession,
    current_user: TeacherUser,
):
    """Delete a word from a student's vocabulary (teacher/admin/manager)."""
    await _check_teacher_access(db, current_user, student_id)

    result = await db.execute(
        select(VocabularyWord).where(
            VocabularyWord.id == word_id, VocabularyWord.student_id == student_id
        )
    )
    word = result.scalar_one_or_none()
    if not word:
        raise HTTPException(status_code=404, detail="Word not found")

    await db.delete(word)
    await db.commit()
