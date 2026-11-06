"""
Production-Wide Regression & Quality Assurance Test Suite for Nexora.
Validates:
- Phase 1: PDF Assistant & Background Enrichment
- Phase 2: Multi-Dimensional Career Readiness & 2026 Engineering Benchmark
- Phase 3: Analytics & Resume Grounded Consistency (6 Prompt Test Cases)
- Phase 4: Standardized AI Response Contract
- Phase 5: Error Masking & Request Correlation ID Sanitization
"""

import os
import json
import pytest
from datetime import datetime
from starlette.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.base import User, Workspace, PdfDocument, PlacementResume, PlacementSession
from app.services.pdf_assistant_service import PdfAssistantService, _build_fallback_structured_summary
from app.services.career_evaluation_engine import (
    CareerEvaluationEngine,
    evaluate_skill_evidence,
    get_skill_benchmark
)
from app.schemas.ai_response import create_standard_response, StandardAiResponse
from app.core.error_handler import sanitize_error_detail, is_sensitive_or_internal


# ============================================================================
# PHASE 1 TESTS: PDF Processing & Background Task Robustness
# ============================================================================

def test_pdf_assistant_has_enrich_method():
    """Verify PdfAssistantService object has attribute _enrich_document_summary_background."""
    assert hasattr(PdfAssistantService, "_enrich_document_summary_background")
    assert callable(getattr(PdfAssistantService, "_enrich_document_summary_background"))


def test_pdf_fallback_structured_summary_9_sections():
    """Verify fallback summary generates all 9 structured sections."""
    text = (
        "Operating Systems: Design and Implementation.\n"
        "Concurrency, virtual memory, paging, process synchronization, deadlocks, and disk scheduling.\n"
        "Semaphores and mutex locks are used to avoid race conditions in multi-threaded programs.\n"
        "Paging divides logical memory into blocks called pages, and physical memory into frames.\n"
        "Virtual memory allows execution of processes that may not be completely in memory.\n"
    )
    summary = _build_fallback_structured_summary(text, "os_lecture.txt")
    assert "### 1. Document Overview & Scope" in summary
    assert "### 2. Purpose & Objectives" in summary
    assert "### 3. Core Concepts & Definitions" in summary
    assert "### 4. Detailed Explanations & Key Themes" in summary
    assert "### 5. Methodologies, Processes & Step-by-Step Workflows" in summary
    assert "### 6. Practical Applications & Real-World Examples" in summary
    assert "### 7. Formulas, Algorithms & Technical Code" in summary
    assert "### 8. Concept Relationships & System Architecture" in summary
    assert "### 9. Key Takeaways & Actionable Insights" in summary


def test_enrich_document_summary_background_safe_on_missing_doc():
    """Verify background enrichment does not raise or crash if doc is missing."""
    # Should safely return without exception
    PdfAssistantService._enrich_document_summary_background(
        doc_id="non-existent-doc-id",
        text="Sample text",
        filename="test.pdf"
    )


# ============================================================================
# PHASE 2 & 3 TESTS: Multi-Dimensional Grounded Evaluation (6 Test Cases)
# ============================================================================

def test_case_1_frontend_only_no_backend_evidence():
    """Case 1: Resume has strong frontend skills but no backend evidence."""
    skills = ["React", "TypeScript", "Tailwind CSS", "Redux", "Django"]
    projects = [
        {
            "title": "Interactive E-Commerce UI",
            "description": "Built reactive storefront in React, TypeScript and Tailwind CSS with complex cart state.",
            "technologies": ["React", "TypeScript", "Tailwind CSS", "Redux"],
            "highlights": ["Zero-layout shift component library", "Lighthouse 98 performance"]
        }
    ]
    experience = []
    resume_text = "Frontend Developer specializing in React, TypeScript and UI components. Skills: React, TypeScript, Tailwind CSS, Django."

    evals = CareerEvaluationEngine.extract_skill_evaluations(skills, resume_text, projects, experience)
    eval_map = {e.skill: e for e in evals}

    assert eval_map["React"].evidenceLevel == "Demonstrated"
    assert eval_map["TypeScript"].evidenceLevel == "Demonstrated"
    assert eval_map["Django"].evidenceLevel == "Insufficient info"  # Mentioned in text only, not in project

    # Check grounded readiness recommendations
    readiness = CareerEvaluationEngine.compute_grounded_readiness(
        user=None,
        sessions=[],
        latest_resume=None,
        resume_analysis={"skills": skills, "projects": projects, "experience": experience, "atsScore": 75}
    )
    # Recommended roles should reflect frontend specialization
    assert any("Frontend" in r for r in readiness.recommendedRoles)


