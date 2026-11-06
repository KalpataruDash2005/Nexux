import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.base import User, Job, Application, Workspace, Task
from app.core.security import get_password_hash, create_access_token

@pytest.fixture
def student_a(db_session: Session) -> User:
    user = User(
        email="student_a@example.com",
        password_hash=get_password_hash("Password123!"),
        role="STUDENT"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def student_b(db_session: Session) -> User:
    user = User(
        email="student_b@example.com",
        password_hash=get_password_hash("Password123!"),
        role="STUDENT"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def recruiter_a(db_session: Session) -> User:
    user = User(
        email="recruiter_a@example.com",
        password_hash=get_password_hash("Password123!"),
        role="RECRUITER"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def recruiter_b(db_session: Session) -> User:
    user = User(
        email="recruiter_b@example.com",
        password_hash=get_password_hash("Password123!"),
        role="RECRUITER"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

def auth_header_for(user: User) -> dict:
    token = create_access_token(subject=user.email, role=user.role)
    return {"Authorization": f"Bearer {token}"}

# ==============================================================================
# 1. Multi-Tenant Workspace & Search Isolation (NEX-VULN-004)
# ==============================================================================
def test_workspace_isolation_and_search_bola_protection(client: TestClient, student_a: User, student_b: User):
    """
    NEX-VULN-004 Verification:
    Verify that Student B cannot read, rename, delete, get stats, or search
    across Student A's workspace documents.
    """
    headers_a = auth_header_for(student_a)
    headers_b = auth_header_for(student_b)

    # 1. Student A creates a workspace
    create_resp = client.post("/api/v1/workspaces", headers=headers_a, json={
        "name": "Student A Confidential Research",
        "description": "Proprietary research notes"
    })
    assert create_resp.status_code == 201
    workspace_id = create_resp.json()["id"]

    # 2. Student A can access their own workspace
    get_a_resp = client.get(f"/api/v1/workspaces/{workspace_id}", headers=headers_a)
    assert get_a_resp.status_code == 200
    assert get_a_resp.json()["name"] == "Student A Confidential Research"

    # 3. Student B attempting to get Student A's workspace must receive 404
    get_b_resp = client.get(f"/api/v1/workspaces/{workspace_id}", headers=headers_b)
    assert get_b_resp.status_code == 404

    # 4. Student B attempting to search Student A's workspace must receive 404 (BOLA fix)
    search_b_resp = client.get(f"/api/v1/workspaces/{workspace_id}/search?query=quantum", headers=headers_b)
    assert search_b_resp.status_code == 404

    # 5. Student B attempting to rename Student A's workspace must receive 404
    rename_b_resp = client.patch(f"/api/v1/workspaces/{workspace_id}", headers=headers_b, json={
        "name": "Tampered Name"
    })
    assert rename_b_resp.status_code == 404

    # 6. Student B attempting to delete Student A's workspace must receive 404
    delete_b_resp = client.delete(f"/api/v1/workspaces/{workspace_id}", headers=headers_b)
    assert delete_b_resp.status_code == 404

    # 7. Student A can still access their intact workspace
    verify_a = client.get(f"/api/v1/workspaces/{workspace_id}", headers=headers_a)
    assert verify_a.status_code == 200

# ==============================================================================
# 2. Recruiter Job & Application BOLA Protection (NEX-VULN-003)
# ==============================================================================
def test_recruiter_job_application_bola_protection(
    client: TestClient,
    recruiter_a: User,
    recruiter_b: User,
    student_a: User,
    test_admin: User
):
    """
    NEX-VULN-003 Verification:
    Verify that Recruiter B cannot view applicant details or modify application
    statuses for jobs posted by Recruiter A.
    """
    headers_recruiter_a = auth_header_for(recruiter_a)
    headers_recruiter_b = auth_header_for(recruiter_b)
    headers_student = auth_header_for(student_a)
    headers_admin = auth_header_for(test_admin)

    # 1. Recruiter A creates a job
    job_resp = client.post("/api/v1/jobs", headers=headers_recruiter_a, json={
        "title": "Senior Cryptography Engineer",
        "companyName": "Zero Trust Security Corp",
        "description": "Lead protocol security hardening",
        "location": "Remote",
        "salary": "$180,000"
    })
    assert job_resp.status_code == 201
    job_id = job_resp.json()["id"]

    # 2. Student applies for Recruiter A's job
    apply_resp = client.post("/api/v1/applications", headers=headers_student, json={
        "jobId": job_id
    })
    assert apply_resp.status_code == 201
    app_id = apply_resp.json()["id"]

    # 3. Recruiter B attempts to view applicants for Recruiter A's job -> 403 Forbidden
    bola_view_resp = client.get(f"/api/v1/applications/jobs/{job_id}", headers=headers_recruiter_b)
    assert bola_view_resp.status_code == 403
    assert "Access denied" in bola_view_resp.json().get("detail", "")

    # 4. Recruiter A views applicants -> 200 OK
    legit_view_resp = client.get(f"/api/v1/applications/jobs/{job_id}", headers=headers_recruiter_a)
    assert legit_view_resp.status_code == 200
    apps = legit_view_resp.json()
    assert len(apps) == 1
    assert apps[0]["id"] == app_id
    assert apps[0]["applicantEmail"] == student_a.email

    # 5. Recruiter B attempts to update status -> 403 Forbidden
    bola_update_resp = client.put(f"/api/v1/applications/{app_id}/status", headers=headers_recruiter_b, json={
        "status": "REJECTED"
    })
    assert bola_update_resp.status_code == 403
    assert "Access denied" in bola_update_resp.json().get("detail", "")

    # 6. Recruiter A updates status -> 200 OK
    legit_update_resp = client.put(f"/api/v1/applications/{app_id}/status", headers=headers_recruiter_a, json={
        "status": "INTERVIEW_SCHEDULED"
    })
    assert legit_update_resp.status_code == 200
    assert legit_update_resp.json()["status"] == "INTERVIEW_SCHEDULED"

    # 7. Admin has universal oversight authority -> 200 OK
    admin_view_resp = client.get(f"/api/v1/applications/jobs/{job_id}", headers=headers_admin)
    assert admin_view_resp.status_code == 200

# ==============================================================================
# 3. Multi-Tenant Task Isolation
# ==============================================================================
def test_task_isolation_between_users(client: TestClient, student_a: User, student_b: User):
    """Verify that Student B cannot view, modify, or delete Student A's tasks."""
    headers_a = auth_header_for(student_a)
    headers_b = auth_header_for(student_b)

    # Student A creates a task
    create_task = client.post("/api/v1/tasks", headers=headers_a, json={
        "title": "Review Multi-Tenant Security Controls",
        "deadline": None
    })
    assert create_task.status_code == 201
    task_id = create_task.json()["id"]

    # Student B attempts to access task -> 404 Not Found
    get_task_b = client.get(f"/api/v1/tasks/{task_id}", headers=headers_b)
    assert get_task_b.status_code == 404

    # Student B attempts to update task -> 404 Not Found
    patch_task_b = client.patch(f"/api/v1/tasks/{task_id}", headers=headers_b, json={
        "title": "Tampered Task Title"
    })
    assert patch_task_b.status_code == 404

    # Student B attempts to delete task -> 404 Not Found
    del_task_b = client.delete(f"/api/v1/tasks/{task_id}", headers=headers_b)
    assert del_task_b.status_code == 404

    # Student A can view and update task
    get_task_a = client.get(f"/api/v1/tasks/{task_id}", headers=headers_a)
    assert get_task_a.status_code == 200
    assert get_task_a.json()["title"] == "Review Multi-Tenant Security Controls"

# ==============================================================================
# 4. Strict RBAC Enforcement on Admin Endpoints
# ==============================================================================
def test_admin_endpoints_strictly_forbidden_for_non_admins(
    client: TestClient,
    student_a: User,
    recruiter_a: User,
    test_admin: User
):
    """Verify non-admin roles cannot access /api/v1/admin endpoints."""
    headers_student = auth_header_for(student_a)
    headers_recruiter = auth_header_for(recruiter_a)
    headers_admin = auth_header_for(test_admin)

    # Student is forbidden
    resp_stud = client.get("/api/v1/admin/users", headers=headers_student)
    assert resp_stud.status_code == 403

    # Recruiter is forbidden
    resp_rec = client.get("/api/v1/admin/users", headers=headers_recruiter)
    assert resp_rec.status_code == 403

    # Admin is authorized
    resp_admin = client.get("/api/v1/admin/users", headers=headers_admin)
    assert resp_admin.status_code == 200
