from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, field

from app.core.config import settings
from app.core.logging import logger
from app.ai.workload import (
    AIWorkload,
    AITask,
    GrokRoute,
    resolve_workload,
    mask_api_key
)
from app.ai.grok_client import GrokConfigurationError

WORKLOAD_SUFFIX_MAP: Dict[AIWorkload, str] = {
    AIWorkload.PDF_ANALYSIS: "PDF",
    AIWorkload.CHAT: "CHAT",
    AIWorkload.RESUME_CAREER: "RESUME",
    AIWorkload.INTERVIEW_ASSESSMENT: "ASSESSMENT",
    AIWorkload.GENERAL_TASKS: "GENERAL",
}

@dataclass
class RouteMetrics:
    success_count: int = 0
    failure_count: int = 0
    consecutive_failures: int = 0
    average_latency_ms: float = 0.0

class GrokTaskRouter:
    """
    Workload-driven model router for xAI Grok.
    Maps application workloads (PDF_ANALYSIS, CHAT, RESUME_CAREER, INTERVIEW_ASSESSMENT, GENERAL_TASKS)
    to specific Grok models, primary/backup API keys, and intra-workload fallback models.
    """
    CIRCUIT_BREAKER_THRESHOLD = 3

    def __init__(self):
        self.metrics: Dict[str, RouteMetrics] = {}

    def _get_metric_key(self, workload: AIWorkload, model: str, masked_key: str) -> str:
        return f"{workload.value}:{model}:{masked_key}"

    def get_api_keys_for_workload(self, workload: AIWorkload) -> List[str]:
        """
        Retrieves the ordered list of API keys for a given workload.
        Precedence:
          1. Specific key: XAI_API_KEY_{WORKLOAD_SUFFIX} (e.g. XAI_API_KEY_PDF)
          2. Shared fallback: XAI_API_KEY
          3. Specific backup: XAI_BACKUP_API_KEY_{WORKLOAD_SUFFIX}
          4. Shared backup: XAI_BACKUP_API_KEY
        Supports comma-separated keys within any variable.
        """
        suffix = WORKLOAD_SUFFIX_MAP.get(workload, workload.name)
        raw_candidates: List[Optional[str]] = [
            getattr(settings, f"XAI_API_KEY_{suffix}", None),
            getattr(settings, f"XAI_API_KEY_{workload.name}", None),
            settings.XAI_API_KEY,
            getattr(settings, f"XAI_BACKUP_API_KEY_{suffix}", None),
            getattr(settings, f"XAI_BACKUP_API_KEY_{workload.name}", None),
            settings.XAI_BACKUP_API_KEY
        ]

        keys: List[str] = []
        seen = set()

        for candidate in raw_candidates:
            if candidate and isinstance(candidate, str) and candidate.strip():
                # Split comma-separated keys if provided
                sub_keys = [k.strip() for k in candidate.split(",") if k.strip()]
                for k in sub_keys:
                    if k not in seen and not k.startswith("${"):
                        keys.append(k)
                        seen.add(k)

        return keys

    def get_models_for_workload(self, workload: AIWorkload) -> Tuple[str, Optional[str]]:
        """
        Returns (primary_model, optional_fallback_model) for the given workload category.
        """
        suffix = WORKLOAD_SUFFIX_MAP.get(workload, workload.name)

        # Primary model selection
        primary = getattr(settings, f"XAI_MODEL_{suffix}", None) or getattr(settings, f"XAI_MODEL_{workload.name}", None)
        if not primary or not primary.strip():
            primary = settings.XAI_DEFAULT_MODEL or "grok-2-mini"

        # Optional fallback model selection (Grok-only)
        fallback = getattr(settings, f"XAI_FALLBACK_MODEL_{suffix}", None) or getattr(settings, f"XAI_FALLBACK_MODEL_{workload.name}", None)
        if not fallback or not fallback.strip():
            fallback = settings.XAI_FALLBACK_MODEL

        # Only queue fallback if it differs from primary
        if fallback and fallback.strip() == primary.strip():
            fallback = None

        return primary.strip(), fallback.strip() if fallback else None

    def get_routes(self, task_or_workload: Any) -> List[GrokRoute]:
        """
        Constructs the ordered execution plan (routes) for the requested workload.
        """
        workload = resolve_workload(task_or_workload)
        suffix = WORKLOAD_SUFFIX_MAP.get(workload, workload.name)
        keys = self.get_api_keys_for_workload(workload)

        if not keys:
            missing_var = f"XAI_API_KEY_{suffix}"
            raise GrokConfigurationError(
                f"No xAI API key configured for workload '{workload.value}'. "
                f"Please set '{missing_var}' or the shared 'XAI_API_KEY' in your environment."
            )

        primary_model, fallback_model = self.get_models_for_workload(workload)

        candidate_routes: List[GrokRoute] = []

        # 1. Primary Model with configured keys (primary key, then backup key for rate limit failover)
        for key in keys:
            candidate_routes.append(GrokRoute(
                workload=workload,
                model=primary_model,
                api_key=key,
                is_fallback=False
            ))

        # 2. In-workload Fallback Model (if configured and distinct)
        if fallback_model:
            for key in keys:
                candidate_routes.append(GrokRoute(
                    workload=workload,
                    model=fallback_model,
                    api_key=key,
                    is_fallback=True
                ))

        # Filter by circuit breaker
        active_routes: List[GrokRoute] = []
        for r in candidate_routes:
            m_key = self._get_metric_key(r.workload, r.model, r.masked_key)
            m = self.metrics.get(m_key)
            if m and m.consecutive_failures >= self.CIRCUIT_BREAKER_THRESHOLD:
                logger.warning(
                    f"[CIRCUIT-BREAKER] Route {r.workload.value}:{r.model} with key {r.masked_key} "
                    f"tripped ({m.consecutive_failures} failures). Skipping."
                )
            else:
                active_routes.append(r)

        # If all routes are tripped by circuit breaker, reset and allow first route to retry
        if not active_routes and candidate_routes:
            logger.info(f"[CIRCUIT-BREAKER] All routes tripped for {workload.value}. Resetting primary route.")
            active_routes.append(candidate_routes[0])

        return active_routes

    def record_success(self, workload: AIWorkload, model: str, masked_key: str, duration_ms: float):
        m_key = self._get_metric_key(workload, model, masked_key)
        m = self.metrics.setdefault(m_key, RouteMetrics())
        m.success_count += 1
        m.consecutive_failures = 0
        if m.success_count == 1:
            m.average_latency_ms = duration_ms
        else:
            m.average_latency_ms += (duration_ms - m.average_latency_ms) / m.success_count

    def record_failure(self, workload: AIWorkload, model: str, masked_key: str, reason: str):
        m_key = self._get_metric_key(workload, model, masked_key)
        m = self.metrics.setdefault(m_key, RouteMetrics())
        m.failure_count += 1
        m.consecutive_failures += 1
        logger.warning(f"[ROUTER] Failure on {m_key} | reason={reason} | consecutive={m.consecutive_failures}")

    def reset_metrics(self):
        self.metrics.clear()

    def get_routing_matrix(self) -> Dict[str, Dict[str, Any]]:
        """Returns the current workload-to-model configuration without revealing secrets."""
        matrix = {}
        for wl in AIWorkload:
            primary_m, fallback_m = self.get_models_for_workload(wl)
            keys = self.get_api_keys_for_workload(wl)
            matrix[wl.value] = {
                "primary_model": primary_m,
                "fallback_model": fallback_m,
                "key_configured": len(keys) > 0,
                "key_count": len(keys),
                "masked_keys": [mask_api_key(k) for k in keys]
            }
        return matrix

# Singleton router instance
grok_router = GrokTaskRouter()

# Alias for backward compatibility
AITaskRouter = GrokTaskRouter
