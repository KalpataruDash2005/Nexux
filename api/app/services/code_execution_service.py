import ast
import json
import re
from typing import List, Dict, Any, Optional, Tuple
from app.schemas.placement import CodingTestResult, CodingEvaluation, CodingSubmitResponse
from app.ai import ai_gateway, AIWorkload
from app.core.config import settings
from app.core.logging import logger

ALLOWED_LANGUAGES = {"python", "javascript", "java", "cpp", "c++"}

class CodeExecutionService:
    @staticmethod
    def normalize_language(lang: str) -> str:
        cleaned = (lang or "").strip().lower()
        if cleaned == "c++":
            return "cpp"
        if cleaned in ALLOWED_LANGUAGES:
            return cleaned
        return ""

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
    def is_stub_or_empty_code(code: str) -> bool:
        cleaned = (code or "").strip()
        if len(cleaned) < 4:
            return True
        # Check trivial returns or pass statements
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

    @classmethod
    async def evaluate_submission(
        cls,
        problem_dict: Dict[str, Any],
        raw_test_cases: List[Dict[str, Any]],
        language: str,
        code_str: str
    ) -> CodingSubmitResponse:
        total_tests = len(raw_test_cases)
        lang = cls.normalize_language(language)

        if not lang:
            raise ValueError(f"Unsupported language '{language}'. Supported: Python, Java, C++, JavaScript.")

        # Check 1: Empty or stub code
        if cls.is_stub_or_empty_code(code_str):
            test_results = [
                CodingTestResult(
                    passed=False,
                    input=str(tc.get("input", "")),
                    expectedOutput=str(tc.get("expectedOutput", "")),
                    actualOutput="None (No implementation provided)",
                    error="Submission is empty, stub, or dummy return.",
                    hidden=bool(tc.get("hidden", False))
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
                evaluation=eval_obj,
                passed=False,
                totalScore=0,
                testResults=test_results,
                passedTests=0,
                totalTests=total_tests
            )

        # Check 2: Deterministic syntax & compilation validation
        is_valid_syntax, syn_error = cls.validate_syntax_and_compilation(lang, code_str)
        if not is_valid_syntax:
            test_results = [
                CodingTestResult(
                    passed=False,
                    input=str(tc.get("input", "")),
                    expectedOutput=str(tc.get("expectedOutput", "")),
                    actualOutput=f"None ({syn_error})",
                    error=syn_error,
                    hidden=bool(tc.get("hidden", False))
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
                evaluation=eval_obj,
                passed=False,
                totalScore=0,
                testResults=test_results,
                passedTests=0,
                totalTests=total_tests
            )

        # Static Code Evaluation & Test Trace
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

        try:
            eval_dict = await ai_gateway.generate_json(
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
            for r in raw_results:
                test_results.append(CodingTestResult(
                    passed=bool(r.get("passed", False)),
                    input=str(r.get("input", "")),
                    expectedOutput=str(r.get("expectedOutput", "")),
                    actualOutput=str(r.get("actualOutput", "")),
                    error=r.get("error"),
                    hidden=bool(r.get("hidden", False))
                ))

            if not test_results:
                test_results = [
                    CodingTestResult(
                        passed=False,
                        input=str(tc.get("input", "")),
                        expectedOutput=str(tc.get("expectedOutput", "")),
                        actualOutput="Test execution unconfirmed",
                        error="Test case trace not returned by evaluator",
                        hidden=bool(tc.get("hidden", False))
                    )
                    for tc in raw_test_cases
                ]

            passed_count = sum(1 for tr in test_results if tr.passed)
            # Deterministic calculation: correctness is bound directly to pass ratio
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
                    input=str(tc.get("input", "")),
                    expectedOutput=str(tc.get("expectedOutput", "")),
                    actualOutput="Evaluation unavailable: AI provider error.",
                    error=f"Provider error: {str(exc)}",
                    hidden=bool(tc.get("hidden", False))
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
            evaluation=eval_obj,
            passed=overall_passed,
            totalScore=eval_obj.correctness,
            testResults=test_results,
            passedTests=passed_count,
            totalTests=total_tests
        )
