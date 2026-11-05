import pytest
from fastapi.testclient import TestClient

def test_full_user_lifecycle_integration(client: TestClient):
    # 1. Register new student
    register_payload = {
        "email": "fulltest@careeros.app",
        "password": "StrongPassword123!",
        "role": "STUDENT",
        "name": "Sarah Connor"
    }
    reg_resp = client.post("/api/v1/auth/register", json=register_payload)
    assert reg_resp.status_code == 200

    # 2. Login to get JWT
    login_payload = {
        "email": "fulltest@careeros.app",
        "password": "StrongPassword123!"
    }
    login_resp = client.post("/api/v1/auth/login", json=login_payload)
    assert login_resp.status_code == 200
    token = login_resp.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Check Profile
    profile_resp = client.get("/api/v1/students/me", headers=headers)
    assert profile_resp.status_code == 200
    assert profile_resp.json()["firstName"] == "Sarah"

    # 4. Create Workspace
    ws_resp = client.post("/api/v1/workspaces", json={"name": "Cloud Computing"}, headers=headers)
    assert ws_resp.status_code == 201
    workspace_id = ws_resp.json()["id"]

    # 5. List Workspaces
    list_ws_resp = client.get("/api/v1/workspaces", headers=headers)
    assert list_ws_resp.status_code == 200
    assert any(w["id"] == workspace_id for w in list_ws_resp.json())

    # 6. Create Task
    task_resp = client.post("/api/v1/tasks", json={"title": "Prepare Resume for Google"}, headers=headers)
    assert task_resp.status_code == 201
    task_id = task_resp.json()["id"]

    # 7. Check Task Summary
    summary_resp = client.get("/api/v1/tasks/summary", headers=headers)
    assert summary_resp.status_code == 200
    assert summary_resp.json()["total"] >= 1

    # 8. Update Task
    update_resp = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "COMPLETED"}, headers=headers)
    assert update_resp.status_code == 200
    assert update_resp.json()["status"] == "COMPLETED"

    # 9. Get Placement Dashboard
    dash_resp = client.get("/api/v1/placement/dashboard", headers=headers)
    assert dash_resp.status_code == 200
    assert "readiness" in dash_resp.json()

    # 10. Create Placement Session
    session_payload = {
        "type": "TECHNICAL",
        "mode": "AI",
        "role": "Backend Engineer",
        "company": "Amazon",
        "difficulty": "MEDIUM"
    }
    sess_resp = client.post("/api/v1/placement/sessions", json=session_payload, headers=headers)
    assert sess_resp.status_code == 200
    assert sess_resp.json()["type"] == "TECHNICAL"

    # 11. Submit Public Feedback
    fb_resp = client.post("/api/v1/feedback", json={
        "name": "Sarah Connor",
        "email": "fulltest@careeros.app",
        "message": "The platform works smoothly!"
    })
    assert fb_resp.status_code == 200
    assert "Feedback submitted successfully" in fb_resp.json()["message"]
