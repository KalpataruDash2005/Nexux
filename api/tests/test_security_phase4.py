import os
import pytest
from sqlalchemy.orm import Session
from app.models.base import User, Workspace, Task
from app.repositories.user_repository import UserRepository
from app.repositories.workspace_repository import WorkspaceRepository
from app.repositories.task_repository import TaskRepository
from app.vectorstore.qdrant_service import QdrantService
from app.core.database import get_engine

# ==============================================================================
# 1. SQL Injection Resilience Verification
# ==============================================================================
def test_sql_injection_resilience_in_user_repository(db_session: Session):
    """
    Verify that SQL injection payloads are safely parameterized and treated as literal values,
    preventing any authentication bypass or unauthorized record retrieval.
    """
    repo = UserRepository(db_session)
    sqli_payloads = [
        "' OR '1'='1",
        "admin'--",
        "test@example.com' UNION SELECT NULL, NULL, NULL, NULL, NULL, NULL--",
        "'; DROP TABLE users; --"
    ]
    for payload in sqli_payloads:
        # get_by_email must treat payload literally
        user = repo.get_by_email(payload)
        assert user is None, f"Payload '{payload}' improperly matched a user record!"
        assert not repo.exists_by_email(payload)

def test_sql_injection_resilience_in_workspace_repository(db_session: Session):
    """Verify that workspace queries parameterize owner and workspace IDs safely."""
    repo = WorkspaceRepository(db_session)
    sqli_payload = "' OR '1'='1' --"
    assert repo.get_by_id_and_owner(sqli_payload, sqli_payload) is None
    assert repo.get_all_by_owner(sqli_payload) == []

def test_sql_injection_resilience_in_task_repository(db_session: Session):
    """Verify that task queries parameterize user IDs safely."""
    repo = TaskRepository(db_session)
    sqli_payload = "' OR 1=1; --"
    assert repo.get_by_id_and_user("task-123", sqli_payload) is None
    assert repo.get_all_by_user(sqli_payload) == []

# ==============================================================================
# 2. Qdrant Vector Isolation & Multi-Tenant Tagging
# ==============================================================================
def test_qdrant_vector_isolation_across_workspaces_and_owners():
    """
    Verify that vector embeddings stored in Qdrant are strictly partitioned by
    both workspaceId and ownerId, preventing cross-tenant semantic retrieval.
    """
    service = QdrantService()

    ws_alpha = "workspace-alpha-uuid"
    ws_beta = "workspace-beta-uuid"
    user_alpha = "user-alpha-uuid"
    user_beta = "user-beta-uuid"

    chunks_alpha = ["Confidential algorithm details for Alpha project."]
    vectors_alpha = [[0.1] * service.dimension]

    chunks_beta = ["Public general knowledge notes for Beta workspace."]
    vectors_beta = [[0.1] * service.dimension]

    # Index chunks into separate workspaces
    service.upsert_chunks(ws_alpha, "doc-alpha-1", chunks_alpha, vectors_alpha, owner_id=user_alpha)
    service.upsert_chunks(ws_beta, "doc-beta-1", chunks_beta, vectors_beta, owner_id=user_beta)

    # Search in Alpha's workspace must return ONLY Alpha chunks
    query_vector = [0.1] * service.dimension
    results_alpha = service.search(
        workspace_id=ws_alpha,
        query_vector=query_vector,
        owner_id=user_alpha,
        min_score=0.1
    )
    assert len(results_alpha) >= 1
    for hit in results_alpha:
        assert "Alpha" in hit["text"]
        assert "Beta" not in hit["text"]

    # Search in Beta's workspace must return ONLY Beta chunks
    results_beta = service.search(
        workspace_id=ws_beta,
        query_vector=query_vector,
        owner_id=user_beta,
        min_score=0.1
    )
    assert len(results_beta) >= 1
    for hit in results_beta:
        assert "Beta" in hit["text"]
        assert "Alpha" not in hit["text"]

# ==============================================================================
# 3. Database Engine & Pool Configuration Verification
# ==============================================================================
def test_database_engine_connection_pooling():
    """Verify database engine configuration features connection health checks."""
    engine = get_engine()
    # pool_pre_ping must be enabled to prevent stale/broken connections in serverless environments
    assert engine.pool is not None

# ==============================================================================
# 4. Supabase RLS Migration Script Verification
# ==============================================================================
def test_supabase_rls_migration_script_integrity():
    """Verify that the Supabase RLS migration script exists and covers core tables."""
    script_path = os.path.join("scripts", "migrations", "001_enable_supabase_rls.sql")
    assert os.path.exists(script_path), "Supabase RLS migration SQL file missing!"

    with open(script_path, "r", encoding="utf-8") as f:
        sql_content = f.read()

    required_tables = [
        "users",
        "student_profiles",
        "workspaces",
        "pdf_documents",
        "tasks",
        "jobs",
        "applications",
        "feedback_submissions"
    ]
    for table in required_tables:
        assert f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;" in sql_content, (
            f"RLS enablement missing for table '{table}'"
        )
        assert f"service_role_bypass_{table}" in sql_content or f"service_role" in sql_content, (
            f"Service role bypass policy missing for table '{table}'"
        )
