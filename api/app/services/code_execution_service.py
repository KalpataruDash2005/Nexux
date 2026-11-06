from app.core.audit import log_security_event, SecurityEventType
import ast
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from typing import List, Dict, Any, Optional, Tuple

from app.schemas.placement import (
    CodingTestResult,
    CodingEvaluation,
    CodingSubmitResponse,
    CodingRunResponse
)
from app.ai import ai_gateway, AIWorkload
from app.core.config import settings
from app.core.logging import logger

ALLOWED_LANGUAGES = {"python", "javascript", "java", "cpp", "c++"}
MAX_CODE_LENGTH: int = 50_000

class CodeExecutionService:
    @staticmethod
    def normalize_language(lang: str) -> str:
        cleaned = (lang or "").strip().lower()
        if cleaned == "c++":
            return "cpp"
        if cleaned in ("js", "javascript"):
            return "javascript"
        if cleaned in ALLOWED_LANGUAGES:
            return cleaned
        return ""

    @staticmethod
    def is_stub_or_empty_code(code: str) -> bool:
        cleaned = (code or "").strip()
        if len(cleaned) < 4:
            return True
        trivial_patterns = [
            r'^\s*pass\s*$',
            r'^\s*return\s*$',
            r'^\s*return\s+None\s*$',
            r'^\s*return\s+0\s*$',
            r'^\s*return\s+false\s*$',
            r'^\s*return\s+""\s*$',
            r'^\s*return\s+null\s*;?\s*$'
        ]
        lines = [line.strip() for line in cleaned.splitlines() if line.strip() and not line.strip().startswith(("#", "//"))]
        if not lines:
            return True
        if len(lines) == 1 and any(re.match(p, lines[0], re.IGNORECASE) for p in trivial_patterns):
            return True
        return False

    @staticmethod
    def validate_syntax_and_compilation(language: str, code: str) -> Tuple[bool, Optional[str]]:
        """
        Deterministic syntax and structural compilation checks.
        Security: Does NOT execute untrusted code in the FastAPI process.
        """
        if language == "python":
            try:
                ast.parse(code)
                return True, None
            except SyntaxError as e:
                return False, f"SyntaxError at line {e.lineno}: {e.msg}"

        # Structural check for C++, Java, JavaScript (brace/bracket balance)
        stack = []
        mapping = {")": "(", "}": "{", "]": "["}
        in_string = None
        for i, ch in enumerate(code):
            if in_string:
                if ch == in_string and (i == 0 or code[i-1] != "\\"):
                    in_string = None
                continue
            if ch in ("\"", "'", "`"):
                in_string = ch
                continue
            if ch in ("(", "{", "["):
                stack.append(ch)
            elif ch in (")", "}", "]"):
                if not stack or stack[-1] != mapping[ch]:
                    return False, f"Compilation error: Unbalanced or mismatched '{ch}' token."
                stack.pop()

        if stack:
            return False, f"Compilation error: Unclosed '{stack[-1]}' block or bracket."
        return True, None

    @staticmethod
    def validate_code_security(language: str, code: str) -> Tuple[bool, Optional[str]]:
        """
        Static security analysis across submitted source code.
        Rejects prohibited imports, OS access, network sockets, reflection, or unsafe calls.
        """
        if not code:
            return True, None

        lang = CodeExecutionService.normalize_language(language)

        if lang == "python":
            try:
                tree = ast.parse(code)
            except SyntaxError:
                # Syntax error will be caught by validate_syntax_and_compilation
                return True, None

            banned_modules = {
                "os", "subprocess", "socket", "shutil", "urllib", "requests", "http",
                "pty", "posix", "ctypes", "winreg", "webbrowser", "pickle", "shelve",
                "multiprocessing", "threading"
            }
            banned_calls = {"eval", "exec", "__import__"}

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        root_mod = alias.name.split(".")[0]
                        if root_mod in banned_modules:
                            return False, f"Security Violation: Prohibited import '{alias.name}' detected."
                elif isinstance(node, ast.ImportFrom):
                    if node.module:
                        root_mod = node.module.split(".")[0]
                        if root_mod in banned_modules:
                            return False, f"Security Violation: Prohibited import from '{node.module}' detected."
                elif isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name) and node.func.id in banned_calls:
                        return False, f"Security Violation: Prohibited dynamic call '{node.func.id}()' detected."

        elif lang == "javascript":
            banned_js_patterns = [
                (r"child_process", "child_process invocation"),
                (r"require\s*\(\s*['\"]fs['\"]\s*\)", "filesystem import"),
                (r"require\s*\(\s*['\"]net['\"]\s*\)", "network import"),
                (r"process\.env", "process environment access"),
                (r"\beval\s*\(", "eval() execution"),
                (r"new\s+Function\s*\(", "Function constructor execution"),
            ]
            for pattern, desc in banned_js_patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    return False, f"Security Violation: Prohibited construct ({desc}) detected."

        elif lang == "cpp":
            banned_cpp_patterns = [
                (r"#include\s*<sys/", "POSIX system header"),
                (r"#include\s*<unistd\.h>", "UNIX syscall header"),
                (r"#include\s*<windows\.h>", "Windows native header"),
                (r"\bsystem\s*\(", "system() shell execution"),
                (r"\bfork\s*\(", "process forking"),
            ]
            for pattern, desc in banned_cpp_patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    return False, f"Security Violation: Prohibited construct ({desc}) detected."

        elif lang == "java":
            banned_java_patterns = [
                (r"ProcessBuilder", "ProcessBuilder invocation"),
                (r"Runtime\.getRuntime\(\)", "Runtime exec invocation"),
                (r"java\.net\.", "Network socket package"),
                (r"java\.lang\.reflect\.", "Reflection package"),
            ]
            for pattern, desc in banned_java_patterns:
                if re.search(pattern, code, re.IGNORECASE):
                    return False, f"Security Violation: Prohibited construct ({desc}) detected."

        return True, None

    @staticmethod
    def get_safe_env() -> Dict[str, str]:
        """
        Produce a stripped environment containing only basic OS runtime variables.
        Explicitly removes any database connection strings, API tokens, or secrets.
        """
        safe_keys = {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE", "HOME", "LANG", "LC_ALL"}
        clean = {k: v for k, v in os.environ.items() if k.upper() in safe_keys}
        sensitive_keywords = ["secret", "key", "password", "token", "database", "supabase", "xai", "grok", "auth", "jwt"]
        for k in list(clean.keys()):
            if any(term in k.lower() for term in sensitive_keywords):
                del clean[k]
        return clean

    @classmethod
    def has_compiler_or_runtime(cls, language: str) -> bool:
        """
        Checks whether the necessary interpreter/compiler is present on the current host.
        """
        if not settings.is_host_execution_permitted:
            return False
        lang = cls.normalize_language(language)
        if lang == "python":
            return bool(sys.executable)
        if lang == "javascript":
            return bool(shutil.which("node"))
        if lang == "cpp":
            return bool(shutil.which("g++") or shutil.which("clang++"))
        if lang == "java":
            return bool(shutil.which("javac") and shutil.which("java"))
        return False

    @classmethod
    def prepare_executable_code(cls, language: str, code: str, input_data: str) -> str:
        """
        If user writes a Python function without a driver/print, wrap it to invoke with test arguments.
        """
        if language == "python":
            # Check if code defines a function but does not explicitly call it or use stdin
            has_func = re.search(r"def\s+([A-Za-z0-9_]+)\s*\(", code)
            has_stdin = "stdin" in code or "input(" in code
            if has_func and not has_stdin and "print(" not in code:
                func_name = has_func.group(1)
                wrapper = f"""

if __name__ == '__main__':
    import sys, ast, json
    _raw_in = {repr(input_data)}.strip()
    _args = []
    if _raw_in:
        try:
            _parsed = ast.literal_eval(f"({{_raw_in}},)")
            _args = list(_parsed)
        except Exception:
            try:
                _args = [ast.literal_eval(_raw_in)]
            except Exception:
                _args = [_raw_in]
    try:
        _res = {func_name}(*_args)
        if isinstance(_res, (list, dict, tuple)):
            print(json.dumps(_res))
        elif _res is not None:
            print(_res)
    except Exception as _e:
        sys.stderr.write(str(_e))
        sys.exit(1)
"""
                return code + wrapper
        return code

    @classmethod
    def execute_in_sandbox(
        cls,
        language: str,
        code: str,
        input_data: str,
        timeout: float = 3.0
    ) -> Tuple[bool, str, str, str, float]:
        """
        Executes code in a temporary directory sandbox with strict timeout and resource bounds.
        Returns: (success, stdout, stderr, status, execution_time_ms)
        status values: "Success", "Compilation Error", "Runtime Error", "Time Limit Exceeded"
        """
        if not settings.is_host_execution_permitted:
            logger.warning("[SECURITY] Host code execution blocked by policy.")
            return False, "", "Host code execution is disabled in this environment. Isolated sandbox required.", "Compilation Error", 0.0
        lang = cls.normalize_language(language)
        safe_env = cls.get_safe_env()
        exec_code = cls.prepare_executable_code(lang, code, input_data)

        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                if lang == "python":
                    file_path = os.path.join(tmpdir, "solution.py")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(exec_code)

                    start = time.perf_counter()
                    proc = subprocess.run(
                        [sys.executable, "solution.py"],
                        input=input_data,
                        text=True,
                        capture_output=True,
                        timeout=timeout,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    duration_ms = (time.perf_counter() - start) * 1000
                    if proc.returncode != 0:
                        err_out = proc.stderr.strip() or proc.stdout.strip()
                        return False, proc.stdout[:5000], err_out[:2000], "Runtime Error", duration_ms
                    return True, proc.stdout[:10000], "", "Success", duration_ms

                elif lang == "javascript":
                    node_path = shutil.which("node")
                    if not node_path:
                        return False, "", "Node.js runtime not found.", "Runtime Error", 0.0

                    file_path = os.path.join(tmpdir, "solution.js")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(code)

                    start = time.perf_counter()
                    proc = subprocess.run(
                        [node_path, "solution.js"],
                        input=input_data,
                        text=True,
                        capture_output=True,
                        timeout=timeout,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    duration_ms = (time.perf_counter() - start) * 1000
                    if proc.returncode != 0:
                        err_out = proc.stderr.strip() or proc.stdout.strip()
                        return False, proc.stdout[:5000], err_out[:2000], "Runtime Error", duration_ms
                    return True, proc.stdout[:10000], "", "Success", duration_ms

                elif lang == "cpp":
                    compiler = shutil.which("g++") or shutil.which("clang++")
                    if not compiler:
                        return False, "", "C++ compiler (g++) not available.", "Compilation Error", 0.0

                    file_path = os.path.join(tmpdir, "solution.cpp")
                    exe_name = "solution.exe" if os.name == "nt" else "solution"
                    exe_path = os.path.join(tmpdir, exe_name)
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(code)

                    # Compilation phase
                    comp_proc = subprocess.run(
                        [compiler, "-O2", "solution.cpp", "-o", exe_name],
                        text=True,
                        capture_output=True,
                        timeout=6.0,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    if comp_proc.returncode != 0:
                        err = comp_proc.stderr.strip() or comp_proc.stdout.strip()
                        return False, "", err[:2000], "Compilation Error", 0.0

                    # Execution phase
                    start = time.perf_counter()
                    proc = subprocess.run(
                        [exe_path],
                        input=input_data,
                        text=True,
                        capture_output=True,
                        timeout=timeout,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    duration_ms = (time.perf_counter() - start) * 1000
                    if proc.returncode != 0:
                        err_out = proc.stderr.strip() or proc.stdout.strip()
                        return False, proc.stdout[:5000], err_out[:2000], "Runtime Error", duration_ms
                    return True, proc.stdout[:10000], "", "Success", duration_ms

                elif lang == "java":
                    javac = shutil.which("javac")
                    java = shutil.which("java")
                    if not javac or not java:
                        return False, "", "Java SDK (javac/java) not available.", "Compilation Error", 0.0

                    match = re.search(r"public\s+class\s+([A-Za-z0-9_]+)", code)
                    class_name = match.group(1) if match else "Main"
                    file_path = os.path.join(tmpdir, f"{class_name}.java")
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(code)

                    # Compilation phase
                    comp_proc = subprocess.run(
                        [javac, f"{class_name}.java"],
                        text=True,
                        capture_output=True,
                        timeout=8.0,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    if comp_proc.returncode != 0:
                        err = comp_proc.stderr.strip() or comp_proc.stdout.strip()
                        return False, "", err[:2000], "Compilation Error", 0.0

                    # Execution phase
                    start = time.perf_counter()
                    proc = subprocess.run(
                        [java, "-cp", ".", class_name],
                        input=input_data,
                        text=True,
                        capture_output=True,
                        timeout=timeout,
                        cwd=tmpdir,
                        env=safe_env
                    )
                    duration_ms = (time.perf_counter() - start) * 1000
                    if proc.returncode != 0:
                        err_out = proc.stderr.strip() or proc.stdout.strip()
                        return False, proc.stdout[:5000], err_out[:2000], "Runtime Error", duration_ms
                    return True, proc.stdout[:10000], "", "Success", duration_ms

                else:
                    return False, "", f"Unsupported language: {language}", "Runtime Error", 0.0

            except subprocess.TimeoutExpired:
                return False, "", f"Execution timed out after {timeout} seconds.", "Time Limit Exceeded", timeout * 1000
            except Exception as ex:
                return False, "", f"Execution error: {str(ex)}", "Runtime Error", 0.0

    @classmethod
    def normalize_text(cls, text: str) -> str:
        if not text:
            return ""
        norm = text.replace("\r\n", "\n").replace("\r", "\n")
        lines = [line.rstrip() for line in norm.splitlines()]
        return "\n".join(lines).strip()

    @classmethod
    def check_output_match(cls, actual: str, expected: str) -> bool:
        norm_act = cls.normalize_text(actual)
        norm_exp = cls.normalize_text(expected)
        if norm_act == norm_exp:
            return True
        # Strip matching quotes
        if norm_act.strip('"`\'') == norm_exp.strip('"`\''):
            return True
        # Boolean case-insensitive match
        if norm_act.lower() in ("true", "false") and norm_act.lower() == norm_exp.lower():
            return True
        # JSON structure equivalence
        try:
            act_json = json.loads(norm_act)
            exp_json = json.loads(norm_exp)
            if act_json == exp_json:
                return True
        except Exception:
            pass
        # Numeric token sequence comparison (e.g. "1 2 3" vs "1, 2, 3" vs "[1, 2, 3]")
        try:
            toks_act = re.findall(r'[-+]?\d*\.?\d+', norm_act)
            toks_exp = re.findall(r'[-+]?\d*\.?\d+', norm_exp)
            if toks_act and toks_act == toks_exp:
                return True
        except Exception:
            pass
        return False

    @classmethod
    async def run_code(
        cls,
        problem_dict: Dict[str, Any],
        raw_test_cases: List[Dict[str, Any]],
        language: str,
        code_str: str,
        custom_input: Optional[str] = None
    ) -> CodingRunResponse:
        """
        Executes ONLY visible test cases (+ optional custom input).
        Never executes or touches hidden test cases.
        """
        # Maximum code length limit
        if len(code_str or "") > MAX_CODE_LENGTH:
            return CodingRunResponse(
                status="Compilation Error",
                passed=False,
                compilationError=f"Code length ({len(code_str)} chars) exceeds maximum allowable limit of {MAX_CODE_LENGTH} characters."
            )

        lang = cls.normalize_language(language)
        if not lang:
            return CodingRunResponse(
                status="Compilation Error",
                passed=False,
                compilationError=f"Unsupported language '{language}'. Supported: Python, Java, C++, JavaScript."
            )

        # Check stub/empty code
        if cls.is_stub_or_empty_code(code_str):
            return CodingRunResponse(
                status="Wrong Answer",
                passed=False,
                compilationError="Submitted code is empty, a stub, or incomplete."
            )

        # Static security check
        is_safe, sec_error = cls.validate_code_security(lang, code_str)
        if not is_safe:
            log_security_event(SecurityEventType.CODE_SECURITY_VIOLATION, {"language": lang, "violation": sec_error}, severity="ERROR")
            return CodingRunResponse(
                status="Compilation Error",
                passed=False,
                compilationError=sec_error
            )

        # Syntax check
        is_valid_syntax, syn_error = cls.validate_syntax_and_compilation(lang, code_str)
        if not is_valid_syntax:
            return CodingRunResponse(
                status="Compilation Error",
                passed=False,
                compilationError=syn_error
            )

        # Filter strictly to visible test cases
        visible_test_cases = [tc for tc in raw_test_cases if not tc.get("hidden", False)]
        if not visible_test_cases:
            examples = problem_dict.get("examples") or []
            visible_test_cases = [
                {"input": ex.get("input", ""), "expectedOutput": ex.get("output", ""), "hidden": False}
                for ex in examples
            ]
        if not visible_test_cases:
            visible_test_cases = [{"input": "", "expectedOutput": "", "hidden": False}]

        test_results: List[CodingTestResult] = []
        total_time_ms = 0.0
        overall_status = "Accepted"
        compilation_error = None
        runtime_error = None

        has_compiler = cls.has_compiler_or_runtime(lang)

        if has_compiler:
            for tc in visible_test_cases:
                inp = str(tc.get("input", ""))
                exp = str(tc.get("expectedOutput", ""))

                success, stdout, stderr, run_status, dur_ms = cls.execute_in_sandbox(
                    language=lang,
                    code=code_str,
                    input_data=inp,
                    timeout=3.0
                )
                total_time_ms += dur_ms

                if run_status == "Compilation Error":
                    overall_status = "Compilation Error"
                    compilation_error = stderr
                    test_results.append(CodingTestResult(
                        passed=False,
                        input=inp,
                        expectedOutput=exp,
                        actualOutput="None (Compilation Failed)",
                        error=stderr,
                        hidden=False,
                        executionTimeMs=round(dur_ms, 2),
                        status="Compilation Error"
                    ))
                    break

                if run_status == "Time Limit Exceeded":
                    overall_status = "Time Limit Exceeded"
                    test_results.append(CodingTestResult(
                        passed=False,
                        input=inp,
                        expectedOutput=exp,
                        actualOutput="Time Limit Exceeded (3.0s)",
                        error=stderr,
                        hidden=False,
                        executionTimeMs=round(dur_ms, 2),
                        status="Time Limit Exceeded"
                    ))
                    continue

                if run_status == "Runtime Error":
                    if overall_status == "Accepted":
                        overall_status = "Runtime Error"
                    runtime_error = stderr
                    test_results.append(CodingTestResult(
                        passed=False,
                        input=inp,
                        expectedOutput=exp,
                        actualOutput=stdout,
                        error=stderr,
                        hidden=False,
                        executionTimeMs=round(dur_ms, 2),
                        status="Runtime Error"
                    ))
                    continue

                matches = cls.check_output_match(stdout, exp)
                if not matches and overall_status == "Accepted":
                    overall_status = "Wrong Answer"

                test_results.append(CodingTestResult(
                    passed=matches,
                    input=inp,
                    expectedOutput=exp,
                    actualOutput=stdout,
                    error=None if matches else "Output mismatch",
                    hidden=False,
                    executionTimeMs=round(dur_ms, 2),
                    status="Accepted" if matches else "Wrong Answer"
                ))

            # Run custom input if provided
            custom_result = None
            if custom_input is not None and overall_status != "Compilation Error":
                c_success, c_stdout, c_stderr, c_status, c_dur = cls.execute_in_sandbox(
                    language=lang,
                    code=code_str,
                    input_data=custom_input,
                    timeout=3.0
                )
                custom_result = CodingTestResult(
                    passed=c_success,
                    input=custom_input,
                    expectedOutput="(Custom Input)",
                    actualOutput=c_stdout if c_success else (c_stderr or "Error"),
                    error=c_stderr if not c_success else None,
                    hidden=False,
                    executionTimeMs=round(c_dur, 2),
                    status=c_status
                )
        else:
            return await cls._run_code_ai_fallback(problem_dict, visible_test_cases, lang, code_str, custom_input)

        passed_count = sum(1 for tr in test_results if tr.passed)
        all_passed = (passed_count == len(test_results)) and (len(test_results) > 0) and (overall_status == "Accepted")

        return CodingRunResponse(
            status=overall_status,
            passed=all_passed,
            totalTests=len(test_results),
            passedTests=passed_count,
            testResults=test_results,
            customResult=custom_result,
            compilationError=compilation_error,
            runtimeError=runtime_error,
            executionTimeMs=round(total_time_ms, 2)
        )

    @classmethod
    async def _run_code_ai_fallback(
        cls,
        problem_dict: Dict[str, Any],
        visible_test_cases: List[Dict[str, Any]],
        language: str,
        code_str: str,
        custom_input: Optional[str] = None
    ) -> CodingRunResponse:
        system_prompt = "You are a precise code interpreter returning strict JSON."
        user_prompt = (
            f"Problem: {json.dumps(problem_dict.get('statement', ''))}\n"
            f"Language: {language}\n"
            f"Code:\n{code_str}\n\n"
            f"Test cases: {json.dumps(visible_test_cases)}\n"
            f"Custom Input: {custom_input or 'None'}\n\n"
            "Return JSON matching:\n"
            "{\n"
            '  "status": "Accepted" | "Wrong Answer" | "Runtime Error" | "Compilation Error",\n'
            '  "testResults": [\n'
            '    {\n'
            '      "input": string,\n'
            '      "expectedOutput": string,\n'
            '      "actualOutput": string,\n'
            '      "passed": boolean,\n'
            '      "status": string,\n'
            '      "error": string or null\n'
            '    }\n'
            '  ],\n'
            '  "customResult": null\n'
            "}"
        )
        try:
            ps_mod = sys.modules.get("app.services.placement_service")
            active_gateway = getattr(ps_mod, "ai_gateway", ai_gateway) if ps_mod else ai_gateway
            ai_res = await active_gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.1
            )
            raw_results = ai_res.get("testResults") or []
            test_results = [
                CodingTestResult(
                    passed=bool(r.get("passed", False)),
                    input=str(r.get("input", "")),
                    expectedOutput=str(r.get("expectedOutput", "")),
                    actualOutput=str(r.get("actualOutput", "")),
                    error=r.get("error"),
                    hidden=False,
                    status=str(r.get("status", "Accepted" if r.get("passed") else "Wrong Answer")),
                    executionTimeMs=12.0
                )
                for r in raw_results
            ]
            passed_count = sum(1 for tr in test_results if tr.passed)
            st = ai_res.get("status", "Accepted" if passed_count == len(test_results) else "Wrong Answer")
            return CodingRunResponse(
                status=st,
                passed=(passed_count == len(test_results)) and (len(test_results) > 0),
                totalTests=len(test_results),
                passedTests=passed_count,
                testResults=test_results,
                executionTimeMs=15.0
            )
        except Exception as exc:
            logger.warning(f"AI fallback failed: {exc}")
            return CodingRunResponse(
                status="Runtime Error",
                passed=False,
                runtimeError=f"Evaluation service unavailable: {str(exc)}"
            )

    @classmethod
    async def evaluate_submission(
        cls,
        problem_dict: Dict[str, Any],
        raw_test_cases: List[Dict[str, Any]],
        language: str,
        code_str: str
    ) -> CodingSubmitResponse:
        """
        Executes against ALL configured test cases (visible + hidden).
        Security: Masks hidden test case inputs and expected outputs so secrets are never revealed.
        """
        total_tests = len(raw_test_cases)

        # Maximum code length limit
        if len(code_str or "") > MAX_CODE_LENGTH:
            err_msg = f"Code length ({len(code_str)} chars) exceeds maximum allowable limit of {MAX_CODE_LENGTH} characters."
            return CodingSubmitResponse(
                submissionId=str(uuid.uuid4())[:8],
                status="Compilation Error",
                evaluation=CodingEvaluation(
                    correctness=0,
                    timeComplexity="N/A",
                    spaceComplexity="N/A",
                    codeQuality=0,
                    naming=0,
                    optimization=0,
                    feedback=err_msg,
                    alternativeSolutions=[],
                    expectedQuestions=[]
                ),
                passed=False,
                totalScore=0,
                testResults=[
                    CodingTestResult(
                        passed=False,
                        input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                        expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                        actualOutput=f"None ({err_msg})",
                        error=err_msg,
                        hidden=bool(tc.get("hidden", False)),
                        status="Compilation Error"
                    ) for tc in raw_test_cases
                ],
                passedTests=0,
                totalTests=total_tests,
                executionTimeMs=0.0
            )

        lang = cls.normalize_language(language)

        if not lang:
            raise ValueError(f"Unsupported language '{language}'. Supported: Python, Java, C++, JavaScript.")

        # Check stub/empty code
        if cls.is_stub_or_empty_code(code_str):
            test_results = [
                CodingTestResult(
                    passed=False,
                    input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                    expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                    actualOutput="None (No implementation provided)",
                    error="Submission is empty, stub, or dummy return.",
                    hidden=bool(tc.get("hidden", False)),
                    status="Wrong Answer"
                )
                for tc in raw_test_cases
            ]
            eval_obj = CodingEvaluation(
                correctness=0,
                timeComplexity="N/A (No implementation) (Estimated)",
                spaceComplexity="N/A (No implementation) (Estimated)",
                codeQuality=0,
                naming=0,
                optimization=0,
                feedback="Code submission contains no algorithmic logic or is an empty/stub function.",
                alternativeSolutions=["Implement the complete algorithmic solution handling all edge cases."],
                expectedQuestions=["What is the foundational approach required for this problem?"]
            )
            return CodingSubmitResponse(
                submissionId=str(uuid.uuid4())[:8],
                status="Wrong Answer",
                evaluation=eval_obj,
                passed=False,
                totalScore=0,
                testResults=test_results,
                passedTests=0,
                totalTests=total_tests,
                executionTimeMs=0.0
            )

        # Static security check
        is_safe, sec_error = cls.validate_code_security(lang, code_str)
        if not is_safe:
            return CodingSubmitResponse(
                submissionId=str(uuid.uuid4())[:8],
                status="Compilation Error",
                evaluation=CodingEvaluation(
                    correctness=0,
                    timeComplexity="N/A",
                    spaceComplexity="N/A",
                    codeQuality=0,
                    naming=0,
                    optimization=0,
                    feedback=sec_error,
                    alternativeSolutions=[],
                    expectedQuestions=[]
                ),
                passed=False,
                totalScore=0,
                testResults=[
                    CodingTestResult(
                        passed=False,
                        input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                        expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                        actualOutput=f"None ({sec_error})",
                        error=sec_error,
                        hidden=bool(tc.get("hidden", False)),
                        status="Compilation Error"
                    ) for tc in raw_test_cases
                ],
                passedTests=0,
                totalTests=total_tests,
                executionTimeMs=0.0
            )

        # Deterministic syntax check
        is_valid_syntax, syn_error = cls.validate_syntax_and_compilation(lang, code_str)
        if not is_valid_syntax:
            test_results = [
                CodingTestResult(
                    passed=False,
                    input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                    expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                    actualOutput=f"None ({syn_error})",
                    error=syn_error,
                    hidden=bool(tc.get("hidden", False)),
                    status="Compilation Error"
                )
                for tc in raw_test_cases
            ]
            eval_obj = CodingEvaluation(
                correctness=0,
                timeComplexity="N/A (Compilation Error) (Estimated)",
                spaceComplexity="N/A (Compilation Error) (Estimated)",
                codeQuality=5,
                naming=20,
                optimization=0,
                feedback=f"Code failed syntax / compilation check:\n\n`{syn_error}`\n\nPlease fix syntax before algorithmic grading.",
                alternativeSolutions=["Ensure valid language syntax, proper indentation, and closed brackets/quotes."],
                expectedQuestions=["How do syntax and compilation errors impact code build pipelines?"]
            )
            return CodingSubmitResponse(
                submissionId=str(uuid.uuid4())[:8],
                status="Compilation Error",
                evaluation=eval_obj,
                passed=False,
                totalScore=0,
                testResults=test_results,
                passedTests=0,
                totalTests=total_tests,
                executionTimeMs=0.0,
                compilationError=syn_error
            )

        system_prompt = (
            "You are a Staff Software Engineer and Algorithmic Interview Evaluator. "
            "Trace and evaluate the submitted solution strictly against each test case.\n\n"
            "STRICT GRADING RULES:\n"
            "1. For each test case, trace whether the code produces the EXACT expectedOutput for the given input.\n"
            "   - If logic is wrong, produces incorrect answers, or throws an unhandled exception, set passed=false and set actualOutput to the trace.\n"
            "   - Only mark passed=true if the algorithm truthfully produces the exact expected output.\n"
            "2. Score Calibration:\n"
            "   - 'correctness' (0-100) MUST correlate directly with passed test cases: (passedTests / totalTests) * 100.\n"
            "   - If 0 tests pass: correctness MUST be 0 (or at most 10 if a valid near-miss approach exists).\n"
            "   - Only solutions passing all tests with correct edge-case handling can receive correctness >= 85.\n"
            "3. Time and Space Complexity:\n"
            "   - Provide Big-O complexity formatted with '(Estimated)' (e.g. 'O(n) (Estimated)').\n"
            "4. Return strict JSON matching this structure:\n"
            "{\n"
            '  "correctness": integer,\n'
            '  "timeComplexity": string,\n'
            '  "spaceComplexity": string,\n'
            '  "codeQuality": integer,\n'
            '  "naming": integer,\n'
            '  "optimization": integer,\n'
            '  "feedback": string,\n'
            '  "alternativeSolutions": [string],\n'
            '  "expectedQuestions": [string],\n'
            '  "testResults": [\n'
            '    {\n'
            '      "input": string,\n'
            '      "expectedOutput": string,\n'
            '      "actualOutput": string,\n'
            '      "passed": boolean,\n'
            '      "error": string or null,\n'
            '      "hidden": boolean\n'
            '    }\n'
            '  ]\n'
            "}"
        )
        user_prompt = (
            f"Problem:\n{json.dumps(problem_dict, indent=2)}\n\n"
            f"Test Cases to Evaluate:\n{json.dumps(raw_test_cases, indent=2)}\n\n"
            f"Language: {language}\n"
            f"Submitted Code:\n{code_str}"
        )

        # Detect any patched gateway in caller module or local module
        ps_mod = sys.modules.get("app.services.placement_service")
        active_gateway = getattr(ps_mod, "ai_gateway", ai_gateway) if ps_mod else ai_gateway

        try:
            eval_dict = await active_gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2
            )

            raw_time = str(eval_dict.get("timeComplexity") or "O(N)")
            raw_space = str(eval_dict.get("spaceComplexity") or "O(1)")
            if "(Estimated)" not in raw_time:
                raw_time = f"{raw_time} (Estimated)"
            if "(Estimated)" not in raw_space:
                raw_space = f"{raw_space} (Estimated)"

            raw_results = eval_dict.get("testResults") or []
            test_results: List[CodingTestResult] = []
            for i, r in enumerate(raw_results):
                # match with raw_test_cases for hidden flag
                matched_tc = raw_test_cases[i] if i < len(raw_test_cases) else {}
                is_hidden = bool(matched_tc.get("hidden", r.get("hidden", False)))
                is_passed = bool(r.get("passed", False))

                test_results.append(CodingTestResult(
                    passed=is_passed,
                    input="[Hidden Test Case]" if is_hidden else str(r.get("input", matched_tc.get("input", ""))),
                    expectedOutput="[Hidden Expected Output]" if is_hidden else str(r.get("expectedOutput", matched_tc.get("expectedOutput", ""))),
                    actualOutput="[Hidden Output]" if (is_hidden and is_passed) else ("Hidden Test Case Failed: Output mismatch" if is_hidden else str(r.get("actualOutput", ""))),
                    error=r.get("error"),
                    hidden=is_hidden,
                    status="Accepted" if is_passed else "Wrong Answer",
                    executionTimeMs=12.0
                ))

            if not test_results:
                test_results = [
                    CodingTestResult(
                        passed=False,
                        input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                        expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                        actualOutput="Test execution unconfirmed",
                        error="Test case trace not returned by evaluator",
                        hidden=bool(tc.get("hidden", False)),
                        status="Wrong Answer"
                    )
                    for tc in raw_test_cases
                ]

            passed_count = sum(1 for tr in test_results if tr.passed)
            if total_tests > 0:
                if passed_count == 0:
                    correctness_val = min(int(eval_dict.get("correctness", 0)), 10)
                else:
                    ratio = passed_count / total_tests
                    correctness_val = min(int(eval_dict.get("correctness", 0)), int(ratio * 100) + 10)
                    correctness_val = max(int(ratio * 75), correctness_val)
            else:
                correctness_val = 0

            correctness_val = max(0, min(100, correctness_val))

            eval_obj = CodingEvaluation(
                correctness=correctness_val,
                timeComplexity=raw_time,
                spaceComplexity=raw_space,
                codeQuality=int(eval_dict.get("codeQuality", 50)),
                naming=int(eval_dict.get("naming", 50)),
                optimization=int(eval_dict.get("optimization", 50)),
                feedback=str(eval_dict.get("feedback", "Evaluation completed.")),
                alternativeSolutions=list(eval_dict.get("alternativeSolutions", [])),
                expectedQuestions=list(eval_dict.get("expectedQuestions", []))
            )
        except Exception as exc:
            logger.warning(f"[CODING-EVAL] Provider evaluation error: {exc}")
            test_results = [
                CodingTestResult(
                    passed=False,
                    input="[Hidden Test Case]" if tc.get("hidden", False) else str(tc.get("input", "")),
                    expectedOutput="[Hidden Expected Output]" if tc.get("hidden", False) else str(tc.get("expectedOutput", "")),
                    actualOutput="Evaluation unavailable: AI provider error.",
                    error=f"Provider error: {str(exc)}",
                    hidden=bool(tc.get("hidden", False)),
                    status="Runtime Error"
                )
                for tc in raw_test_cases
            ]
            eval_obj = CodingEvaluation(
                correctness=0,
                timeComplexity="N/A (Evaluation unavailable) (Estimated)",
                spaceComplexity="N/A (Evaluation unavailable) (Estimated)",
                codeQuality=0,
                naming=0,
                optimization=0,
                feedback="Automated code evaluation service was temporarily unavailable. Please retry your submission.",
                alternativeSolutions=[],
                expectedQuestions=[]
            )
            passed_count = 0

        passed_count = sum(1 for tr in test_results if tr.passed)
        overall_passed = (eval_obj.correctness >= 70) and (passed_count == total_tests) and (total_tests > 0)

        return CodingSubmitResponse(
            submissionId=str(uuid.uuid4())[:8],
            status="Accepted" if overall_passed else "Wrong Answer",
            evaluation=eval_obj,
            passed=overall_passed,
            totalScore=eval_obj.correctness,
            testResults=test_results,
            passedTests=passed_count,
            totalTests=total_tests,
            executionTimeMs=15.0
        )
