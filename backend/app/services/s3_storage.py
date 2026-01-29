"""S3 Storage Service for file uploads."""
import uuid
from pathlib import Path
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings


class S3StorageService:
    """Service for uploading and managing files in S3."""

    def __init__(self):
        self.enabled = settings.s3_enabled
        self.bucket_name = settings.s3_bucket_name
        self.public_url = settings.s3_public_url.rstrip("/") if settings.s3_public_url else None

        if self.enabled:
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region,
                config=BotoConfig(signature_version="s3v4"),
            )
        else:
            self.client = None

    def upload_file(
        self,
        content: bytes,
        folder: str,
        original_filename: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Upload file to S3.

        Args:
            content: File content as bytes
            folder: Folder/prefix in S3 (e.g., 'chat', 'materials', 'photos')
            original_filename: Original filename to extract extension
            content_type: MIME type of the file

        Returns:
            Public URL of the uploaded file
        """
        if not self.enabled or not self.client:
            raise RuntimeError("S3 storage is not enabled")

        # Generate unique filename
        file_ext = Path(original_filename).suffix.lower()
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        s3_key = f"{folder}/{unique_filename}"

        # Determine content type
        if not content_type:
            content_type = self._get_content_type(file_ext)

        # Upload to S3
        extra_args = {"ContentType": content_type}

        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=s3_key,
                Body=content,
                ContentType=content_type,
            )
        except ClientError as e:
            raise RuntimeError(f"Failed to upload file to S3: {e}")

        # Return public URL
        if self.public_url:
            return f"{self.public_url}/{s3_key}"
        else:
            return f"{settings.s3_endpoint_url}/{self.bucket_name}/{s3_key}"

    def delete_file(self, file_url: str) -> bool:
        """
        Delete file from S3 by its URL.

        Args:
            file_url: Full URL of the file

        Returns:
            True if deleted successfully
        """
        if not self.enabled or not self.client:
            return False

        # Extract S3 key from URL
        s3_key = self._url_to_key(file_url)
        if not s3_key:
            return False

        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False

    def file_exists(self, file_url: str) -> bool:
        """Check if file exists in S3."""
        if not self.enabled or not self.client:
            return False

        s3_key = self._url_to_key(file_url)
        if not s3_key:
            return False

        try:
            self.client.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError:
            return False

    def _url_to_key(self, file_url: str) -> Optional[str]:
        """Extract S3 key from file URL."""
        if self.public_url and file_url.startswith(self.public_url):
            return file_url[len(self.public_url):].lstrip("/")
        elif file_url.startswith(f"{settings.s3_endpoint_url}/{self.bucket_name}/"):
            prefix = f"{settings.s3_endpoint_url}/{self.bucket_name}/"
            return file_url[len(prefix):]
        return None

    def _get_content_type(self, extension: str) -> str:
        """Get MIME type for file extension."""
        content_types = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".doc": "application/msword",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xls": "application/vnd.ms-excel",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".txt": "text/plain",
            ".zip": "application/zip",
            ".rar": "application/x-rar-compressed",
        }
        return content_types.get(extension, "application/octet-stream")


# Singleton instance
s3_storage = S3StorageService()
