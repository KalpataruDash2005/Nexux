import json
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional

audit_logger = logging.getLogger("careeros.security_audit")

# Banned / Sensitive keys that must never appear in cleartext audit logs
SENSITIVE_KEYS = {
    "password", "password_hash", "token", "access_token", "refresh_token",
    "secret", "jwt_secret", "authorization", "api_key", "credit_card",
    "private_key", "nonce", "salt"
}

def sanitize_audit_payload(data: Any) -> Any:
    """
    Recursively redacts sensitive keys and values from audit log payloads.
    """
    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            if any(term in k.lower() for term in SENSITIVE_KEYS):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = sanitize_audit_payload(v)
        return cleaned
    elif isinstance(data, list):
        return [sanitize_audit_payload(item) for item in data]
    return data

class SecurityEventType:
    AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS"
    AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE"
    AUTH_LOGOUT = "AUTH_LOGOUT"
    AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE"
    AUTH_REGISTRATION = "AUTH_REGISTRATION"
    AUTH_TOKEN_REVOKED = "AUTH_TOKEN_REVOKED"
    AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED"
    BOLA_ACCESS_DENIED = "BOLA_ACCESS_DENIED"
    ROLE_ESCALATION_ATTEMPT = "ROLE_ESCALATION_ATTEMPT"
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
    CODE_SECURITY_VIOLATION = "CODE_SECURITY_VIOLATION"
    FILE_UPLOAD_VIOLATION = "FILE_UPLOAD_VIOLATION"
    PROMPT_INJECTION_DETECTED = "PROMPT_INJECTION_DETECTED"

def log_security_event(
    event_type: str,
    details: Dict[str, Any],
    user_id: Optional[str] = None,
    client_ip: Optional[str] = None,
    correlation_id: Optional[str] = None,
    severity: str = "WARNING"
) -> Dict[str, Any]:
    """
    Constructs, sanitizes, and emits a structured JSON security audit record.
    Returns the sanitized audit dictionary for testing/verification.
    """
    sanitized_details = sanitize_audit_payload(details)

    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "log_type": "SECURITY_AUDIT",
        "event_type": event_type,
        "severity": severity,
        "correlation_id": correlation_id or "unknown",
        "user_id": user_id or "anonymous",
        "client_ip": client_ip or "unknown",
        "details": sanitized_details
    }

    log_msg = json.dumps(record, default=str)
    
    if severity == "CRITICAL":
        audit_logger.critical(log_msg)
    elif severity == "ERROR":
        audit_logger.error(log_msg)
    elif severity == "INFO":
        audit_logger.info(log_msg)
    else:
        audit_logger.warning(log_msg)

    return record
