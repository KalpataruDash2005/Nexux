import asyncio
import hashlib
import json
import time
import uuid
from typing import Optional, List, Dict, Any, AsyncGenerator, Union

from app.core.config import settings
from app.core.logging import logger
from app.core.cache import cache_manager
from app.ai.workload import (
    AIWorkload,
    AITask,
    GrokRoute,
    resolve_workload,
    mask_api_key
)
from app.ai.grok_client import (
    GrokClient,
    GrokError,
    GrokConfigurationError,
    GrokAPIError,
    grok_client
)
from app.ai.task_router import grok_router, GrokTaskRouter

class AIGateway:
    """
    Centralized AI Gateway orchestrating xAI Grok model routing,
    workload-based model selection, bounded retries, and intra-workload fallbacks.
    """
    def __init__(self, router: Optional[GrokTaskRouter] = None, client: Optional[GrokClient] = None):
        self.task_router = router or grok_router
        self.client = client or grok_client
        self.semaphore = asyncio.Semaphore(15)
        self.cache = cache_manager

    def _hash_prompt(self, system: Optional[str], user: str, temperature: float, max_tokens: int, json_mode: bool) -> str:
        combined = f"{system or ''}|{user}|{temperature}|{max_tokens}|{json_mode}"
        return hashlib.sha256(combined.encode("utf-8")).hexdigest()

    def _determine_output_tokens(self, workload: AIWorkload, task_hint: Any, max_tokens: int) -> int:
        if max_tokens > 0:
            return max_tokens
        
        token_map = {
            AIWorkload.PDF_ANALYSIS: 1500,
            AIWorkload.CHAT: 600,
            AIWorkload.RESUME_CAREER: 2500,
            AIWorkload.INTERVIEW_ASSESSMENT: 1500,
            AIWorkload.GENERAL_TASKS: 1000
        }
        return token_map.get(workload, 1000)

    def extract_json(self, raw: str) -> Optional[str]:
        if not raw or not raw.strip():
            return None
        text = raw.strip()

        # Remove markdown code fences
        if text.startswith("```"):
            first_nl = text.find("\n")
            if first_nl != -1:
                text = text[first_nl + 1:]
            last_fence = text.rfind("```")
            if last_fence != -1:
                text = text[:last_fence]
            text = text.strip()

        first_brace = text.find("{")
        first_bracket = text.find("[")

        if first_brace == -1 and first_bracket == -1:
            return text

        is_object = first_brace != -1 and (first_bracket == -1 or first_brace < first_bracket)
        start = first_brace if is_object else first_bracket
        open_char = "{" if is_object else "["
        close_char = "}" if is_object else "]"

        depth = 0
        in_quotes = False
        escape = False

        for i in range(start, len(text)):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_quotes = not in_quotes
                continue
            if not in_quotes:
                if c == open_char:
                    depth += 1
                elif c == close_char:
                    depth -= 1
                    if depth == 0:
                        return text[start:i + 1]
        return text

    def is_valid_json(self, raw: str) -> bool:
        extracted = self.extract_json(raw)
        if not extracted:
            return False
        try:
            json.loads(extracted)
            return True
        except Exception:
            return False

    async def generate(
        self,
        task: Union[AITask, AIWorkload, str],
        system_prompt: Optional[str],
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 0,
        json_mode: bool = False
    ) -> str:
        workload = resolve_workload(task)
        task_str = getattr(task, "value", str(task))
        final_tokens = self._determine_output_tokens(workload, task, max_tokens)

        prompt_hash = self._hash_prompt(system_prompt, user_prompt, temperature, final_tokens, json_mode)
        fingerprint = cache_manager.build_key("grok", None, workload.value, prompt_hash)

        cacheable = workload == AIWorkload.RESUME_CAREER
        if cacheable and fingerprint in self.cache:
            logger.info(f"[GROK-GATEWAY] Reusing cached response for workload: {workload.value} ({task_str})")
            return self.cache[fingerprint]

        req_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        logger.info(f"[GROK-GATEWAY] Grok task started | RequestId={req_id} | Workload={workload.value} | Task={task_str}")

        routes = self.task_router.get_routes(workload)
        last_exception = None
        result = None
        successful_model = None

        async with self.semaphore:
            for route_idx, route in enumerate(routes):
                m = route.model
                k = route.api_key
                masked_k = route.masked_key
                is_fb = route.is_fallback

                # Bounded retry loop per route for transient/retryable errors
                max_retries = settings.XAI_MAX_RETRIES if not is_fb else 1

                for attempt in range(max_retries + 1):
                    route_start = time.time()
                    try:
                        logger.info(
                            f"[GROK-GATEWAY] RequestId={req_id} | Workload={workload.value} | "
                            f"Model={m} | Key={masked_k} | Fallback={is_fb} | Attempt={attempt + 1}/{max_retries + 1}"
                        )

                        raw_result = await self.client.generate(
                            model=m,
                            api_key=k,
                            system_prompt=system_prompt,
                            user_prompt=user_prompt,
                            temperature=temperature,
                            max_tokens=final_tokens,
                            json_mode=json_mode
                        )
                        route_duration = (time.time() - route_start) * 1000

                        if not raw_result or not raw_result.strip():
                            logger.warning(f"[GROK-GATEWAY] RequestId={req_id} | Empty response from model={m}")
                            self.task_router.record_failure(workload, m, masked_k, "EMPTY_RESPONSE")
                            last_exception = RuntimeError(f"Empty response from Grok model '{m}'")
                            continue

                        requires_json = json_mode or (system_prompt and "Return ONLY valid JSON" in system_prompt)
                        if requires_json and not self.is_valid_json(raw_result):
                            logger.warning(f"[GROK-GATEWAY] RequestId={req_id} | Invalid JSON from model={m}")
                            self.task_router.record_failure(workload, m, masked_k, "INVALID_JSON")
                            last_exception = RuntimeError(f"Grok model '{m}' produced non-JSON output")
                            continue

                        # Route Succeeded
                        self.task_router.record_success(workload, m, masked_k, route_duration)
                        successful_model = m
                        result = raw_result
                        break

                    except GrokAPIError as e:
                        route_duration = (time.time() - route_start) * 1000
                        self.task_router.record_failure(workload, m, masked_k, f"HTTP_{e.status_code}")
                        last_exception = e

                        # Non-retryable errors (e.g. 401 Unauthorized, 403 Forbidden, 400 Bad Request):
                        # Stop immediately and raise to prevent key abuse / infinite auth loops
                        if not e.retryable:
                            logger.error(
                                f"[GROK-GATEWAY] Terminal non-retryable error ({e.status_code}): {e.message}. "
                                f"Failing immediately without attempting other routes."
                            )
                            raise e

                        # Retryable error (429 Rate Limit / 5xx Overload)
                        if attempt < max_retries:
                            backoff = 0.5 * (2 ** attempt)
                            logger.warning(
                                f"[GROK-GATEWAY] Transient error ({e.status_code}) on model={m}. "
                                f"Retrying in {backoff:.1f}s (attempt {attempt + 1}/{max_retries})..."
                            )
                            await asyncio.sleep(backoff)
                        else:
                            logger.warning(f"[GROK-GATEWAY] Retries exhausted for route model={m}. Moving to next route.")

                    except Exception as e:
                        route_duration = (time.time() - route_start) * 1000
                        logger.warning(f"[GROK-GATEWAY] Unexpected error on model={m}: {e}")
                        self.task_router.record_failure(workload, m, masked_k, str(e))
                        last_exception = e
                        break

                if result:
                    break

        if not result:
            logger.error(f"[GROK-GATEWAY] RequestId={req_id} | All Grok routes failed for {workload.value} | LastError={last_exception}")
            raise RuntimeError(f"All available xAI Grok routes failed for workload '{workload.value}': {last_exception}")

        total_duration = (time.time() - start_time) * 1000
        logger.info(
            f"[GROK-GATEWAY] RequestId={req_id} | Workload={workload.value} | Model={successful_model} | "
            f"Duration={total_duration:.1f}ms | Status=SUCCESS"
        )

        if cacheable:
            self.cache[fingerprint] = result

        return result

    async def generate_json(
        self,
        task: Union[AITask, AIWorkload, str],
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.5,
        max_tokens: int = 0
    ) -> Dict[str, Any]:
        robust_system = (
            f"{system_prompt}\n\n"
            "CRITICAL: Return ONLY a valid JSON object. Do not wrap in markdown or backticks. "
            "Do not include any introductory or concluding text."
        )
        raw = await self.generate(
            task=task,
            system_prompt=robust_system,
            user_prompt=user_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            json_mode=True
        )
        extracted = self.extract_json(raw)
        try:
            return json.loads(extracted)
        except Exception as e:
            logger.error(f"Failed to parse Grok JSON response: {raw[:300]}")
            raise RuntimeError(f"Grok returned invalid JSON: {e}")

    async def generate_stream(
        self,
        task: Union[AITask, AIWorkload, str],
        system_prompt: Optional[str],
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> AsyncGenerator[str, None]:
        workload = resolve_workload(task)
        routes = self.task_router.get_routes(workload)

        for route in routes:
            m = route.model
            k = route.api_key
            masked_k = route.masked_key
            try:
                logger.info(f"[GROK-STREAM] Starting stream for {workload.value} via Grok model={m}")
                async for token in self.client.generate_stream(
                    model=m,
                    api_key=k,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens
                ):
                    yield token
                return
            except GrokAPIError as e:
                self.task_router.record_failure(workload, m, masked_k, f"STREAM_HTTP_{e.status_code}")
                if not e.retryable:
                    raise e
                logger.warning(f"[GROK-STREAM] Stream failed on model={m} ({e}). Attempting next route...")
                continue
            except Exception as e:
                logger.warning(f"[GROK-STREAM] Stream failed on model={m}: {e}. Attempting next route...")
                self.task_router.record_failure(workload, m, masked_k, str(e))
                continue

        raise RuntimeError(f"All configured Grok routes failed during streaming for workload '{workload.value}'")

# Global singleton instance
ai_gateway = AIGateway()
