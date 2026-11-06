"""
Security Phase 1 Containment Test Suite.
Verifies:
- NEX-VULN-001: Admin self-registration rejection
- NEX-VULN-002: Host subprocess code execution blocked when not permitted
- NEX-VULN-005: Strict JWT secret production validation and safe admin seeding
"""

import os
import pytest
from fastapi.testclient import TestClient
from app.services.code_execution_service import CodeExecutionService
from app.core.config import Settings


def test_public_admin_registration_rejected(client: TestClient):
    """NEX-VULN-001: Registering with role ADMIN must return HTTP 400."""
    res = client.post("/api/v1/auth/register", json={
        "email": "hacker_admin@example.com",
        "password": "ValidPassword123!",
        "role": "ADMIN"
    })
    assert res.status_code == 400
    assert "Role must be STUDENT or RECRUITER" in res.json().get("detail", "")


def test_public_recruiter_registration_allowed(client: TestClient):
    """NEX-VULN-001: Public registration as RECRUITER remains valid."""
    res = client.post("/api/v1/auth/register", json={
        "email": "recruiter_new@example.com",
        "password": "ValidPassword123!",
        "role": "RECRUITER"
    })
    assert res.status_code == 200


def test_host_code_execution_blocked_when_disabled(monkeypatch):
    """NEX-VULN-002: Direct host subprocess execution must be blocked when permission is False."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "ENABLE_HOST_CODE_EXECUTION", False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    success, stdout, stderr, run_status, dur = CodeExecutionService.execute_in_sandbox(
        language="python",
        code="print('should not execute on host')",
        input_data=""
    )
    assert success is False
    assert "Host code execution is disabled" in stderr
    assert run_status == "Compilation Error"


def test_production_jwt_secret_validation_rejects_default():
    """NEX-VULN-005: Production environment must reject weak/placeholder JWT secret."""
    test_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="careeros-super-secret-jwt-key-with-at-least-256-bits-length-for-security-purposes!"
    )
    with pytest.raises(ValueError, match="CRITICAL SECURITY ERROR"):
        test_settings.validate_security()


def test_production_jwt_secret_validation_accepts_strong_secret():
    """NEX-VULN-005: Production environment accepts strong 256-bit random secrets."""
    test_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET="e9c4b7891234567890abcdef1234567890abcdef1234567890abcdef12345678"
    )
    # Should not raise
    test_settings.validate_security()
