import time
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.cache import InMemoryLRUCache, CacheManager
from app.core.rate_limiter import InMemoryRateLimiter
from app.core.config import settings
from app.models.base import User, Workspace, PdfDocument, Task
from app.repositories.workspace_repository import WorkspaceRepository
from app.repositories.task_repository import TaskRepository
from app.vectorstore.qdrant_service import qdrant_service
from app.rag.pipeline import rag_pipeline

def test_cache_lru_eviction_and_ttl():
    # Cache with capacity 2 and TTL 1 second
    cache = InMemoryLRUCache(max_entries=2, default_ttl=1)
    cache.set("k1", "v1")
    cache.set("k2", "v2")

    assert cache.get("k1") == "v1"
    assert cache.get("k2") == "v2"

    # Insert 3rd item -> k1 was accessed before k2, so k1 is older?
    # Actually k1 was accessed, then k2 was accessed. So k1 is LRU.
    cache.set("k3", "v3")

    assert cache.get("k3") == "v3"
    assert cache.get("k2") == "v2"
    assert cache.get("k1") is None  # Evicted

    # Test TTL expiration
    time.sleep(1.1)
    assert cache.get("k2") is None  # Expired
    assert cache.get("k3") is None  # Expired

def test_cache_manager_key_isolation():
    manager = CacheManager()
    key_user_a = manager.build_key("ai", "user_123", "RESUME_ANALYSIS", "prompt_hash_abc")
    key_user_b = manager.build_key("ai", "user_456", "RESUME_ANALYSIS", "prompt_hash_abc")
    key_global = manager.build_key("ref", None, "aptitude", "set_1")

    assert key_user_a != key_user_b  # Multi-tenant isolation
    assert "user_123" in key_user_a
    assert "user_456" in key_user_b
    assert "global" in key_global

def test_in_memory_rate_limiter():
    limiter = InMemoryRateLimiter()
    client = "192.168.1.100:/api/v1/test"

    # Allow 3 requests in 10-second window
    allowed1, _ = limiter.check_rate_limit(client, max_requests=3, window_seconds=10)
    allowed2, _ = limiter.check_rate_limit(client, max_requests=3, window_seconds=10)
    allowed3, _ = limiter.check_rate_limit(client, max_requests=3, window_seconds=10)
    allowed4, _ = limiter.check_rate_limit(client, max_requests=3, window_seconds=10)

    assert allowed1 is True
    assert allowed2 is True
    assert allowed3 is True
    assert allowed4 is False  # Throttled

def test_correlation_id_middleware(client: TestClient):
    response = client.get("/health")
    assert response.status_code == 200
    assert "X-Request-ID" in response.headers
    assert response.headers["X-Request-ID"].startswith("req_")
    assert "X-Response-Time" in response.headers

    # Custom correlation ID propagation
    custom_id = "trace-corp-999"
    resp_custom = client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp_custom.headers.get("X-Request-ID") == custom_id

def test_idempotent_qdrant_chunk_ingestion():
    ws_id = "test-ws-idempotent"
    doc_id = "test-doc-idempotent"
    text = "Idempotent vector ingestion prevents duplicate points in vector storage."

    # Index first time
    count1 = rag_pipeline.index_text(ws_id, doc_id, text)
    assert count1 >= 1

    # Index second time with identical document ID
    count2 = rag_pipeline.index_text(ws_id, doc_id, text)
    assert count2 == count1

    # Search: hits should reflect one copy of chunks, not duplicates
    hits = rag_pipeline.search_context(ws_id, "Idempotent vector ingestion", top_k=10)
    matching_doc_hits = [h for h in hits if h["documentId"] == doc_id]
    assert len(matching_doc_hits) == count1

    # Cleanup
    rag_pipeline.delete_document_vectors(ws_id, doc_id)

def test_single_query_workspace_aggregation(db_session: Session, test_user: User):
    repo = WorkspaceRepository(db_session)
    ws = Workspace(name="Aggregation Test Workspace", owner_id=test_user.id)
    db_session.add(ws)
    db_session.commit()

    # Add 3 dummy pdf documents
    for i in range(3):
        doc = PdfDocument(
            workspace_id=ws.id,
            owner_id=test_user.id,
            file_name=f"test_{i}.pdf",
            file_size=1024,
            storage_key=f"key_{i}"
        )
        db_session.add(doc)
    db_session.commit()

    # Single-roundtrip query with aggregated counts
    results = repo.get_all_by_owner_with_doc_counts(test_user.id)
    matching = next((item for item in results if item[0].id == ws.id), None)
    assert matching is not None
    workspace_obj, doc_count = matching
    assert doc_count == 3

def test_sql_level_task_summary_aggregation(db_session: Session, test_user: User):
    repo = TaskRepository(db_session)
    t1 = Task(user_id=test_user.id, title="Task 1", status="COMPLETED")
    t2 = Task(user_id=test_user.id, title="Task 2", status="PENDING")
    t3 = Task(user_id=test_user.id, title="Task 3", status="IN_PROGRESS")
    db_session.add_all([t1, t2, t3])
    db_session.commit()

    summary = repo.get_summary(test_user.id)
    assert summary["total"] >= 3
    assert summary["completed"] >= 1
    assert summary["pending"] >= 2
