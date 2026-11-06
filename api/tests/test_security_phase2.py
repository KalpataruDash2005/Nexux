import pytest
from fastapi.testclient import TestClient
from app.models.base import User
from app.core.security import token_blocklist

def test_token_blocklist_unit():
    """Unit test for bounded LRU token blocklist."""
    test_id = "test-token-uuid-12345"
    assert not token_blocklist.is_revoked(test_id)
    token_blocklist.revoke(test_id, ttl_seconds=60)
    assert token_blocklist.is_revoked(test_id)

def test_logout_invalidates_token(client: TestClient, test_user: User):
    """
    NEX-VULN-002 Verification:
    Logging out must immediately revoke the JWT token so it can no longer access protected endpoints.
    """
    # 1. Login to obtain a valid session token
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "SecretPassword123!"
    })
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Access protected endpoint before logout
    pre_resp = client.get("/api/v1/students/me", headers=headers)
    assert pre_resp.status_code == 200

    # 3. Call logout endpoint
    logout_resp = client.post("/api/v1/auth/logout", headers=headers)
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "LOGGED_OUT"

    # 4. Attempt to reuse the same token after logout
    post_resp = client.get("/api/v1/students/me", headers=headers)
    assert post_resp.status_code == 401
    assert "Invalid or expired token" in post_resp.json().get("detail", "")

def test_logout_unauthenticated_rejected(client: TestClient):
    """Calling logout without authentication must return 401."""
    resp = client.post("/api/v1/auth/logout")
    assert resp.status_code == 401

def test_change_password_workflow(client: TestClient, test_user: User):
    """
    Verify secure password change workflow:
    - Current password must match.
    - Password is updated.
    - Subsequent login requires the new password.
    """
    login_resp = client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "SecretPassword123!"
    })
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Incorrect current password fails
    fail_resp = client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "WrongPassword999!",
        "new_password": "BrandNewPassword123!"
    })
    assert fail_resp.status_code == 400
    assert "Current password is incorrect" in fail_resp.json().get("detail", "")

    # Same password fails
    same_resp = client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "SecretPassword123!",
        "new_password": "SecretPassword123!"
    })
    assert same_resp.status_code == 400

    # Successful password change
    success_resp = client.post("/api/v1/auth/change-password", headers=headers, json={
        "current_password": "SecretPassword123!",
        "new_password": "BrandNewPassword123!"
    })
    assert success_resp.status_code == 200
    assert "Password updated successfully" in success_resp.json().get("message", "")

    # Old password no longer works
    old_login = client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "SecretPassword123!"
    })
    assert old_login.status_code == 401

    # New password works
    new_login = client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "BrandNewPassword123!"
    })
    assert new_login.status_code == 200

def test_password_complexity_enforcement(client: TestClient):
    """
    Verify password complexity requirements:
    Minimum 8 characters, with lowercase, uppercase, number, and special character.
    """
    weak_passwords = [
        "short1!",        # < 8 chars
        "alllowercase1!",  # no uppercase
        "ALLUPPERCASE1!",  # no lowercase
        "NoNumbersHere!",  # no digits
        "NoSpecialChar12", # no special char
    ]
    for weak_pw in weak_passwords:
        resp = client.post("/api/v1/auth/register", json={
            "email": f"pwtest_{abs(hash(weak_pw))}@example.com",
            "password": weak_pw,
            "role": "STUDENT"
        })
        assert resp.status_code == 422, f"Weak password '{weak_pw}' should have been rejected with 422"
