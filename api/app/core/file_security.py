import os
import re
from fastapi import HTTPException, status
from app.core.config import settings

def validate_and_sanitize_upload(
    filename: str,
    file_bytes: bytes,
    allowed_extensions: tuple = (".pdf", ".txt"),
    max_size_bytes: int = None
) -> str:
    """
    Validates file extension, magic byte signatures, file size, and sanitizes filename.
    Returns the sanitized safe filename.
    Raises HTTPException(400) or HTTPException(413) on invalid input.
    """
    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty."
        )

    # 1. Enforce size limits
    max_allowed = max_size_bytes or settings.MAX_UPLOAD_SIZE_BYTES
    if len(file_bytes) > max_allowed:
        max_mb = max_allowed / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size limit of {max_mb:.1f} MB allowed for serverless processing."
        )

    # 2. Sanitize filename to prevent directory traversal
    base_name = os.path.basename(filename or "document.pdf")
    clean_name = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', base_name).strip()
    clean_name = re.sub(r'[/\\?%*:|"<>]+', '_', clean_name)
    if not clean_name:
        clean_name = "document.pdf"

    # 3. Extension check
    lower_name = clean_name.lower()
    if not any(lower_name.endswith(ext) for ext in allowed_extensions):
        allowed_str = ", ".join(allowed_extensions)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Only {allowed_str} files are supported."
        )

    # 4. True MIME Magic-Byte Signature Verification
    if lower_name.endswith(".pdf"):
        if not file_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file signature: uploaded file is not a valid PDF document."
            )

    return clean_name
