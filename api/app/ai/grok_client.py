import json
from typing import Optional, AsyncGenerator, Dict, Any, List, Tuple
import httpx

from app.core.config import settings
from app.core.logging import logger
from app.ai.workload import mask_api_key

class GrokError(Exception):
    """Base exception for Grok client operations."""
    pass

class GrokConfigurationError(GrokError):
    """Raised when an API key or configuration required for a workload is missing."""
    pass

class GrokAPIError(GrokError):
    """Raised when the AI Provider returns an HTTP error status."""
    def __init__(self, status_code: int, message: str, retryable: bool = False):
        clean_msg = message.strip()
        super().__init__(f"AI Provider returned HTTP {status_code}: {clean_msg}")
        self.status_code = status_code
        self.message = clean_msg
        self.retryable = retryable

class GrokClient:
    """
    Dedicated HTTP client for communicating with OpenAI-compatible APIs (xAI Grok & Groq).
    Provides standard completions, streaming, structured JSON responses, model translation,
    and intelligent error categorization.
    """
    def __init__(self, base_url: Optional[str] = None, timeout_seconds: Optional[float] = None):
        self.base_url = (base_url or settings.XAI_API_BASE_URL).rstrip("/")
        self.timeout = timeout_seconds or settings.XAI_TIMEOUT_SECONDS

    def _resolve_target(self, model: str, api_key: str) -> Tuple[str, str]:
        """
        Dynamically resolves the target base URL and model according to the API key.
        - If api_key begins with 'gsk_': routes to Groq API (https://api.groq.com/openai/v1)
          and maps xAI model names to active Groq models (e.g. openai/gpt-oss-120b, openai/gpt-oss-20b).
        - If api_key begins with 'xai-' or 'xai_': routes to xAI API (settings.XAI_API_BASE_URL).
        - If settings.XAI_API_BASE_URL is custom, it is respected.
        """
        clean_key = (api_key or "").strip()
        base_url = self.base_url
        target_model = model

        if clean_key.startswith("gsk_"):
            # Groq Provider autodetection
            if "api.x.ai" in base_url or base_url.endswith("/v1"):
                base_url = "https://api.groq.com/openai/v1"

            groq_model_map = {
                "grok-2-1212": "openai/gpt-oss-120b",
                "grok-2-vision-1212": "openai/gpt-oss-120b",
                "grok-2-mini": "openai/gpt-oss-20b",
                "grok-default-mini": "openai/gpt-oss-20b",
                "grok-beta": "qwen/qwen3.8-27b",
                "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
                "llama-3.1-8b-instant": "openai/gpt-oss-20b",
            }
            target_model = groq_model_map.get(model, model)
        elif clean_key.startswith("xai-") or clean_key.startswith("xai_"):
            # Native xAI Provider
            if "groq.com" in base_url:
                base_url = "https://api.x.ai/v1"
            if "/" in target_model:
                target_model = "grok-2-1212"
        elif clean_key.startswith("sk-") and not clean_key.startswith("gsk_"):
            if "api.x.ai" in base_url:
                base_url = "https://api.openai.com/v1"

        return base_url.rstrip("/"), target_model

    def _build_headers(self, api_key: str) -> Dict[str, str]:
        if not api_key or not api_key.strip():
            raise GrokConfigurationError("AI Provider API key is missing or blank.")
        return {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "Nexaura-CareerOS/2.0"
        }

    def _build_messages(self, system_prompt: Optional[str], user_prompt: str) -> List[Dict[str, str]]:
        messages = []
        if system_prompt and system_prompt.strip():
            messages.append({"role": "system", "content": system_prompt.strip()})
        messages.append({"role": "user", "content": user_prompt})
        return messages

    def _categorize_error(self, status_code: int, error_text: str) -> GrokAPIError:
        """
        Determines if an API error is transient (retryable) or terminal (non-retryable).
        Non-retryable: 400 (Bad Request), 401 (Unauthorized/invalid key), 403 (Forbidden), 422 (Unprocessable)
        Retryable: 429 (Rate Limit / Quota Spikes), 500, 502, 503, 504 (Server Overload)
        """
        safe_text = error_text[:350] if error_text else f"HTTP {status_code}"
        retryable = status_code in (429, 500, 502, 503, 504)
        return GrokAPIError(status_code=status_code, message=safe_text, retryable=retryable)

    async def generate(
        self,
        model: str,
        api_key: str,
        system_prompt: Optional[str],
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000,
        json_mode: bool = False
    ) -> str:
        effective_url, effective_model = self._resolve_target(model, api_key)
        url = f"{effective_url}/chat/completions"
        headers = self._build_headers(api_key)
        messages = self._build_messages(system_prompt, user_prompt)

        payload: Dict[str, Any] = {
            "model": effective_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                response = await client.post(url, headers=headers, json=payload)
            except httpx.TimeoutException as e:
                raise GrokAPIError(status_code=408, message=f"Request timed out: {e}", retryable=True)
            except httpx.NetworkError as e:
                raise GrokAPIError(status_code=503, message=f"Network transport error: {e}", retryable=True)

            if response.status_code != 200:
                raise self._categorize_error(response.status_code, response.text)

            try:
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except (KeyError, IndexError, json.JSONDecodeError) as e:
                raise GrokError(f"Unexpected response format from AI Provider: {e}")

    async def generate_stream(
        self,
        model: str,
        api_key: str,
        system_prompt: Optional[str],
        user_prompt: str,
        temperature: float = 0.7,
        max_tokens: int = 1000
    ) -> AsyncGenerator[str, None]:
        effective_url, effective_model = self._resolve_target(model, api_key)
        url = f"{effective_url}/chat/completions"
        headers = self._build_headers(api_key)
        messages = self._build_messages(system_prompt, user_prompt)

        payload = {
            "model": effective_model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                async with client.stream("POST", url, headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        raise self._categorize_error(response.status_code, err_body.decode("utf-8", errors="ignore"))

                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data_str)
                            delta = chunk["choices"][0]["delta"]
                            content = delta.get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue
            except httpx.TimeoutException as e:
                raise GrokAPIError(status_code=408, message=f"Stream timed out: {e}", retryable=True)
            except httpx.NetworkError as e:
                raise GrokAPIError(status_code=503, message=f"Network streaming error: {e}", retryable=True)

# Global singleton client
grok_client = GrokClient()
