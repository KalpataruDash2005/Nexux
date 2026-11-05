from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass

class AIWorkload(str, Enum):
    """
    Logical workload categories for xAI Grok model routing.
    """
    PDF_ANALYSIS = "PDF_ANALYSIS"                  # Long-context document understanding, RAG QA, summarization
    CHAT = "CHAT"                                  # Student conversational assistant, low-latency dialogue
    RESUME_CAREER = "RESUME_CAREER"                # Resume analysis, placement readiness, career roadmap
    INTERVIEW_ASSESSMENT = "INTERVIEW_ASSESSMENT"  # Mock interviews, technical coding, aptitude evaluation
    GENERAL_TASKS = "GENERAL_TASKS"                # Task breakdown, daily plans, summaries, flashcards, default

class AITask(str, Enum):
    """
    Task identifiers preserved for backward compatibility across all call sites.
    """
    GENERAL_CHAT = "GENERAL_CHAT"
    CHAT = "CHAT"
    INTERVIEW_ASSISTANCE = "INTERVIEW_ASSISTANCE"
    APTITUDE_GENERATION = "APTITUDE_GENERATION"
    RESUME_ANALYSIS = "RESUME_ANALYSIS"
    CODING_ASSISTANCE = "CODING_ASSISTANCE"
    PLACEMENT_READINESS = "PLACEMENT_READINESS"
    PLACEMENT_ROADMAP = "PLACEMENT_ROADMAP"
    TASK_PLAN = "TASK_PLAN"
    PDF_ANALYSIS = "PDF_ANALYSIS"
    PDF_CHAT = "PDF_CHAT"
    RESUME_CAREER = "RESUME_CAREER"
    INTERVIEW_ASSESSMENT = "INTERVIEW_ASSESSMENT"
    GENERAL_TASKS = "GENERAL_TASKS"

# Centralized mapping of every application task to its target Grok workload category
TASK_TO_WORKLOAD: Dict[str, AIWorkload] = {
    # 1. PDF_ANALYSIS (document understanding & RAG answer generation)
    AITask.PDF_ANALYSIS.value: AIWorkload.PDF_ANALYSIS,
    AITask.PDF_CHAT.value: AIWorkload.PDF_ANALYSIS,
    
    # 2. CHAT (conversational student assistant)
    AITask.CHAT.value: AIWorkload.CHAT,
    AITask.GENERAL_CHAT.value: AIWorkload.CHAT,
    
    # 3. RESUME_CAREER (reasoning-capable resume & placement evaluation)
    AITask.RESUME_ANALYSIS.value: AIWorkload.RESUME_CAREER,
    AITask.PLACEMENT_READINESS.value: AIWorkload.RESUME_CAREER,
    AITask.PLACEMENT_ROADMAP.value: AIWorkload.RESUME_CAREER,
    AITask.RESUME_CAREER.value: AIWorkload.RESUME_CAREER,
    
    # 4. INTERVIEW_ASSESSMENT (reasoning-capable interview simulations & tests)
    AITask.INTERVIEW_ASSISTANCE.value: AIWorkload.INTERVIEW_ASSESSMENT,
    AITask.CODING_ASSISTANCE.value: AIWorkload.INTERVIEW_ASSESSMENT,
    AITask.APTITUDE_GENERATION.value: AIWorkload.INTERVIEW_ASSESSMENT,
    AITask.INTERVIEW_ASSESSMENT.value: AIWorkload.INTERVIEW_ASSESSMENT,
    
    # 5. GENERAL_TASKS (task breakdown, daily schedule planning, default)
    AITask.TASK_PLAN.value: AIWorkload.GENERAL_TASKS,
    AITask.GENERAL_TASKS.value: AIWorkload.GENERAL_TASKS,
}

def resolve_workload(task_or_workload: Any) -> AIWorkload:
    """
    Resolves any task identifier, enum, or string to its canonical AIWorkload.
    """
    if isinstance(task_or_workload, AIWorkload):
        return task_or_workload
    val = getattr(task_or_workload, "value", str(task_or_workload)).upper()
    return TASK_TO_WORKLOAD.get(val, AIWorkload.GENERAL_TASKS)

def mask_api_key(key: Optional[str]) -> str:
    """
    Safely masks API keys for logging and error messages without exposing credentials.
    """
    if not key:
        return "[NOT_SET]"
    clean = key.strip()
    if len(clean) <= 8:
        return "[MASKED]"
    return f"{clean[:4]}...{clean[-4:]}"

@dataclass
class GrokRoute:
    """
    Represents an actionable execution route for Grok model routing.
    """
    workload: AIWorkload
    model: str
    api_key: str
    is_fallback: bool = False

    @property
    def masked_key(self) -> str:
        return mask_api_key(self.api_key)
