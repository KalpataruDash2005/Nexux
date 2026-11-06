"""
Standardized AI Response Contract for Nexora Career & Academic Platform.
Unified, versioned schema across all AI-driven modules:
- Resume analysis
- Career readiness
- Analytics
- PDF summaries & QA
- AI Chat
- Interview evaluation
- Coding evaluation
- Learning recommendations
"""

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, model_validator


class EvidenceItem(BaseModel):
    claim: str
    source: str = "general"  # "resume", "coding_session", "interview_session", "document", "assessment"
    quote_or_detail: str = ""
    status: str = "Demonstrated"  # "Demonstrated", "Partially demonstrated", "Not demonstrated", "Insufficient info"
    confidence: float = 1.0


class StandardAiResponse(BaseModel):
    """
    Unified AI Response Schema matching Production Specification.
    Guarantees consistent JSON structure for both Backend and Frontend.
    """
    success: bool = True
    module: str  # e.g., "resume_analysis", "career_readiness", "analytics", "pdf_summary", "pdf_qa", "interview_evaluation", "coding_evaluation", "ai_chat", "learning_recommendation"
    version: str = "2026.1"
    summary: str = ""
    score: Optional[float] = None
    status: str = "COMPLETED"  # "COMPLETED", "IN_PROGRESS", "NEEDS_INFO", "FAILED"
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def sanitize_collections_and_score(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        d = dict(data)

        # Normalize score (float or None)
        raw_score = d.get("score")
        if raw_score is not None:
            try:
                d["score"] = float(raw_score)
            except (ValueError, TypeError):
                d["score"] = None

        # Ensure collection fields are never null
        for key in ["strengths", "weaknesses", "evidence", "recommendations", "missing_information"]:
            val = d.get(key)
            if val is None:
                d[key] = []
            elif isinstance(val, (list, tuple)):
                if key == "evidence":
                    normalized_ev = []
                    for item in val:
                        if isinstance(item, dict):
                            normalized_ev.append(item)
                        elif isinstance(item, str):
                            normalized_ev.append({"claim": item, "source": "unspecified", "quote_or_detail": item})
                    d[key] = normalized_ev
                else:
                    d[key] = [str(x).strip() for x in val if x is not None and str(x).strip()]
            elif isinstance(val, str) and val.strip():
                d[key] = [val.strip()]
            else:
                d[key] = []

        if not isinstance(d.get("metadata"), dict):
            d["metadata"] = {}

        return d


def create_standard_response(
    module: str,
    summary: str,
    score: Optional[float] = None,
    success: bool = True,
    status: str = "COMPLETED",
    strengths: Optional[List[str]] = None,
    weaknesses: Optional[List[str]] = None,
    evidence: Optional[List[Union[Dict[str, Any], EvidenceItem, str]]] = None,
    recommendations: Optional[List[str]] = None,
    missing_information: Optional[List[str]] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> StandardAiResponse:
    """
    Convenience factory function with guaranteed defaults and type casting.
    """
    normalized_evidence: List[Dict[str, Any]] = []
    if evidence:
        for item in evidence:
            if isinstance(item, EvidenceItem):
                normalized_evidence.append(item.model_dump())
            elif isinstance(item, dict):
                normalized_evidence.append(item)
            elif isinstance(item, str):
                normalized_evidence.append({"claim": item, "source": "evidence", "quote_or_detail": item})

    return StandardAiResponse(
        success=success,
        module=module,
        summary=summary or "",
        score=score,
        status=status,
        strengths=strengths or [],
        weaknesses=weaknesses or [],
        evidence=normalized_evidence,
        recommendations=recommendations or [],
        missing_information=missing_information or [],
        metadata=metadata or {}
    )
