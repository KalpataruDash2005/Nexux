import asyncio
import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from sqlalchemy.orm import Session

from app.models.base import User, Task, AiConversation, AiMemory
from app.services.task_service import TaskService
from app.schemas.tasks import CreateTaskRequest

def test_task_planner_scenario_1_valid_pending_tasks_structured_plan(db_session: Session, test_user: User):
    """Scenario 1: Valid pending tasks produce a grounded, structured plan preview referencing real IDs."""
    async def _test():
        service = TaskService(db_session)

        # Create two real tasks in DB
        t1 = service.create_task(test_user, CreateTaskRequest(
            title="Complete System Architecture RFC",
            deadline=datetime.utcnow() + timedelta(days=1)
        ))
        t2 = service.create_task(test_user, CreateTaskRequest(
            title="Implement Token Bucket Rate Limiter",
            deadline=datetime.utcnow() + timedelta(days=2)
        ))

        mock_plan_output = (
            "**Daily Action Plan Summary**\n"
            "Today's focus is dedicated to high-impact architecture delivery followed by core networking implementation.\n\n"
            "**Prioritized Task Schedule**\n"
            f"1. **Complete System Architecture RFC** (`Task ID: {t1.id[:8]}`) | 09:00 - 11:30 | Urgent deadline tomorrow.\n"
            f"2. **Implement Token Bucket Rate Limiter** (`Task ID: {t2.id[:8]}`) | 13:00 - 15:30 | Foundational middleware.\n\n"
            "**At-Risk & Overdue Tasks**\n"
            f"- `[Task ID: {t1.id[:8]}]` is due in 24 hours. Prioritize first.\n\n"
            "**Break Intervals & Wellness**\n"
            "- 15-minute break at 11:30.\n"
            "- 60-minute lunch pause at 12:00."
        )

        with patch("app.services.task_service.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_plan_output
            res = await service.generate_ai_plan(test_user)

        assert res.pendingCount == 2
        assert len(res.tasksIncluded) == 2
        assert "**Daily Action Plan Summary**" in res.plan
        assert "**Prioritized Task Schedule**" in res.plan
        assert t1.id[:8] in res.plan
        assert t2.id[:8] in res.plan
        assert "**At-Risk & Overdue Tasks**" in res.plan
        assert "**Break Intervals & Wellness**" in res.plan

    asyncio.run(_test())

def test_task_planner_scenario_2_zero_pending_tasks_informative_empty_state(db_session: Session, test_user: User):
    """Scenario 2: When user has 0 pending tasks, return an informative message rather than failing or hallucinating."""
    async def _test():
        service = TaskService(db_session)

        # Ensure no pending tasks
        db_session.query(Task).filter(Task.user_id == test_user.id).delete()
        db_session.commit()

        res = await service.generate_ai_plan(test_user)
        assert res.pendingCount == 0
        assert "No Pending Tasks Found" in res.plan
        assert len(res.tasksIncluded) == 0

    asyncio.run(_test())

def test_task_planner_scenario_3_malformed_model_response_fallback(db_session: Session, test_user: User):
    """Scenario 3: If provider returns unstructured or malformed output, fallback generates schedule from raw tasks."""
    async def _test():
        service = TaskService(db_session)

        t1 = service.create_task(test_user, CreateTaskRequest(title="Write Unit Tests"))

        with patch("app.services.task_service.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = Exception("Malformed response: upstream json corrupted")
            res = await service.generate_ai_plan(test_user)

        assert res.pendingCount >= 1
        assert "Daily Action Plan Summary" in res.plan
        assert "Prioritized Task Schedule" in res.plan
        assert "Write Unit Tests" in res.plan
        assert t1.id[:8] in res.plan

    asyncio.run(_test())

def test_task_planner_scenario_4_provider_timeout_graceful_degradation(db_session: Session, test_user: User):
    """Scenario 4: Upstream gateway timeout falls back gracefully without dropping pending tasks."""
    async def _test():
        service = TaskService(db_session)

        t1 = service.create_task(test_user, CreateTaskRequest(title="Optimize MySQL Indexes"))

        with patch("app.services.task_service.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = TimeoutError("Grok upstream gateway timeout after 180s")
            res = await service.generate_ai_plan(test_user)

        assert "temporarily resting" in res.plan
        assert "Optimize MySQL Indexes" in res.plan
        assert res.pendingCount >= 1

    asyncio.run(_test())

def test_task_planner_scenario_5_plan_persistence_and_database_update(db_session: Session, test_user: User):
    """Scenario 5: Persisting plan updates AiConversation, AiMemory, and annotates pending tasks in DB."""
    service = TaskService(db_session)

    t1 = service.create_task(test_user, CreateTaskRequest(title="Review Pull Request #42"))

    plan_content = (
        "**Daily Action Plan Summary**\n"
        "Focus on code reviews.\n\n"
        "**Prioritized Task Schedule**\n"
        f"1. **Review Pull Request #42** (`Task ID: {t1.id[:8]}`) | 10:00 - 11:00"
    )

    persist_res = service.persist_ai_plan(test_user, plan_content, save_notes_to_tasks=True)

    assert persist_res.success is True
    assert persist_res.updatedTasksCount >= 1

    # Verify AiConversation record was created
    conv = db_session.query(AiConversation).filter(
        AiConversation.user_id == test_user.id,
        AiConversation.role == "AI"
    ).order_by(AiConversation.created_at.desc()).first()

    assert conv is not None
    assert "Persisted AI Daily Action Plan" in conv.content
    assert t1.id[:8] in conv.content

    # Verify task progress_notes were annotated
    refreshed_task = db_session.query(Task).filter(Task.id == t1.id).first()
    assert refreshed_task is not None
    assert "[AI Plan" in refreshed_task.progress_notes
    assert "Scheduled in daily plan" in refreshed_task.progress_notes

    # Verify AiMemory record was updated
    mem = db_session.query(AiMemory).filter(
        AiMemory.user_id == test_user.id,
        AiMemory.mem_key == "latest_ai_plan_summary"
    ).first()
    assert mem is not None
    assert "Plan generated at" in mem.mem_value
