import json
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.core.audit import (
    log_security_event,
    sanitize_audit_payload,
    SecurityEventType
)

def test_sanitize_audit_payload_redaction():
    """Verify sensitive fields are strictly redacted in audit logs."""
    raw_payload = {
        "user_email": "test@example.com",
        "password": "SuperSecretPassword123!",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "api_key": "xai-1234567890",
        "nested": {
            "jwt_secret": "my-secret-key",
            "safe_counter": 42
        },
        "list_items": [
            {"token": "leak_token_here", "status": "active"}
        ]
    }

    sanitized = sanitize_audit_payload(raw_payload)

    assert sanitized["user_email"] == "test@example.com"
    assert sanitized["password"] == "[REDACTED]"
    assert sanitized["access_token"] == "[REDACTED]"
    assert sanitized["api_key"] == "[REDACTED]"
    assert sanitized["nested"]["jwt_secret"] == "[REDACTED]"
    assert sanitized["nested"]["safe_counter"] == 42
    assert sanitized["list_items"][0]["token"] == "[REDACTED]"
    assert sanitized["list_items"][0]["status"] == "active"

def test_log_security_event_structure():
    """Verify security event emitter outputs valid structured JSON metadata."""
    event = log_security_event(
        event_type=SecurityEventType.BOLA_ACCESS_DENIED,
        details={"resource": "job_application_42", "secret_param": "should_be_masked"},
        user_id="user-123",
        client_ip="203.0.113.1",
        correlation_id="req_test_abc123",
        severity="ERROR"
    )

    assert event["log_type"] == "SECURITY_AUDIT"
    assert event["event_type"] == SecurityEventType.BOLA_ACCESS_DENIED
    assert event["severity"] == "ERROR"
    assert event["correlation_id"] == "req_test_abc123"
    assert event["user_id"] == "user-123"
    assert event["client_ip"] == "203.0.113.1"
    assert event["details"]["resource"] == "job_application_42"
    assert event["details"]["secret_param"] == "[REDACTED]"
    assert "timestamp" in event

def test_correlation_id_middleware_propagation():
    """Verify CorrelationIdMiddleware generates or propagates X-Request-ID."""
    client = TestClient(app)

    # 1. Custom incoming correlation ID
    custom_id = "req_audit_test_9999"
    resp = client.get("/api/v1/health", headers={"X-Request-ID": custom_id})
    assert resp.status_code == 200
    assert resp.headers.get("X-Request-ID") == custom_id
    assert "X-Response-Time" in resp.headers

    # 2. Auto-generated correlation ID
    resp_auto = client.get("/api/v1/health")
    assert resp_auto.status_code == 200
    gen_id = resp_auto.headers.get("X-Request-ID")
    assert gen_id is not None
    assert gen_id.startswith("req_")
