import os
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse

from app.api.deps import CurrentUser, DBSession
from app.config import settings
from app.services.s3_storage import s3_storage

router = APIRouter()

# Allowed file extensions for chat
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".zip", ".rar"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Allowed file extensions for materials (PDF only)
ALLOWED_MATERIAL_EXTENSIONS = {".pdf"}
MAX_MATERIAL_FILE_SIZE = 50 * 1024 * 1024  # 50MB

# Allowed file extensions for photos
ALLOWED_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_PHOTO_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Allowed file extensions for news banners
ALLOWED_NEWS_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_NEWS_FILE_SIZE = 10 * 1024 * 1024  # 10MB


async def _upload_file_to_storage(
    content: bytes,
    filename: str,
    folder: str,
    allowed_extensions: set,
    max_size: int,
) -> str:
    """Upload file to S3 or local storage."""
    # Check extension
    file_ext = Path(filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}",
        )

    # Check file size
    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {max_size // (1024 * 1024)}MB",
        )

    # Upload to S3 if enabled
    if s3_storage.enabled:
        try:
            file_url = s3_storage.upload_file(
                content=content,
                folder=folder,
                original_filename=filename,
            )
            return file_url
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file: {str(e)}",
            )
    else:
        # Fallback to local storage
        uploads_dir = Path(settings.storage_path) / folder
        uploads_dir.mkdir(parents=True, exist_ok=True)

        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = uploads_dir / unique_filename

        with open(file_path, "wb") as f:
            f.write(content)

        return f"/api/uploads/{folder}/{unique_filename}"


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

    content = await file.read()
    file_url = await _upload_file_to_storage(
        content=content,
        filename=file.filename,
        folder="chat",
        allowed_extensions=ALLOWED_EXTENSIONS,
        max_size=MAX_FILE_SIZE,
    )

    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }


@router.post("/materials")
async def upload_material_file(
    file: UploadFile,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Upload a PDF material file."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    content = await file.read()
    file_url = await _upload_file_to_storage(
        content=content,
        filename=file.filename,
        folder="materials",
        allowed_extensions=ALLOWED_MATERIAL_EXTENSIONS,
        max_size=MAX_MATERIAL_FILE_SIZE,
    )

    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }


@router.post("/photos")
async def upload_photo(
    file: UploadFile,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Upload a profile photo."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    content = await file.read()
    file_url = await _upload_file_to_storage(
        content=content,
        filename=file.filename,
        folder="photos",
        allowed_extensions=ALLOWED_PHOTO_EXTENSIONS,
        max_size=MAX_PHOTO_FILE_SIZE,
    )

    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }


@router.post("/news")
async def upload_news_banner(
    file: UploadFile,
    db: DBSession,
    current_user: CurrentUser,
) -> dict:
    """Upload a news banner image."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided",
        )

    content = await file.read()
    file_url = await _upload_file_to_storage(
        content=content,
        filename=file.filename,
        folder="news",
        allowed_extensions=ALLOWED_NEWS_EXTENSIONS,
        max_size=MAX_NEWS_FILE_SIZE,
    )

    return {
        "file_url": file_url,
        "filename": file.filename,
        "size": len(content),
    }


# Local file serving (only when S3 is disabled)
@router.get("/chat/{filename}")
async def get_chat_file(filename: str):
    """Serve chat file from local storage."""
    if s3_storage.enabled:
        # Redirect to S3 URL
        return RedirectResponse(url=f"{s3_storage.public_url}/chat/{filename}")

    file_path = Path(settings.storage_path) / "chat" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(file_path)


@router.get("/materials/{filename}")
async def get_material_file(filename: str):
    """Serve material file from local storage."""
    if s3_storage.enabled:
        return RedirectResponse(url=f"{s3_storage.public_url}/materials/{filename}")

    file_path = Path(settings.storage_path) / "materials" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(file_path)


@router.get("/photos/{filename}")
async def get_photo_file(filename: str):
    """Serve photo file from local storage."""
    if s3_storage.enabled:
        return RedirectResponse(url=f"{s3_storage.public_url}/photos/{filename}")

    file_path = Path(settings.storage_path) / "photos" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(file_path)


@router.get("/news/{filename}")
async def get_news_file(filename: str):
    """Serve news banner from local storage."""
    if s3_storage.enabled:
        return RedirectResponse(url=f"{s3_storage.public_url}/news/{filename}")

    file_path = Path(settings.storage_path) / "news" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    from fastapi.responses import FileResponse
    return FileResponse(file_path)
