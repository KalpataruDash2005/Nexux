import pytest
from fastapi.testclient import TestClient
from app.models.base import User

def test_register_user_success(client: TestClient):
    payload = {
        "email": "newuser@nexux.app",
        "password": "Password123!",
        "role": "STUDENT",
        "name": "Alex Mercer"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 200
    assert "User registered successfully" in response.text

def test_register_duplicate_email(client: TestClient, test_user: User):
    payload = {
        "email": test_user.email,
        "password": "AnotherPassword123!",
        "role": "STUDENT"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "already in use" in response.json().get("detail", "")

def test_register_invalid_role(client: TestClient):
    payload = {
        "email": "invalidrole@nexux.app",
        "password": "Password123!",
        "role": "SUPERUSER"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "Role must be STUDENT or RECRUITER" in response.json().get("detail", "")
def test_register_admin_role_rejected(client: TestClient):
    payload = {
        "email": "tryadmin@nexux.app",
        "password": "Password123!",
        "role": "ADMIN"
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 400
    assert "Role must be STUDENT or RECRUITER" in response.json().get("detail", "")

def test_login_success(client: TestClient, test_user: User):
    payload = {
        "email": test_user.email,
        "password": "SecretPassword123!"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["type"] == "Bearer"
    assert data["email"] == test_user.email
    assert data["role"] == "STUDENT"

def test_login_invalid_password(client: TestClient, test_user: User):
    payload = {
        "email": test_user.email,
        "password": "WrongPassword999!"
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json().get("detail", "")

def test_protected_route_without_token(client: TestClient):
    response = client.get("/api/v1/students/me")
    assert response.status_code == 401
    assert "Authentication required" in response.json().get("detail", "")

def test_protected_route_with_invalid_token(client: TestClient):
    headers = {"Authorization": "Bearer invalid.jwt.token"}
    response = client.get("/api/v1/students/me", headers=headers)
    assert response.status_code == 401
    assert "Invalid or expired token" in response.json().get("detail", "")

def test_protected_route_with_valid_token(client: TestClient, auth_headers: dict, test_user: User):
    response = client.get("/api/v1/students/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["userId"] == test_user.id
