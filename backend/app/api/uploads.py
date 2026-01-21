import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, DBSession
from app.config import settings

router = APIRouter()

# Allowed file extensions for chat
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".zip", ".rar"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/chat")
async def upload_chat_file(
    file: UploadFile,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Upload a file for chat message."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    # Check extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read file content
    content = await file.read()

    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
        )

    # Create uploads directory if not exists
    uploads_dir = Path(settings.storage_path) / "chat"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = uploads_dir / unique_filename

    # Save file
    with open(file_path, "wb") as f:
        f.write(content)

    # Return URL
    file_url = f"/api/uploads/chat/{unique_filename}"

    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }
