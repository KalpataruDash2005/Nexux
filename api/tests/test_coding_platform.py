import pytest
from app.core.config import settings

@pytest.fixture(autouse=True)
def enable_host_exec_for_platform_tests(monkeypatch):
    monkeypatch.setattr(settings, "ENABLE_HOST_CODE_EXECUTION", True)

import asyncio
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.base import User, PlacementSession
from app.services.placement_service import PlacementService
from app.services.code_execution_service import CodeExecutionService
from app.schemas.placement import (
    CreateCodingBody,
    RunCodingBody,
    SubmitCodingBody,
    CodingProblem
)

def test_coding_problem_creation_strips_hidden_testcases(db_session: Session, test_user: User):
    """Hidden test cases must NEVER be returned in the CodingProblem client response."""
    async def _test():
        service = PlacementService(db_session)
        body = CreateCodingBody(role="Software Engineer", topic="Algorithms", difficulty="MEDIUM")

        mock_problem = {
            "title": "Reverse Array",
            "statement": "Reverse elements in array",
            "examples": [{"input": "[1, 2, 3]", "output": "[3, 2, 1]"}],
            "constraints": "1 <= n <= 100",
            "difficulty": "MEDIUM",
            "topics": ["Array"],
            "testCases": [
                {"input": "[1, 2, 3]", "expectedOutput": "[3, 2, 1]", "hidden": False},
                {"input": "[4, 5]", "expectedOutput": "[5, 4]", "hidden": False},
                {"input": "[9, 9, 9]", "expectedOutput": "[9, 9, 9]", "hidden": True},
                {"input": "[]", "expectedOutput": "[]", "hidden": True}
            ]
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_problem
            resp = await service.create_coding_session(test_user, body)

        # 1. Returned problem must only have visible test cases
        assert len(resp.problem.testCases) == 2
        for tc in resp.problem.testCases:
            assert tc.hidden is False

        # 2. Database session payload must securely store ALL test cases (visible + hidden)
        session_in_db = service.repo.get_session_by_id(resp.sessionId, test_user.id)
        assert session_in_db is not None
        payload = json.loads(session_in_db.payload_json)
        assert len(payload["testCases"]) == 4

    asyncio.run(_test())

def test_run_coding_executes_only_visible_testcases(db_session: Session, test_user: User):
    """Run code executes strictly visible sample cases and never hidden cases."""
    async def _test():
        service = PlacementService(db_session)
        problem_data = {
            "title": "Sum Two Numbers",
            "statement": "Read two integers from stdin and print sum",
            "testCases": [
                {"input": "3 4", "expectedOutput": "7", "hidden": False},
                {"input": "10 20", "expectedOutput": "30", "hidden": False},
                {"input": "1000 2000", "expectedOutput": "3000", "hidden": True}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem_data)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        # Working Python solution
        code = "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n"
        body = RunCodingBody(language="python", code=code)

        run_resp = await service.run_coding(session.id, test_user, body)

        assert run_resp.passed is True
        assert run_resp.totalTests == 2  # ONLY 2 visible tests, hidden test case was NOT run
        assert run_resp.passedTests == 2
        assert run_resp.status == "Accepted"
        assert len(run_resp.testResults) == 2
        for r in run_resp.testResults:
            assert r.hidden is False
            assert r.passed is True

    asyncio.run(_test())

def test_run_coding_with_custom_input(db_session: Session, test_user: User):
    """Run code supports executing custom user input in the sandbox."""
    async def _test():
        service = PlacementService(db_session)
        problem_data = {
            "title": "Square Number",
            "statement": "Square the input integer",
            "testCases": [
                {"input": "4", "expectedOutput": "16", "hidden": False}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem_data)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        code = "import sys\nn = int(sys.stdin.read().strip())\nprint(n * n)\n"
        body = RunCodingBody(language="python", code=code, customInput="9")

        run_resp = await service.run_coding(session.id, test_user, body)

        assert run_resp.passed is True
        assert run_resp.customResult is not None
        assert run_resp.customResult.input == "9"
        assert "81" in run_resp.customResult.actualOutput

    asyncio.run(_test())

def test_submit_coding_masks_hidden_testcases_and_records_history(db_session: Session, test_user: User):
    """Submit code executes against all cases, masks hidden inputs/outputs, and records submission history."""
    async def _test():
        service = PlacementService(db_session)
        problem_data = {
            "title": "Check Even",
            "statement": "Print true if even, false if odd",
            "testCases": [
                {"input": "4", "expectedOutput": "true", "hidden": False},
                {"input": "7", "expectedOutput": "false", "hidden": True}
            ]
        }
        session = PlacementSession(
            owner_id=test_user.id,
            type="CODING",
            status="ACTIVE",
            payload_json=json.dumps(problem_data)
        )
        db_session.add(session)
        db_session.commit()
        db_session.refresh(session)

        mock_eval = {
            "correctness": 100,
            "timeComplexity": "O(1)",
            "spaceComplexity": "O(1)",
            "codeQuality": 90,
            "naming": 90,
            "optimization": 90,
            "feedback": "Optimal O(1) bitwise parity check.",
            "alternativeSolutions": ["n % 2 == 0"],
            "expectedQuestions": ["How does bitwise parity differ from modulo?"],
            "testResults": [
                {"input": "4", "expectedOutput": "true", "actualOutput": "true", "passed": True, "error": None, "hidden": False},
                {"input": "7", "expectedOutput": "false", "actualOutput": "false", "passed": True, "error": None, "hidden": True}
            ]
        }

        with patch("app.services.placement_service.ai_gateway.generate_json", new_callable=AsyncMock) as mock_gen:
            mock_gen.return_value = mock_eval
            code = "import sys\nn = int(sys.stdin.read().strip())\nprint('true' if n % 2 == 0 else 'false')\n"
            sub_resp = await service.submit_coding(session.id, test_user, SubmitCodingBody(language="python", code=code))

        # Check total tests and pass count
        assert sub_resp.passed is True
        assert sub_resp.totalTests == 2
        assert sub_resp.passedTests == 2
        assert sub_resp.status == "Accepted"
        assert sub_resp.submissionId is not None

        # Check hidden test case masking
        hidden_res = [r for r in sub_resp.testResults if r.hidden]
        assert len(hidden_res) == 1
        assert hidden_res[0].input == "[Hidden Test Case]"
        assert hidden_res[0].expectedOutput == "[Hidden Expected Output]"
        assert hidden_res[0].actualOutput == "[Hidden Output]"

        # Check submission history
        history = service.get_coding_submissions(session.id, test_user)
        assert len(history) == 1
        assert history[0].status == "Accepted"
        assert history[0].score == 100
        assert history[0].passedTests == 2

    asyncio.run(_test())

def test_sandbox_python_and_javascript_execution():
    """Verify local sandboxed subprocess execution for Python and Node.js."""
    # 1. Python execution
    py_code = "import sys\nlines = sys.stdin.read().split()\nprint(sum(map(int, lines)))\n"
    success, stdout, stderr, status, dur = CodeExecutionService.execute_in_sandbox(
        language="python",
        code=py_code,
        input_data="10 20 30",
        timeout=2.0
    )
    assert success is True
    assert status == "Success"
    assert stdout.strip() == "60"

    # 2. Node.js execution (if node available)
    if CodeExecutionService.has_compiler_or_runtime("javascript"):
        js_code = "const fs = require('fs'); const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/); console.log(Number(input[0]) * Number(input[1]));"
        js_success, js_stdout, js_stderr, js_status, js_dur = CodeExecutionService.execute_in_sandbox(
            language="javascript",
            code=js_code,
            input_data="6 7",
            timeout=2.0
        )
        assert js_success is True
        assert js_stdout.strip() == "42"

def test_sandbox_timeout_detection():
    """Verify infinite loop triggers Time Limit Exceeded."""
    inf_code = "import time\nwhile True:\n    time.sleep(0.1)\n"
    success, stdout, stderr, status, dur = CodeExecutionService.execute_in_sandbox(
        language="python",
        code=inf_code,
        input_data="",
        timeout=0.5
    )
    assert success is False
    assert status == "Time Limit Exceeded"
