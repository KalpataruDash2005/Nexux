import pytest
from datetime import timedelta
from unittest.mock import MagicMock
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base, User, StudentProfile, RevokedToken
from app.core.security import create_access_token, decode_access_token, decode_token_claims, token_blocklist
from app.services.auth_service import AuthService
from app.services.profile_service import ProfileService
from app.schemas.auth import RegisterRequestDto, AuthRequestDto
from app.schemas.profile import StudentProfileDto
from app.core.rate_limiter import get_client_identifier, is_valid_ip, limiter
from app.services.code_execution_service import CodeExecutionService
from app.core.config import settings

@pytest.fixture
def remediation_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_serverless_token_version_invalidation_on_password_change(remediation_db):
    auth_service = AuthService(remediation_db)
    reg_dto = RegisterRequestDto(email="revocation_test@nexora.app", password="StrongPassword123!", role="STUDENT")
    auth_service.register_user(reg_dto)

    auth_dto = AuthRequestDto(email="revocation_test@nexora.app", password="StrongPassword123!")
    auth_resp = auth_service.authenticate_user(auth_dto)
    token1 = auth_resp.token

    # Verify token1 has token_version=1
    claims1 = decode_token_claims(token1, db=remediation_db)
    assert claims1.get("token_version") == 1

    user = remediation_db.query(User).filter(User.email == "revocation_test@nexora.app").first()
    assert user.token_version == 1

    # Change password
    auth_service.change_password(user, "StrongPassword123!", "NewStrongPassword456!")
    remediation_db.refresh(user)
    assert user.token_version == 2

    # Simulate get_current_user dependency verification for token1:
    claims_old = decode_token_claims(token1, db=remediation_db)
    assert claims_old.get("token_version") < user.token_version

    # Authenticate with new password: token2 must have token_version=2
    auth_dto_new = AuthRequestDto(email="revocation_test@nexora.app", password="NewStrongPassword456!")
    auth_resp2 = auth_service.authenticate_user(auth_dto_new)
    token2 = auth_resp2.token
    claims2 = decode_token_claims(token2, db=remediation_db)
    assert claims2.get("token_version") == 2
    assert claims2.get("token_version") >= user.token_version

def test_serverless_persistent_token_logout_revocation(remediation_db):
    auth_service = AuthService(remediation_db)
    reg_dto = RegisterRequestDto(email="logout_persist@nexora.app", password="StrongPassword123!", role="STUDENT")
    auth_service.register_user(reg_dto)

    auth_dto = AuthRequestDto(email="logout_persist@nexora.app", password="StrongPassword123!")
    auth_resp = auth_service.authenticate_user(auth_dto)
    token = auth_resp.token

    # Token is initially valid
    assert decode_access_token(token, db=remediation_db) == "logout_persist@nexora.app"

    # Logout
    auth_service.logout_user(token)

    # Database must contain the persistent revoked token record
    revoked_row = remediation_db.query(RevokedToken).first()
    assert revoked_row is not None
    assert revoked_row.jti is not None

    # Verify that in-memory cache clearing still results in revocation via DB check
    token_blocklist._cache.clear()

    # Now decode_token_claims must detect revocation from the database
    with pytest.raises(Exception) as exc_info:
        decode_token_claims(token, db=remediation_db)
    assert "revoked" in str(exc_info.value).lower()

def test_rate_limiter_spoofed_headers_protection():
    # Helper to create mock request with headers
    def make_mock_req(headers: dict, client_host: str = "127.0.0.1"):
        req = MagicMock()
        req.headers = headers
        req.client.host = client_host
        return req

    # 1. Attacker sends spoofed X-Forwarded-For, but trusted Cloudflare CF-Connecting-IP is present
    req1 = make_mock_req({
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "10.0.0.1, 192.168.1.1"
    })
    assert get_client_identifier(req1) == "203.0.113.195"

    # 2. X-Forwarded-For parsing picks leftmost valid client IP, skipping malformed entries
    req2 = make_mock_req({
        "x-forwarded-for": "malformed_ip, 198.51.100.42, 10.0.0.1"
    })
    assert get_client_identifier(req2) == "198.51.100.42"

    # 3. Invalid / malformed IP is rejected and falls back safely
    assert is_valid_ip("not-an-ip") is False
    assert is_valid_ip("999.999.999.999") is False
    assert is_valid_ip("192.168.1.1") is True
    assert is_valid_ip("2001:db8::1") is True

    req3 = make_mock_req({
        "x-forwarded-for": "invalid-ip-payload"
    }, client_host="192.0.2.1")
    assert get_client_identifier(req3) == "192.0.2.1"

def test_sensitive_profile_phone_encryption_at_rest(remediation_db):
    user = User(email="crypto_test@nexora.app", password_hash="dummy_hash", role="STUDENT")
    remediation_db.add(user)
    remediation_db.commit()

    profile_service = ProfileService(remediation_db)
    update_dto = StudentProfileDto(
        firstName="Alice",
        lastName="Smith",
        university="MIT",
        phone="+1-555-0199"
    )

    saved_dto = profile_service.update_profile(user, update_dto)
    assert saved_dto.phone == "+1-555-0199"

    # Inspect the raw database row directly
    raw_profile = remediation_db.query(StudentProfile).filter(StudentProfile.user_id == user.id).first()
    assert raw_profile is not None
    # Raw phone stored in database MUST NOT be plaintext "+1-555-0199"
    assert raw_profile.phone != "+1-555-0199"
    assert len(raw_profile.phone) > 28  # Encrypted ciphertext with nonce and auth tag

    # Read back via get_profile: decrypted transparently
    read_profile = profile_service.get_profile(user)
    assert read_profile.phone == "+1-555-0199"

def test_code_execution_production_host_execution_blocked(monkeypatch):
    # Ensure production environment setting strictly blocks host subprocess execution
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ENABLE_HOST_CODE_EXECUTION", True)  # Even if set to true, production overrides it
    monkeypatch.setattr(settings, "JUDGE0_URL", None)

    assert settings.is_host_execution_permitted is False
    assert CodeExecutionService.has_compiler_or_runtime("python") is False

    success, stdout, stderr, status, dur = CodeExecutionService.execute_in_sandbox(
        language="python",
        code="print('pwned')",
        input_data=""
    )
    assert success is False
    assert "disabled" in stderr.lower() or "blocked" in stderr.lower()
    assert status == "Compilation Error"
