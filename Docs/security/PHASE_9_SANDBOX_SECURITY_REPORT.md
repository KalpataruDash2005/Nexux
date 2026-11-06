# Phase 9: Coding Evaluation Sandbox Security — Verification Report

## 1. Phase Objective & Overview
Phase 9 eliminates remote code execution (RCE) vectors and resource exhaustion risks within Nexora's coding evaluation system, formalizes a two-tier sandboxing architecture, enforces static AST/heuristic code analyzers, caps code lengths, and secures hidden evaluation test cases against cheating and data exfiltration.

---

## 2. Implemented Security Controls

### 2.1 Serverless Policy Enforcement & Subprocess Blocking
- **Host Execution Restriction:** Enforced `ENABLE_HOST_CODE_EXECUTION: bool = False` as default across all production and serverless environments (`api/app/core/config.py`).
- **Fail-Safe Property:** `is_host_execution_permitted` returns `False` under serverless (`VERCEL="1"`) or `ENVIRONMENT="production"`.
- **Hermetic AI Fallback:** All evaluations on serverless dynamically route through `_run_code_ai_fallback()`, guaranteeing that zero untrusted code runs on host serverless workers.

### 2.2 Static AST & Heuristic Code Security Analyzer
- **`validate_code_security(language, code)`:** Implemented static pre-execution analysis in `api/app/services/code_execution_service.py`:
  - **Python (AST-based):** Prohibits dangerous imports (`os`, `subprocess`, `socket`, `shutil`, `urllib`, `requests`, `http`, `pty`, `posix`, `ctypes`, `winreg`, `pickle`, `shelve`, `multiprocessing`, `threading`) and dangerous dynamic invocation (`eval`, `exec`, `__import__`).
  - **JavaScript:** Regex heuristics ban `child_process`, `fs`, `net`, `process.env`, `eval()`, and `new Function()`.
  - **C++:** Rejects `#include <unistd.h>`, `#include <sys/...>`, `#include <windows.h>`, `system()`, and `fork()`.
  - **Java:** Blocks `ProcessBuilder`, `Runtime.getRuntime()`, `java.net.*`, and `java.lang.reflect.*`.

### 2.3 Payload Bound & Resource Exhaustion Defense
- **Max Code Length Guard:** Hard-capped at `MAX_CODE_LENGTH = 50,000` characters across both `run_code` and `evaluate_submission`.
- **Compilation Check Pre-Validation:** Syntax and bracket balancing are verified before allocating compute or AI resources.

### 2.4 Confidentiality of Hidden Test Cases
- **Masking:** Hidden test cases in `evaluate_submission` are strictly masked (`[Hidden Test Case]`, `[Hidden Expected Output]`), ensuring proprietary benchmarks are never disclosed in client HTTP responses.

### 2.5 Architecture Specification
- Created `docs/security/CODING_SANDBOX_ARCHITECTURE.md` specifying:
  - **Tier 1 (MicroVM Sandbox):** `--net=none`, read-only rootfs, 256MB RAM, 0.5 CPU, 64 PIDs limit, 3s timeout, nobody user.
  - **Tier 2 (Hermetic AI Gateway):** Zero host execution, structured JSON evaluation.

---

## 3. Automated Test Verification Results

All tests executed via `pytest api/tests/test_security_phase9.py` on Python 3.12:

| Test Name | Target Invariant | Result |
| :--- | :--- | :--- |
| `test_host_execution_disabled_by_default` | Host execution blocked; returns Compilation Error with policy warning | **PASSED** |
| `test_static_analyzer_python_prohibited_imports` | Python AST blocks `os`, `subprocess`, `socket`, and `eval` | **PASSED** |
| `test_static_analyzer_multilingual` | JS (`child_process`), C++ (`unistd.h`), Java (`ProcessBuilder`) blocked | **PASSED** |
| `test_benign_algorithmic_code_passes` | Legitimate algorithms (Two-Sum) pass static checks without false positives | **PASSED** |
| `test_oversized_code_rejected` | Code > 50,000 chars rejected in `run_code` and `evaluate_submission` | **PASSED** |
| `test_malicious_code_blocked_in_run_and_evaluate` | Malicious payload rejected; hidden test case fields strictly masked | **PASSED** |

**Summary: 6/6 tests passed (100% success rate).**
