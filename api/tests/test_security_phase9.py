import pytest
import asyncio
from app.core.config import settings
from app.services.code_execution_service import CodeExecutionService, MAX_CODE_LENGTH

def test_host_execution_disabled_by_default():
    """Verify that host code execution is disabled by policy in production/serverless."""
    assert settings.ENABLE_HOST_CODE_EXECUTION is False
    assert settings.is_host_execution_permitted is False
    success, stdout, stderr, status, _ = CodeExecutionService.execute_in_sandbox(
        "python", "print('hello')", ""
    )
    assert success is False
    assert status == "Compilation Error"
    assert "Host code execution is disabled" in stderr

def test_static_analyzer_python_prohibited_imports():
    """Verify Python static analyzer catches dangerous imports."""
    # os module
    is_safe, err = CodeExecutionService.validate_code_security("python", "import os\ndef solution(): pass")
    assert is_safe is False
    assert "os" in err

    # subprocess
    is_safe, err = CodeExecutionService.validate_code_security("python", "import subprocess\ndef solution(): pass")
    assert is_safe is False
    assert "subprocess" in err

    # socket from import
    is_safe, err = CodeExecutionService.validate_code_security("python", "from socket import socket\ndef solution(): pass")
    assert is_safe is False
    assert "socket" in err

    # dynamic calls
    is_safe, err = CodeExecutionService.validate_code_security("python", "x = eval('2 + 2')")
    assert is_safe is False
    assert "eval" in err

def test_static_analyzer_multilingual():
    """Verify static analyzer catches dangerous constructs in JS, C++, Java."""
    # JS child_process
    is_safe, err = CodeExecutionService.validate_code_security("javascript", "const cp = require('child_process');")
    assert is_safe is False
    assert "Security Violation" in err

    # C++ unistd
    is_safe, err = CodeExecutionService.validate_code_security("cpp", "#include <unistd.h>\nint main() { return 0; }")
    assert is_safe is False
    assert "Security Violation" in err

    # Java ProcessBuilder
    is_safe, err = CodeExecutionService.validate_code_security("java", "class Solution { ProcessBuilder pb; }")
    assert is_safe is False
    assert "Security Violation" in err

def test_benign_algorithmic_code_passes():
    """Verify standard algorithmic code passes static analysis without false positives."""
    py_code = """
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
"""
    is_safe, err = CodeExecutionService.validate_code_security("python", py_code)
    assert is_safe is True
    assert err is None

    is_syntax_ok, syn_err = CodeExecutionService.validate_syntax_and_compilation("python", py_code)
    assert is_syntax_ok is True
    assert syn_err is None

def test_oversized_code_rejected():
    """Verify code exceeding MAX_CODE_LENGTH is rejected."""
    oversized = "# benign comment\n" * 3500  # > 50,000 characters
    assert len(oversized) > MAX_CODE_LENGTH

    problem = {"id": "prob-1", "statement": "Add two numbers"}
    test_cases = [{"input": "1, 2", "expectedOutput": "3", "hidden": False}]

    run_res = asyncio.run(CodeExecutionService.run_code(
        problem, test_cases, "python", oversized
    ))
    assert run_res.status == "Compilation Error"
    assert "exceeds maximum allowable limit" in run_res.compilationError

    eval_res = asyncio.run(CodeExecutionService.evaluate_submission(
        problem, test_cases, "python", oversized
    ))
    assert eval_res.status == "Compilation Error"
    assert "exceeds maximum allowable limit" in eval_res.evaluation.feedback

def test_malicious_code_blocked_in_run_and_evaluate():
    """Verify dangerous code is rejected by both run_code and evaluate_submission."""
    malicious = "import os\ndef solve(): return 1"
    problem = {"id": "prob-2", "statement": "Test problem"}
    test_cases = [
        {"input": "1", "expectedOutput": "1", "hidden": False},
        {"input": "2", "expectedOutput": "2", "hidden": True}
    ]

    run_res = asyncio.run(CodeExecutionService.run_code(
        problem, test_cases, "python", malicious
    ))
    assert run_res.status == "Compilation Error"
    assert "Security Violation" in run_res.compilationError

    eval_res = asyncio.run(CodeExecutionService.evaluate_submission(
        problem, test_cases, "python", malicious
    ))
    assert eval_res.status == "Compilation Error"
    assert "Security Violation" in eval_res.evaluation.feedback
    assert len(eval_res.testResults) == 2
    # Hidden test case must have masked inputs/outputs
    hidden_tc = next(tr for tr in eval_res.testResults if tr.hidden)
    assert hidden_tc.input == "[Hidden Test Case]"
    assert hidden_tc.expectedOutput == "[Hidden Expected Output]"