def test_case_2_java_spring_no_system_design():
    """Case 2: Resume has Java and Spring Boot but no System Design evidence."""
    skills = ["Java", "Spring Boot", "MySQL", "System Design"]
    projects = [
        {
            "title": "Campus Management API",
            "description": "Developed REST microservices using Java and Spring Boot with MySQL database integration.",
            "technologies": ["Java", "Spring Boot", "MySQL"],
            "highlights": ["Implemented JWT authentication", "Hibernate ORM persistence"]
        }
    ]
    resume_text = "Java developer with Spring Boot projects. Skills: Java, Spring Boot, MySQL, System Design."

    evals = CareerEvaluationEngine.extract_skill_evaluations(skills, resume_text, projects, [])
    eval_map = {e.skill: e for e in evals}

    assert eval_map["Java"].evidenceLevel == "Demonstrated"
    assert eval_map["Java"].benchmark in ("Essential", "Expected")
    assert eval_map["Spring Boot"].evidenceLevel == "Demonstrated"
    assert eval_map["System Design"].evidenceLevel == "Insufficient info"
    assert eval_map["System Design"].benchmark == "Role-dependent"


def test_case_3_ai_tools_mentioned_without_project():
    """Case 3: Resume mentions AI tools but has no practical AI project."""
    skills = ["Python", "Git", "PyTorch", "LangChain"]
    projects = [
        {
            "title": "CLI File Sorter",
            "description": "Script in Python and Git to organize local downloads.",
            "technologies": ["Python", "Git"],
            "highlights": ["Automated directory sorting"]
        }
    ]
    resume_text = "Software student. Skills: Python, Git, PyTorch, LangChain, LLM agents."

    evals = CareerEvaluationEngine.extract_skill_evaluations(skills, resume_text, projects, [])
    eval_map = {e.skill: e for e in evals}

    assert eval_map["PyTorch"].evidenceLevel == "Insufficient info"
    assert eval_map["LangChain"].evidenceLevel == "Insufficient info"
    assert eval_map["Python"].evidenceLevel == "Demonstrated"


def test_case_4_technologies_claimed_but_weak_coding_assessment():
    """Case 4: Resume claims technologies but coding assessment results are weak (35%)."""
    class MockSession:
        def __init__(self, s_type, score, status="COMPLETED"):
            self.type = s_type
            self.score = score
            self.status = status
            self.topic = "DSA"
            self.started_at = datetime(2026, 11, 1, 10, 0)
            self.ended_at = datetime(2026, 11, 1, 10, 45)
            self.created_at = datetime(2026, 11, 1, 10, 0)
            self.message_count = 5
            self.summary = "Failed 3 of 4 hidden test cases due to O(n^2) timeout."

    sessions = [MockSession("CODING", score=35)]
    resume_analysis = {
        "atsScore": 85,
        "skills": ["Python", "Algorithms", "Dynamic Programming"],
        "projects": [{"title": "P1", "description": "Desc", "technologies": ["Python"]}]
    }

    analytics = CareerEvaluationEngine.compute_grounded_analytics(sessions, None, resume_analysis)
    assert analytics.coding == 35
    assert analytics.dsa == 35
    assert "Score: 35%" in analytics.scoreBreakdown["Coding"]
    # Coding weakness is transparently reflected despite ATS 85
    assert analytics.overallReadiness < 65


def test_case_5_no_assessment_history_bounded_readiness():
    """Case 5: Candidate uploaded resume but has NO assessment history."""
    resume_analysis = {
        "atsScore": 90,
        "skills": ["Java", "Docker", "REST APIs"],
        "projects": [{"title": "Web App", "description": "Web app in Java", "technologies": ["Java"]}]
    }
    # User has zero completed sessions
    readiness = CareerEvaluationEngine.compute_grounded_readiness(
        user=None,
        sessions=[],
        latest_resume=None,
        resume_analysis=resume_analysis
    )
    # Unassessed candidate cannot be scored high / "Interview Ready"
    assert readiness.score <= 45
    assert readiness.label in ("Foundational / Unverified", "Intermediate", "Beginner")
    assert len(readiness.missingAssessments) >= 2
    assert any("Coding Assessment" in ma for ma in readiness.missingAssessments)


