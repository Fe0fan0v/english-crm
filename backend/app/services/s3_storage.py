"""S3 Storage Service for file uploads."""
import hashlib
import hmac
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import boto3
import httpx
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

from app.config import settings


class S3StorageService:
    """Service for uploading and managing files in S3."""

    def __init__(self):
        self.enabled = settings.s3_enabled
        self.bucket_name = settings.s3_bucket_name
        self.public_url = settings.s3_public_url.rstrip("/") if settings.s3_public_url else None
        self.access_key = settings.s3_access_key_id
        self.secret_key = settings.s3_secret_access_key
        self.region = settings.s3_region
        self.endpoint_url = settings.s3_endpoint_url

        # Extract host from endpoint URL
        if self.endpoint_url:
            self.host = self.endpoint_url.replace("https://", "").replace("http://", "").rstrip("/")
        else:
            self.host = None

        if self.enabled:
            self.client = boto3.client(
                "s3",
                endpoint_url=settings.s3_endpoint_url,
                aws_access_key_id=settings.s3_access_key_id,
                aws_secret_access_key=settings.s3_secret_access_key,
                region_name=settings.s3_region,
                config=BotoConfig(
                    signature_version="s3v4",
                    s3={"addressing_style": "path"},
                ),
            )
        else:
            self.client = None

    def _sign(self, key: bytes, msg: str) -> bytes:
        """HMAC-SHA256 signing helper."""
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    def _get_signature_key(self, date_stamp: str) -> bytes:
        """Generate AWS Signature V4 signing key."""
        k_date = self._sign(("AWS4" + self.secret_key).encode("utf-8"), date_stamp)
        k_region = self._sign(k_date, self.region)
        k_service = self._sign(k_region, "s3")
        k_signing = self._sign(k_service, "aws4_request")
        return k_signing

    def _upload_with_httpx(self, content: bytes, s3_key: str, content_type: str) -> None:
        """Upload file using httpx with manual AWS Signature V4."""
        t = datetime.now(timezone.utc)
        amz_date = t.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = t.strftime("%Y%m%d")

        # Create canonical request
        method = "PUT"
        canonical_uri = f"/{self.bucket_name}/{s3_key}"
        canonical_querystring = ""
        payload_hash = hashlib.sha256(content).hexdigest()

        canonical_headers = (
            f"content-length:{len(content)}\n"
            f"content-type:{content_type}\n"
            f"host:{self.host}\n"
            f"x-amz-content-sha256:{payload_hash}\n"
            f"x-amz-date:{amz_date}\n"
        )
        signed_headers = "content-length;content-type;host;x-amz-content-sha256;x-amz-date"

        canonical_request = (
            f"{method}\n{canonical_uri}\n{canonical_querystring}\n"
            f"{canonical_headers}\n{signed_headers}\n{payload_hash}"
        )

        # Create string to sign
        algorithm = "AWS4-HMAC-SHA256"
        credential_scope = f"{date_stamp}/{self.region}/s3/aws4_request"
        string_to_sign = (
            f"{algorithm}\n{amz_date}\n{credential_scope}\n"
            + hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
        )

        # Create signature
        signing_key = self._get_signature_key(date_stamp)
        signature = hmac.new(
            signing_key, string_to_sign.encode("utf-8"), hashlib.sha256
        ).hexdigest()

        # Create authorization header
        authorization_header = (
            f"{algorithm} Credential={self.access_key}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )

        headers = {
            "x-amz-date": amz_date,
            "x-amz-content-sha256": payload_hash,
            "Authorization": authorization_header,
            "Content-Length": str(len(content)),
            "Content-Type": content_type,
        }

        url = f"{self.endpoint_url}/{self.bucket_name}/{s3_key}"

        with httpx.Client() as client:
            response = client.put(url, content=content, headers=headers)
            if response.status_code not in (200, 201, 204):
                raise RuntimeError(
                    f"S3 upload failed with status {response.status_code}: {response.text}"
                )

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

        # Upload to S3 using httpx (boto3 has issues with ps.kz S3)
        try:
            self._upload_with_httpx(content, s3_key, content_type)
        except Exception as e:
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
