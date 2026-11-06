"""
Centralized Error Sanitization & Safe Client Response System for Nexora.
Guarantees that raw exceptions, stack traces, database queries, internal class names,
and credentials are never exposed to API consumers or frontend clients.
"""

import re
from typing import Any, Optional
from app.core.logging import logger

# Indicators of internal technical leaks
_LEAK_PATTERNS = [
    r"object has no attribute",
    r"traceback",
    r'file\s+["\'].*?["\'],\s+line',
    r"(operationalerror|programmingerror|integrityerror|databaseerror)",
    r"(sqlalchemy|psycopg2|asyncpg|pymysql)",
    r"select\s+.*?\s+from\s+",
    r"insert\s+into\s+",
    r"update\s+.*?\s+set\s+",
    r"delete\s+from\s+",
    r"(password_hash|db_password|user_password|db_user|db_host|jwt_secret|xai-[a-zA-Z0-9]+|sbp_[a-zA-Z0-9]+|bearer\s+ey[a-zA-Z0-9_.-]+)",
    r"nonetype\s+object",
    r"connection\s+refused",
    r"could not translate host name",
    r"failed to connect to",
    r"syntaxerror|attributeerror|typeerror|indexerror",
    r"class\s+['\"][a-zA-Z0-9_]+['\"]",
]

_LEAK_REGEX = re.compile("|".join(_LEAK_PATTERNS), re.IGNORECASE)


def is_sensitive_or_internal(detail: str) -> bool:
    """Returns True if the detail string contains internal technical leaks."""
    if not detail or not isinstance(detail, str):
        return False
    return bool(_LEAK_REGEX.search(detail))


def sanitize_error_detail(
    raw_detail: Any,
    request_id: Optional[str] = None,
    status_code: int = 500,
    path: str = ""
) -> str:
    """
    Transforms any error detail into a safe, user-friendly message.
    Internal technical details are logged server-side and never returned to the client.
    """
    ref_suffix = f" Reference ID: {request_id}" if request_id else ""

    # If detail is not a string (e.g. dict or list), check representation
    detail_str = str(raw_detail) if raw_detail is not None else ""

    # Always mask internal 5xx server errors
    if status_code >= 500 or is_sensitive_or_internal(detail_str):
        # Contextual friendly messages based on path
        lower_path = path.lower()
        if "pdf-assistant" in lower_path or "documents" in lower_path:
            return f"Your document could not be processed. Please check the file and try again.{ref_suffix}"
        elif "resume" in lower_path:
            return f"Your resume could not be analyzed. Please check the document and try again.{ref_suffix}"
        elif "coding" in lower_path:
            return f"The coding evaluation service is temporarily unavailable. Please try again.{ref_suffix}"
        elif "placement" in lower_path or "interview" in lower_path:
            return f"The interview session encountered an issue. Please try again.{ref_suffix}"
        elif "auth" in lower_path:
            return f"Authentication service temporarily unavailable. Please try again.{ref_suffix}"
        elif "task" in lower_path:
            return f"Task service temporarily unavailable. Please try again.{ref_suffix}"
        else:
            return f"An unexpected server error occurred. Please try again later.{ref_suffix}"

    # For expected client errors (400, 401, 403, 404, 409, 422), preserve clean client messages
    return detail_str
