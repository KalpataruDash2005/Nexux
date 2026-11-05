import asyncio
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.base import User, Workspace, PdfDocument, PdfChatMessage
from app.services.pdf_assistant_service import PdfAssistantService
from app.rag.pipeline import rag_pipeline

def _setup_test_doc(db: Session, user: User, status="READY") -> tuple[Workspace, PdfDocument]:
    ws = Workspace(
        name="Engineering Docs",
        owner_id=user.id
    )
    db.add(ws)
    db.commit()
    db.refresh(ws)

    doc = PdfDocument(
        workspace_id=ws.id,
        owner_id=user.id,
        file_name="distributed_systems_notes.pdf",
        file_size=2048,
        content_type="application/pdf",
        storage_key="uploads/test-ws/distributed_systems_notes.pdf",
        status=status,
        chunk_count=3,
        summary="Overview of consensus algorithms and raft protocol."
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return ws, doc

def test_rag_chat_scenario_1_high_relevance_structured_format(db_session: Session, test_user: User):
    """Scenario 1: Question with high-relevance chunks returns the strict 5-part structured format."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        mock_chunks = [
            {
                "id": "chunk-1",
                "text": "The Raft consensus algorithm decomposes consensus into leader election, log replication, and safety.",
                "chunkIndex": 0,
                "score": 0.88,
                "fileName": doc.file_name
            }
        ]

        natural_llm_response = (
            "Raft breaks consensus down into three key sub-problems:\n\n"
            "- **Leader Election**: Initiated whenever heartbeat timers expire without receiving updates from the current leader.\n"
            "- **Log Replication**: Ensures all follower logs accept entries in exact sequential order and remain consistent.\n"
            "- **Safety**: Guarantees that if any server applies a log entry at a given index, no other server will apply a different log entry for that index.\n\n"
            "By decomposing state machine replication into these distinct components, Raft significantly improves understandability."
        )

        with patch.object(rag_pipeline, "search_context", return_value=mock_chunks), \
             patch("app.rag.pipeline.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = natural_llm_response
            res = await service.chat(ws.id, doc.id, test_user, "How does Raft maintain consensus?")

        assert "Leader Election" in res.answer
        assert "Log Replication" in res.answer
        assert "Safety" in res.answer
        assert len(res.sources) == 1
        assert "Chunk #0" in res.sources[0]

    asyncio.run(_test())

def test_rag_chat_scenario_2_followup_with_conversation_history(db_session: Session, test_user: User):
    """Scenario 2: Follow-up question incorporates previous conversation turns into context."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        # Seed previous exchange
        msg1 = PdfChatMessage(document_id=doc.id, owner_id=test_user.id, role="USER", content="What is Raft?")
        msg2 = PdfChatMessage(document_id=doc.id, owner_id=test_user.id, role="AI", content="Raft is a consensus algorithm.")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        mock_chunks = [
            {
                "id": "chunk-2",
                "text": "In Raft, if a follower receives no communication over an election timeout, it transitions to candidate state.",
                "chunkIndex": 1,
                "score": 0.84,
                "fileName": doc.file_name
            }
        ]

        captured_system = {}
        async def mock_generate(task, system_prompt, user_prompt, temperature, max_tokens):
            captured_system["user_prompt"] = user_prompt
            return "A follower transitions to candidate state when its election timeout elapses without receiving heartbeats."

        with patch.object(rag_pipeline, "search_context", return_value=mock_chunks), \
             patch("app.rag.pipeline.ai_gateway.generate", side_effect=mock_generate):
            res = await service.chat(ws.id, doc.id, test_user, "How does a follower become leader?")

        assert "PREVIOUS CONVERSATION HISTORY:" in captured_system["user_prompt"]
        assert "What is Raft?" in captured_system["user_prompt"]
        assert "candidate state" in res.answer

    asyncio.run(_test())

def test_rag_chat_scenario_3_no_relevant_chunks_grounded_refusal(db_session: Session, test_user: User):
    """Scenario 3: Question with no matching chunks returns a clean refusal without hallucinating."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        with patch.object(rag_pipeline, "search_context", return_value=[]):
            res = await service.chat(ws.id, doc.id, test_user, "What is the capital of Mars?")

        assert "does not appear to contain information relevant to your question" in res.answer
        assert len(res.sources) == 0

    asyncio.run(_test())

    asyncio.run(_test())

def test_rag_chat_scenario_4_empty_or_whitespace_query(db_session: Session, test_user: User):
    """Scenario 4: Empty or whitespace query raises HTTP 400."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        with pytest.raises(HTTPException) as exc_info:
            await service.chat(ws.id, doc.id, test_user, "   \n\t  ")
        assert exc_info.value.status_code == 400
        assert "empty or whitespace" in exc_info.value.detail.lower()

    asyncio.run(_test())

def test_rag_chat_scenario_5_invalid_doc_or_unauthorized_workspace(db_session: Session, test_user: User):
    """Scenario 5: Invalid document ID or unauthorized workspace raises HTTP 404."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        with pytest.raises(HTTPException) as exc_info:
            await service.chat(ws.id, "non-existent-doc-id", test_user, "Hello?")
        assert exc_info.value.status_code == 404

        other_user = User(
            id="other-user-999",
            email="other@example.com",
            password_hash="hash",
            role="STUDENT"
        )
        db_session.add(other_user)
        db_session.commit()

        # Other user cannot access test_user's document
        with pytest.raises(HTTPException) as exc_info2:
            await service.chat(ws.id, doc.id, other_user, "Hello?")
        assert exc_info2.value.status_code == 404

    asyncio.run(_test())

def test_rag_chat_scenario_6_model_timeout_graceful_fallback(db_session: Session, test_user: User):
    """Scenario 6: Model timeout degrades gracefully and returns structured answer citing raw excerpts."""
    async def _test():
        ws, doc = _setup_test_doc(db_session, test_user)
        service = PdfAssistantService(db_session)

        mock_chunks = [
            {
                "id": "chunk-10",
                "text": "Byzantine fault tolerance requires 3f + 1 nodes to tolerate f arbitrary failures.",
                "chunkIndex": 2,
                "score": 0.81,
                "fileName": doc.file_name
            }
        ]

        with patch.object(rag_pipeline, "search_context", return_value=mock_chunks), \
             patch("app.rag.pipeline.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = TimeoutError("Grok generation gateway timeout")
            res = await service.chat(ws.id, doc.id, test_user, "What is Byzantine fault tolerance threshold?")

        assert "AI response generation encountered a temporary issue" in res.answer

    asyncio.run(_test())
