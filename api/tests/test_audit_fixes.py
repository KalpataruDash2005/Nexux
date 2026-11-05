import asyncio
import os
import pytest
import json
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.base import User, Task, PlacementSession, PlacementResume
from app.services.task_service import TaskService
from app.schemas.tasks import AssistantRequest
from app.services.placement_service import PlacementService
from app.schemas.placement import CreateSessionBody, SubmitCodingBody
from app.rag.pipeline import rag_pipeline

# ============================================================================
# PHASE 3 & 4: TASK ASSISTANT & AI PLANNER
# ============================================================================

def test_task_assistant_creates_transactional_task(db_session: Session, test_user: User):
    async def _test():
        service = TaskService(db_session)

        mock_ai_response = {
            "action": "CREATE_TASK",
            "replyMessage": "I have created the task 'Complete OS Assignment'.",
            "taskTitle": "Complete OS Assignment",
            "deadline": "2026-11-15T23:59:00"
        }

        with patch("app.services.task_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_response
            req = AssistantRequest(
                message="Add a task to complete OS assignment by Nov 15"
            )
            res = await service.handle_assistant(test_user, req)

        assert res.createdTask is not None
        assert res.createdTask.title == "Complete OS Assignment"
        assert res.action == "CREATE_TASK"

        # Verify task was persisted in DB
        saved_task = db_session.query(Task).filter(Task.id == res.createdTask.id).first()
        assert saved_task is not None
        assert saved_task.user_id == test_user.id
        assert saved_task.title == "Complete OS Assignment"

    asyncio.run(_test())

def test_task_assistant_missing_title_asks_followup(db_session: Session, test_user: User):
    async def _test():
        service = TaskService(db_session)

        mock_ai_response = {
            "action": "NEED_INFO",
            "replyMessage": "Sure! What is the title or objective of the task you would like to create?",
            "taskTitle": None
        }

        with patch("app.services.task_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_ai_response
            req = AssistantRequest(
                message="Please create a task for tomorrow"
            )
            res = await service.handle_assistant(test_user, req)

        assert res.createdTask is None
        assert "What is the title" in res.replyMessage
        tasks_count = db_session.query(Task).filter(Task.user_id == test_user.id).count()
        assert tasks_count == 0

    asyncio.run(_test())

def test_task_assistant_deterministic_regex_fallback(db_session: Session, test_user: User):
    async def _test():
        service = TaskService(db_session)

        # Simulate AI provider timeout/failure
        with patch("app.services.task_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = RuntimeError("xAI API timeout")
            req = AssistantRequest(
                message="Create a task to submit distributed systems lab by tomorrow"
            )
            res = await service.handle_assistant(test_user, req)

        assert res.createdTask is not None
        assert "distributed systems lab" in res.createdTask.title.lower()
        assert "Created task" in res.replyMessage
        assert res.action == "CREATE_TASK"

    asyncio.run(_test())

def test_ai_planner_empty_pending_tasks_graceful_response(db_session: Session, test_user: User):
    async def _test():
        service = TaskService(db_session)

        plan_res = await service.generate_ai_plan(test_user)
        assert "no pending tasks" in plan_res.plan.lower()

    asyncio.run(_test())

def test_ai_planner_grounded_strictly_on_pending_tasks(db_session: Session, test_user: User):
    async def _test():
        service = TaskService(db_session)

        t1 = Task(title="Study Algorithms Chapter 4", user_id=test_user.id, status="PENDING")
        t2 = Task(title="Prepare Graph Presentation", user_id=test_user.id, status="PENDING")
        db_session.add_all([t1, t2])
        db_session.commit()
        db_session.refresh(t1)
        db_session.refresh(t2)

        mock_plan_text = f"1. [Task ID: {t1.id[:8]}] Study Algorithms Chapter 4 - 09:00 to 10:30\n2. [Task ID: {t2.id[:8]}] Prepare Graph Presentation - 11:00 to 12:30"

        with patch("app.services.task_service.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_plan_text
            plan_res = await service.generate_ai_plan(test_user)

        assert t1.id[:8] in plan_res.plan
        assert t2.id[:8] in plan_res.plan
        assert "Study Algorithms" in plan_res.plan

    asyncio.run(_test())

# ============================================================================
# PHASE 5: PDF RAG GROUNDED CITATIONS & REFUSAL
# ============================================================================

def test_rag_pipeline_grounded_refusal_when_no_context():
    system_prompt, user_prompt, sources = rag_pipeline._assemble_prompt("What is quantum computing?", [])
    assert "Grounding Rules" in system_prompt
    assert "NO RELEVANT DOCUMENT EXCERPTS FOUND" in user_prompt
    assert len(sources) == 0

def test_rag_pipeline_chunk_citations_formatting():
    chunks = [
        {"chunk_id": "c1", "chunk_index": 0, "text": "Linear regression models relationships using straight lines.", "score": 0.88},
        {"chunk_id": "c2", "chunk_index": 1, "text": "Logistic regression uses a sigmoid curve for classification.", "score": 0.82}
    ]
    system_prompt, user_prompt, sources = rag_pipeline._assemble_prompt("Explain regression", chunks)
    assert "Chunk #0" in user_prompt
    assert "Chunk #1" in user_prompt
    assert "Linear regression models" in user_prompt
    assert len(sources) == 2
    assert "Chunk #0" in sources[0]
    assert "Chunk #1" in sources[1]

# ============================================================================
# PHASE 6: MOCK INTERVIEW & RESUME BINDING
# ============================================================================

def test_mock_interview_resume_mode_validation(db_session: Session, test_user: User):
    service = PlacementService(db_session)

    # 1. Non-existent resume should raise 404
    body = CreateSessionBody(type="INTERVIEW", mode="RESUME", resumeId="non-existent-id")
    with pytest.raises(HTTPException) as exc_info:
        service.create_session(test_user, body)
    assert exc_info.value.status_code == 404
    assert "Selected resume was not found" in exc_info.value.detail

    # 2. AI-only mode should succeed without resume
    ai_body = CreateSessionBody(type="INTERVIEW", mode="AI", role="Backend Engineer")
    session_res = service.create_session(test_user, ai_body)
    assert session_res.id is not None
    assert session_res.mode == "AI"

def test_mock_interview_loads_user_resume_content(db_session: Session, test_user: User):
    async def _test():
        service = PlacementService(db_session)

        resume = PlacementResume(
            owner_id=test_user.id,
            file_name="kailash_resume.pdf",
            text="Experienced Python FastAPI developer who built distributed stream processing on AWS."
        )
        db_session.add(resume)
        db_session.commit()
        db_session.refresh(resume)

        body = CreateSessionBody(type="INTERVIEW", mode="RESUME", resumeId=resume.id)
        session_dto = service.create_session(test_user, body)

        with patch("app.services.placement_service.ai_gateway.generate", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = "Tell me about how you built distributed stream processing on AWS."
            start_res = await service.start_session(session_dto.id, test_user)

            # Verify resume text was loaded into the system prompt passed to ai_gateway
            call_kwargs = mock_gen.call_args[1]
            assert "Experienced Python FastAPI developer" in call_kwargs["system_prompt"]
            assert start_res.question == "Tell me about how you built distributed stream processing on AWS."

    asyncio.run(_test())

# ============================================================================
# PHASE 7: TRUTHFUL CODING EVALUATION & SAFE SANDBOX BOUNDARY
# ============================================================================

def test_coding_submission_rejects_empty_code(db_session: Session, test_user: User):
    async def _test():
        service = PlacementService(db_session)
        session = PlacementSession(owner_id=test_user.id, type="CODING", status="ACTIVE")
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        with pytest.raises(HTTPException) as exc_info:
            await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code="   "))
        assert exc_info.value.status_code == 400
        assert "Code submission cannot be empty" in exc_info.value.detail

    asyncio.run(_test())

def test_coding_submission_rejects_unsupported_language(db_session: Session, test_user: User):
    async def _test():
        service = PlacementService(db_session)
        session = PlacementSession(owner_id=test_user.id, type="CODING", status="ACTIVE")
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        with pytest.raises(HTTPException) as exc_info:
            await service.submit_coding(session.id, test_user, SubmitCodingBody(language="ruby", code="puts 'hello'"))
        assert exc_info.value.status_code == 400
        assert "Unsupported language 'ruby'" in exc_info.value.detail

    asyncio.run(_test())

def test_coding_submission_python_syntax_error_ast_check(db_session: Session, test_user: User):
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Reverse String",
            "statement": "Reverse a given string",
            "testCases": [
                {"input": '"hello"', "expectedOutput": '"olleh"', "hidden": False},
                {"input": '"world"', "expectedOutput": '"dlrow"', "hidden": False}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        invalid_code = "def reverse_string(s):\n    return s[::-1"  # Missing closing bracket
        res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=invalid_code))

        assert res.passed is False
        assert res.totalScore == 0
        assert res.passedTests == 0
        assert res.totalTests == 2
        assert "SyntaxError" in res.evaluation.feedback
        assert "Error" in res.evaluation.timeComplexity
        assert "(Estimated)" in res.evaluation.timeComplexity
        assert "Error" in res.evaluation.spaceComplexity
        assert "(Estimated)" in res.evaluation.spaceComplexity
        assert len(res.testResults) == 2
        assert res.testResults[0].passed is False

    asyncio.run(_test())

def test_coding_submission_complexity_labeled_as_estimated(db_session: Session, test_user: User):
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Two Sum",
            "statement": "Find two indices that sum to target",
            "testCases": [
                {"input": "[2, 7, 11, 15], 9", "expectedOutput": "[0, 1]", "hidden": False}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_eval = {
            "correctness": 95,
            "timeComplexity": "O(N)",
            "spaceComplexity": "O(N)",
            "codeQuality": 90,
            "naming": 90,
            "optimization": 85,
            "feedback": "Optimal hash map solution with linear runtime.",
            "alternativeSolutions": ["Two-pointer sorted approach"],
            "expectedQuestions": ["What if numbers can be negative?"],
            "testResults": [
                {
                    "input": "[2, 7, 11, 15], 9",
                    "expectedOutput": "[0, 1]",
                    "actualOutput": "[0, 1]",
                    "passed": True,
                    "error": None,
                    "hidden": False
                }
            ]
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_eval
            valid_code = (
                "def two_sum(nums, target):\n"
                "    seen = {}\n"
                "    for i, n in enumerate(nums):\n"
                "        if target - n in seen:\n"
                "            return [seen[target - n], i]\n"
                "        seen[n] = i\n"
                "    return []\n"
            )
            res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=valid_code))

        assert res.passed is True
        assert res.passedTests == 1
        assert res.totalTests == 1
        assert "(Estimated)" in res.evaluation.timeComplexity
        assert "(Estimated)" in res.evaluation.spaceComplexity

    asyncio.run(_test())

def test_coding_submission_failing_tests_constrains_correctness(db_session: Session, test_user: User):
    """When test cases fail, correctness cannot be inflated and passed must be False."""
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Two Sum",
            "statement": "Find two indices that sum to target",
            "testCases": [
                {"input": "[2, 7], 9", "expectedOutput": "[0, 1]", "hidden": False},
                {"input": "[3, 3], 6", "expectedOutput": "[0, 1]", "hidden": False}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # AI hallucinated 90 correctness even though test results failed
        mock_eval = {
            "correctness": 90,
            "timeComplexity": "O(N)",
            "spaceComplexity": "O(1)",
            "codeQuality": 70,
            "naming": 70,
            "optimization": 60,
            "feedback": "Code returned wrong indices.",
            "alternativeSolutions": [],
            "expectedQuestions": [],
            "testResults": [
                {"input": "[2, 7], 9", "expectedOutput": "[0, 1]", "actualOutput": "None", "passed": False, "error": "Mismatch", "hidden": False},
                {"input": "[3, 3], 6", "expectedOutput": "[0, 1]", "actualOutput": "None", "passed": False, "error": "Mismatch", "hidden": False}
            ]
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_eval
            wrong_code = "def two_sum(nums, target):\n    return None\n"
            res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=wrong_code))

        # Because 0/2 tests passed, correctness must be strictly clamped <= 15
        assert res.passed is False
        assert res.evaluation.correctness <= 15
        assert res.passedTests == 0
        assert res.totalTests == 2

    asyncio.run(_test())

def test_coding_submission_ai_exception_does_not_pass(db_session: Session, test_user: User):
    """When AI provider errors, service must return failure state, NEVER fake passing 75 grade."""
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Reverse",
            "statement": "Reverse string",
            "testCases": [{"input": '"a"', "expectedOutput": '"a"', "hidden": False}]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = RuntimeError("Upstream provider failure")
            code = "def rev(s):\n    return s\n"
            res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=code))

        assert res.passed is False
        assert res.totalScore == 0
        assert res.evaluation.correctness == 0
        assert res.passedTests == 0
        assert res.testResults[0].passed is False

    asyncio.run(_test())

def test_pdf_file_endpoint_query_token_and_auth(client, db_session: Session, test_user: User):
    """Test that PDF file endpoint supports both header and ?token= query parameter, and rejects unauthenticated requests."""
    from app.models.base import Workspace, PdfDocument
    from app.core.security import create_access_token

    # Setup workspace and document
    ws = Workspace(owner_id=test_user.id, name="Test WS")
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    doc = PdfDocument(
        workspace_id=ws.id,
        owner_id=test_user.id,
        file_name="sample.pdf",
        storage_key=f"{ws.id}_testkey",
        file_size=100,
        content_type="application/pdf",
        status="READY"
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    # Create dummy file on disk in UPLOAD_DIR
    import os
    upload_dir = os.path.join(os.getcwd(), "uploads", "pdf")
    os.makedirs(upload_dir, exist_ok=True)
    sample_file = os.path.join(upload_dir, f"{doc.storage_key}.pdf")
    with open(sample_file, "wb") as f:
        f.write(b"%PDF-1.4 test binary content")

    token = create_access_token(test_user.email)

    try:
        # 1. Unauthenticated request -> 401
        res_no_auth = client.get(f"/api/v1/pdf-assistant/workspaces/{ws.id}/documents/{doc.id}/file")
        assert res_no_auth.status_code == 401

        # 2. Authenticated via Bearer header -> 200
        res_header = client.get(
            f"/api/v1/pdf-assistant/workspaces/{ws.id}/documents/{doc.id}/file",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert res_header.status_code == 200
        assert res_header.headers["content-type"] == "application/pdf"
        assert b"%PDF-1.4" in res_header.content

        # 3. Authenticated via ?token= query parameter -> 200
        res_query = client.get(
            f"/api/v1/pdf-assistant/workspaces/{ws.id}/documents/{doc.id}/file?token={token}"
        )
        assert res_query.status_code == 200
        assert res_query.headers["content-type"] == "application/pdf"
        assert b"%PDF-1.4" in res_query.content
    finally:
        if os.path.exists(sample_file):
            os.remove(sample_file)

def test_coding_submission_runtime_error_fails_and_scores_zero(db_session: Session, test_user: User):
    """Runtime exceptions in code (e.g. division by zero) must fail tests and yield 0/low correctness."""
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Divide",
            "statement": "Divide numbers",
            "testCases": [{"input": "4, 0", "expectedOutput": "None", "hidden": False}]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_eval = {
            "correctness": 0,
            "timeComplexity": "O(1) (Estimated)",
            "spaceComplexity": "O(1) (Estimated)",
            "codeQuality": 30,
            "naming": 40,
            "optimization": 0,
            "feedback": "Code produced ZeroDivisionError during execution.",
            "alternativeSolutions": ["Add guard condition checking if denominator == 0."],
            "expectedQuestions": ["How do you handle edge-case arithmetic exceptions?"],
            "testResults": [
                {
                    "input": "4, 0",
                    "expectedOutput": "None",
                    "actualOutput": "ZeroDivisionError: division by zero",
                    "passed": False,
                    "error": "ZeroDivisionError",
                    "hidden": False
                }
            ]
        }

        with patch("app.services.code_execution_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_eval
            bad_code = "def divide(a, b):\n    return a / b\n"
            res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=bad_code))

        assert res.passed is False
        assert res.evaluation.correctness == 0
        assert res.passedTests == 0
        assert res.testResults[0].passed is False

    asyncio.run(_test())

def test_coding_submission_timeout_handled_gracefully(db_session: Session, test_user: User):
    """Execution timeout must fail the submission cleanly with 0 score and helpful feedback."""
    async def _test():
        service = PlacementService(db_session)
        problem = {
            "title": "Infinite Loop",
            "statement": "Sum to N",
            "testCases": [{"input": "5", "expectedOutput": "15", "hidden": False}]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        with patch("app.services.code_execution_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.side_effect = TimeoutError("Evaluation execution exceeded 30.0s time limit")
            infinite_code = "def loop(n):\n    while True:\n        pass\n"
            res = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=infinite_code))

        assert res.passed is False
        assert res.evaluation.correctness == 0
        assert res.passedTests == 0
        assert "temporarily unavailable" in res.evaluation.feedback or "error" in res.testResults[0].error.lower()

    asyncio.run(_test())

def test_pdf_file_endpoint_unauthorized_user_access_blocked(client, db_session: Session, test_user: User):
    """A user cannot access another user's PDF document even with a valid token."""
    from app.models.base import Workspace, PdfDocument, User
    from app.core.security import create_access_token, get_password_hash

    # Create other user
    other_user = User(email="other_student@nexora.app", password_hash=get_password_hash("pass"), role="STUDENT")
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)

    ws = Workspace(owner_id=other_user.id, name="Other WS")
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    doc = PdfDocument(
        workspace_id=ws.id,
        owner_id=other_user.id,
        file_name="private.pdf",
        storage_key=f"{ws.id}_privatekey",
        file_size=100,
        content_type="application/pdf",
        status="READY"
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    # Current user tries to access other_user's document
    token = create_access_token(test_user.email)
    res = client.get(
        f"/api/v1/pdf-assistant/workspaces/{ws.id}/documents/{doc.id}/file",
        headers={"Authorization": f"Bearer {token}"}
    )
    # Returns 404 because get_by_id_and_owner enforces ownership
    assert res.status_code == 404

def test_pdf_file_endpoint_invalid_document_id_returns_404(client, db_session: Session, test_user: User):
    """Requesting an invalid document ID returns 404."""
    from app.models.base import Workspace
    from app.core.security import create_access_token

    ws = Workspace(owner_id=test_user.id, name="Valid WS")
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    token = create_access_token(test_user.email)
    res = client.get(
        f"/api/v1/pdf-assistant/workspaces/{ws.id}/documents/nonexistent-doc-id/file",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 404

def test_pdf_file_reconstruction_when_disk_file_missing(db_session: Session, test_user: User):
    """When a document binary file is missing from disk, service reconstructs a valid compliant PDF."""
    from app.models.base import Workspace, PdfDocument
    from app.services.pdf_assistant_service import PdfAssistantService, UPLOAD_DIR

    ws = Workspace(owner_id=test_user.id, name="Reconstruct WS")
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    doc = PdfDocument(
        workspace_id=ws.id,
        owner_id=test_user.id,
        file_name="Lecture_Notes.pdf",
        storage_key=f"{ws.id}_reconstructkey",
        file_size=500,
        content_type="application/pdf",
        status="READY",
        summary="### 1. Document Overview & Scope\n- Title: Lecture Notes\n- Concepts: Algorithms and Data Structures\n\n### 2. Objectives\nComprehensive computer science foundations."
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    service = PdfAssistantService(db_session)
    d, file_path = service.get_document_file(ws.id, doc.id, test_user)

    assert os.path.exists(file_path)
    assert file_path.endswith(".pdf")
    with open(file_path, "rb") as f:
        content = f.read()
    assert content.startswith(b"%PDF-")
    # Clean up
    if os.path.exists(file_path):
        os.remove(file_path)

def test_comprehensive_summary_preserves_nine_sections_and_multiline_markdown():
    """Summary generator produces all 9 Markdown sections without truncated structure."""
    from app.services.pdf_assistant_service import _build_fallback_structured_summary

    sample_doc = (
        "Operating systems manage computer hardware resources and provide common services for software applications.\n\n"
        "Key concepts include processes, threads, virtual memory management, file systems, and CPU scheduling.\n\n"
        "Processes transition between New, Ready, Running, Waiting, and Terminated lifecycle states.\n\n"
        "CPU scheduling algorithms include First-Come-First-Served (FCFS), Shortest Job First (SJF), and Round Robin (RR).\n\n"
        "Virtual memory uses paging and segmentation to map logical addresses to physical RAM frames.\n\n"
        "Deadlocks require four Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait."
    )
    summary = _build_fallback_structured_summary(sample_doc, "OS_Lecture.pdf")
    for i in range(1, 10):
        assert f"### {i}." in summary
    assert "Operating systems manage computer hardware" in summary