def test_case_6_strong_projects_limited_work_experience():
    """Case 6: Candidate has strong practical projects but zero corporate work experience."""
    skills = ["FastAPI", "React", "PostgreSQL", "Docker"]
    projects = [
        {
            "title": "Scalable Real-Time Collaborative Workspace",
            "description": "Architected FastAPI WebSocket backend with PostgreSQL replication and Docker containerization.",
            "technologies": ["FastAPI", "React", "PostgreSQL", "Docker"],
            "highlights": ["Sub-50ms message latency", "Automated GitHub Actions CI"]
        }
    ]
    experience = []  # No work experience
    resume_text = "Self-taught builder. Projects: Scalable Real-Time Collaborative Workspace in FastAPI and React."

    evals = CareerEvaluationEngine.extract_skill_evaluations(skills, resume_text, projects, experience)
    for e in evals:
        # All project technologies are confirmed Demonstrated
        assert e.evidenceLevel == "Demonstrated"
        assert "Scalable Real-Time Collaborative Workspace" in e.evidenceDetail


# ============================================================================
# PHASE 4 TESTS: Standardized Versioned AI Response Contract
# ============================================================================

def test_standard_ai_response_contract_normalization():
    """Verify StandardAiResponse schema normalizes nulls, collections, and score."""
    resp = create_standard_response(
        module="interview_evaluation",
        summary="Candidate gave clear explanation of ACID properties.",
        score=88.5,
        strengths=["Database consistency", "Isolation levels"],
        weaknesses=[],
        evidence=["Mentioned WAL logging in PostgreSQL"],
        recommendations=["Review Two-Phase Commit protocol"],
        missing_information=[]
    )
    assert resp.success is True
    assert resp.version == "2026.1"
    assert resp.module == "interview_evaluation"
    assert resp.score == 88.5
    assert resp.status == "COMPLETED"
    assert len(resp.strengths) == 2
    assert isinstance(resp.evidence, list)
    assert resp.evidence[0]["claim"] == "Mentioned WAL logging in PostgreSQL"

    # Verify serialization and JSON compliance
    dump = resp.model_dump()
    assert dump["score"] == 88.5
    assert isinstance(dump["metadata"], dict)


def test_standard_ai_response_null_score_when_not_applicable():
    """Verify score can be null when not applicable (e.g. general chat or roadmap)."""
    resp = create_standard_response(
        module="ai_chat",
        summary="Scheduled task 'Prepare Mock Interview' for tomorrow 5 PM.",
        score=None,
        status="COMPLETED"
    )
    assert resp.score is None
    assert resp.status == "COMPLETED"
    assert resp.strengths == []
    assert resp.weaknesses == []


# ============================================================================
# PHASE 5 TESTS: Client Error Masking & Sanitization
# ============================================================================

def test_sanitize_error_detail_masks_attribute_error():
    """Verify raw python class attribute errors are never returned to client."""
    raw = "'PdfAssistantService' object has no attribute '_enrich_document_summary_background'"
    sanitized = sanitize_error_detail(raw, request_id="req_test123", status_code=400, path="/api/v1/pdf-assistant/workspaces/1/documents")
    assert "PdfAssistantService" not in sanitized
    assert "object has no attribute" not in sanitized
    assert "Your document could not be processed" in sanitized
    assert "Reference ID: req_test123" in sanitized


def test_sanitize_error_detail_masks_database_exception():
    """Verify SQL syntax, hostnames, and database driver exceptions are masked."""
    raw = "sqlalchemy.exc.OperationalError: could not connect to server 1908@@aws-0-ap-northeast-1.pooler.supabase.com"
    sanitized = sanitize_error_detail(raw, request_id="req_db456", status_code=500, path="/api/v1/unknown")
    assert "supabase.com" not in sanitized
    assert "OperationalError" not in sanitized
    assert "An unexpected server error occurred" in sanitized
    assert "Reference ID: req_db456" in sanitized

    # Contextual placement masking
    contextual = sanitize_error_detail(raw, request_id="req_db456", status_code=500, path="/api/v1/placement/readiness")
    assert "supabase.com" not in contextual
    assert "The interview session encountered an issue" in contextual


def test_sanitize_error_detail_preserves_safe_client_validation():
    """Verify valid user-facing 400 messages (e.g. invalid file format) are preserved."""
    safe_msg = "Only PDF and TXT files are supported"
    sanitized = sanitize_error_detail(safe_msg, request_id="req_clean789", status_code=400, path="/api/v1/pdf-assistant/documents")
    assert sanitized == safe_msg
