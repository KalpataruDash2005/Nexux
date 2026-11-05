import asyncio
import pytest
from unittest.mock import AsyncMock, patch

from app.core.config import settings
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
    GrokAPIError
)
from app.ai.task_router import GrokTaskRouter, grok_router
from app.ai.ai_gateway import AIGateway

# ------------------------------------------------------------------------------
# Test 1: Workload Category Mapping
# ------------------------------------------------------------------------------
def test_workload_resolution():
    # 1. PDF_ANALYSIS
    assert resolve_workload(AITask.PDF_ANALYSIS) == AIWorkload.PDF_ANALYSIS
    assert resolve_workload(AITask.PDF_CHAT) == AIWorkload.PDF_ANALYSIS
    assert resolve_workload("pdf_analysis") == AIWorkload.PDF_ANALYSIS

    # 2. CHAT
    assert resolve_workload(AITask.GENERAL_CHAT) == AIWorkload.CHAT
    assert resolve_workload(AITask.CHAT) == AIWorkload.CHAT
    assert resolve_workload("CHAT") == AIWorkload.CHAT

    # 3. RESUME_CAREER
    assert resolve_workload(AITask.RESUME_ANALYSIS) == AIWorkload.RESUME_CAREER
    assert resolve_workload(AITask.PLACEMENT_READINESS) == AIWorkload.RESUME_CAREER
    assert resolve_workload(AITask.PLACEMENT_ROADMAP) == AIWorkload.RESUME_CAREER

    # 4. INTERVIEW_ASSESSMENT
    assert resolve_workload(AITask.INTERVIEW_ASSISTANCE) == AIWorkload.INTERVIEW_ASSESSMENT
    assert resolve_workload(AITask.CODING_ASSISTANCE) == AIWorkload.INTERVIEW_ASSESSMENT
    assert resolve_workload(AITask.APTITUDE_GENERATION) == AIWorkload.INTERVIEW_ASSESSMENT

    # 5. GENERAL_TASKS
    assert resolve_workload(AITask.TASK_PLAN) == AIWorkload.GENERAL_TASKS
    assert resolve_workload("unknown_custom_task") == AIWorkload.GENERAL_TASKS

# ------------------------------------------------------------------------------
# Test 2: Category-Specific Model Routing & API Key Isolation
# ------------------------------------------------------------------------------
def test_workload_model_and_key_isolation(monkeypatch):
    router = GrokTaskRouter()

    # Configure distinct models and keys per workload
    monkeypatch.setattr(settings, "XAI_MODEL_PDF", "grok-2-vision-1212")
    monkeypatch.setattr(settings, "XAI_API_KEY_PDF", "xai-pdf-key-1111")

    monkeypatch.setattr(settings, "XAI_MODEL_CHAT", "grok-2-mini")
    monkeypatch.setattr(settings, "XAI_API_KEY_CHAT", "xai-chat-key-2222")

    monkeypatch.setattr(settings, "XAI_MODEL_RESUME", "grok-2-1212")
    monkeypatch.setattr(settings, "XAI_API_KEY_RESUME", "xai-resume-key-3333")

    monkeypatch.setattr(settings, "XAI_MODEL_ASSESSMENT", "grok-2-1212")
    monkeypatch.setattr(settings, "XAI_API_KEY_ASSESSMENT", "xai-assessment-key-4444")

    monkeypatch.setattr(settings, "XAI_MODEL_GENERAL", "grok-default-mini")
    monkeypatch.setattr(settings, "XAI_API_KEY_GENERAL", "xai-general-key-5555")

    # Verify PDF_ANALYSIS
    pdf_routes = router.get_routes(AIWorkload.PDF_ANALYSIS)
    assert pdf_routes[0].model == "grok-2-vision-1212"
    assert pdf_routes[0].api_key == "xai-pdf-key-1111"

    # Verify CHAT
    chat_routes = router.get_routes(AIWorkload.CHAT)
    assert chat_routes[0].model == "grok-2-mini"
    assert chat_routes[0].api_key == "xai-chat-key-2222"

    # Verify RESUME_CAREER
    resume_routes = router.get_routes(AIWorkload.RESUME_CAREER)
    assert resume_routes[0].model == "grok-2-1212"
    assert resume_routes[0].api_key == "xai-resume-key-3333"

    # Verify INTERVIEW_ASSESSMENT
    assess_routes = router.get_routes(AIWorkload.INTERVIEW_ASSESSMENT)
    assert assess_routes[0].model == "grok-2-1212"
    assert assess_routes[0].api_key == "xai-assessment-key-4444"

    # Verify GENERAL_TASKS
    gen_routes = router.get_routes(AIWorkload.GENERAL_TASKS)
    assert gen_routes[0].model == "grok-default-mini"
    assert gen_routes[0].api_key == "xai-general-key-5555"

# ------------------------------------------------------------------------------
# Test 3: Shared Key Reuse Across Workloads
# ------------------------------------------------------------------------------
def test_shared_key_reuse_across_all_categories(monkeypatch):
    router = GrokTaskRouter()

    # Clear category-specific keys, set only shared global key
    for cat in ["PDF", "CHAT", "RESUME", "ASSESSMENT", "GENERAL"]:
        monkeypatch.setattr(settings, f"XAI_API_KEY_{cat}", None)
        monkeypatch.setattr(settings, f"XAI_BACKUP_API_KEY_{cat}", None)
    monkeypatch.setattr(settings, "XAI_API_KEY", "xai-universal-shared-key-9999")
    monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY", None)

    # All workloads should successfully reuse the single shared key
    for wl in AIWorkload:
        routes = router.get_routes(wl)
        assert len(routes) >= 1
        assert routes[0].api_key == "xai-universal-shared-key-9999"

# ------------------------------------------------------------------------------
# Test 4: Missing Key Produces Clear Informative Error
# ------------------------------------------------------------------------------
def test_missing_key_raises_grok_configuration_error(monkeypatch):
    router = GrokTaskRouter()

    monkeypatch.setattr(settings, "XAI_API_KEY", None)
    monkeypatch.setattr(settings, "XAI_API_KEY_PDF", None)
    monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY", None)
    monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY_PDF", None)

    with pytest.raises(GrokConfigurationError) as exc_info:
        router.get_routes(AIWorkload.PDF_ANALYSIS)
    
    assert "No xAI API key configured for workload 'PDF_ANALYSIS'" in str(exc_info.value)
    assert "XAI_API_KEY_PDF" in str(exc_info.value)
    assert "XAI_API_KEY" in str(exc_info.value)

# ------------------------------------------------------------------------------
# Test 5: Grok Intra-Workload Fallback Model Execution
# ------------------------------------------------------------------------------
def test_grok_intra_workload_fallback_on_failure(monkeypatch):
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        # Primary model (grok-2-1212) fails with retryable 500
        # Fallback model (grok-beta) succeeds
        async def mock_generate(model, api_key, system_prompt, user_prompt, **kwargs):
            if model == "grok-2-1212":
                raise GrokAPIError(status_code=500, message="Grok 2 transient failure", retryable=True)
            elif model == "grok-beta":
                return "Fallback Grok-Beta response"
            raise RuntimeError(f"Unexpected model {model}")

        mock_client.generate = AsyncMock(side_effect=mock_generate)

        router = GrokTaskRouter()
        monkeypatch.setattr(settings, "XAI_API_KEY_RESUME", "xai-resume-key-1234")
        monkeypatch.setattr(settings, "XAI_MODEL_RESUME", "grok-2-1212")
        monkeypatch.setattr(settings, "XAI_FALLBACK_MODEL_RESUME", "grok-beta")
        monkeypatch.setattr(settings, "XAI_MAX_RETRIES", 1)

        gateway = AIGateway(router=router, client=mock_client)

        result = await gateway.generate(
            task=AIWorkload.RESUME_CAREER,
            system_prompt="Analyze resume",
            user_prompt="Resume text"
        )

        assert result == "Fallback Grok-Beta response"
        # Primary model tried twice (1 initial + 1 retry), then fallback tried once
        assert mock_client.generate.call_count == 3

    asyncio.run(_test())

# ------------------------------------------------------------------------------
# Test 6: Bounded Key Failover on Rate Limit (429)
# ------------------------------------------------------------------------------
def test_secondary_key_failover_on_rate_limit(monkeypatch):
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        
        async def mock_generate(model, api_key, **kwargs):
            if api_key == "xai-primary-key":
                raise GrokAPIError(status_code=429, message="Rate limit exceeded", retryable=True)
            elif api_key == "xai-backup-key":
                return "Success via backup key"
            raise RuntimeError(f"Unknown key {api_key}")

        mock_client.generate = AsyncMock(side_effect=mock_generate)

        router = GrokTaskRouter()
        monkeypatch.setattr(settings, "XAI_API_KEY_CHAT", "xai-primary-key")
        monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY_CHAT", "xai-backup-key")
        monkeypatch.setattr(settings, "XAI_FALLBACK_MODEL", None)
        monkeypatch.setattr(settings, "XAI_MAX_RETRIES", 0)  # Immediate failover to backup key

        gateway = AIGateway(router=router, client=mock_client)

        result = await gateway.generate(
            task=AIWorkload.CHAT,
            system_prompt="Hello",
            user_prompt="Hi Grok"
        )

        assert result == "Success via backup key"
        assert mock_client.generate.call_count == 2

    asyncio.run(_test())

# ------------------------------------------------------------------------------
# Test 7: Non-Retryable Error Fails Immediately Without Attempting Other Keys
# ------------------------------------------------------------------------------
def test_terminal_non_retryable_error_does_not_loop(monkeypatch):
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        # 401 Unauthorized must raise immediately
        mock_client.generate = AsyncMock(side_effect=GrokAPIError(
            status_code=401,
            message="Invalid API Key",
            retryable=False
        ))

        router = GrokTaskRouter()
        monkeypatch.setattr(settings, "XAI_API_KEY_GENERAL", "xai-bad-key-1")
        monkeypatch.setattr(settings, "XAI_BACKUP_API_KEY_GENERAL", "xai-backup-key-2")
        monkeypatch.setattr(settings, "XAI_FALLBACK_MODEL", "grok-beta")

        gateway = AIGateway(router=router, client=mock_client)

        with pytest.raises(GrokAPIError) as exc_info:
            await gateway.generate(
                task=AIWorkload.GENERAL_TASKS,
                system_prompt="Test",
                user_prompt="Test"
            )

        assert exc_info.value.status_code == 401
        # Must NOT try the backup key or fallback model on 401
        assert mock_client.generate.call_count == 1

    asyncio.run(_test())

# ------------------------------------------------------------------------------
# Test 8: Retry Limits Prevent Infinite Loops
# ------------------------------------------------------------------------------
def test_retry_limits_prevent_infinite_loops(monkeypatch):
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        mock_client.generate = AsyncMock(side_effect=GrokAPIError(
            status_code=503,
            message="Service Overloaded",
            retryable=True
        ))

        router = GrokTaskRouter()
        monkeypatch.setattr(settings, "XAI_API_KEY_CHAT", "xai-test-key")
        monkeypatch.setattr(settings, "XAI_FALLBACK_MODEL", None)
        monkeypatch.setattr(settings, "XAI_MAX_RETRIES", 2)

        gateway = AIGateway(router=router, client=mock_client)

        with pytest.raises(RuntimeError) as exc_info:
            await gateway.generate(
                task=AIWorkload.CHAT,
                system_prompt="Test",
                user_prompt="Test"
            )

        assert "All available xAI Grok routes failed" in str(exc_info.value)
        # Initial attempt + 2 retries = 3 attempts total
        assert mock_client.generate.call_count == 3

    asyncio.run(_test())

# ------------------------------------------------------------------------------
# Test 9: Gemini and OpenRouter Are Not Called / No Runtime Dependency
# ------------------------------------------------------------------------------
def test_gemini_and_openrouter_are_not_in_runtime():
    # Verify neither Gemini nor OpenRouter exist in the ai module
    import app.ai as ai_module
    
    assert not hasattr(ai_module, "GeminiAIProvider")
    assert not hasattr(ai_module, "OpenRouterAIProvider")
    assert not hasattr(ai_module, "GroqAIProvider")
    assert hasattr(ai_module, "GrokClient")
    assert hasattr(ai_module, "GrokTaskRouter")
    assert hasattr(ai_module, "AIWorkload")

# ------------------------------------------------------------------------------
# Test 10: Structured Output / JSON Mode Validation
# ------------------------------------------------------------------------------
def test_grok_json_mode_and_extraction():
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        fenced_json = "```json\n{\"score\": 98, \"readiness\": \"EXCELLENT\"}\n```"
        mock_client.generate = AsyncMock(return_value=fenced_json)

        router = GrokTaskRouter()
        with patch.object(router, "get_routes", return_value=[
            GrokRoute(workload=AIWorkload.INTERVIEW_ASSESSMENT, model="grok-2-1212", api_key="test-key")
        ]):
            gateway = AIGateway(router=router, client=mock_client)
            result = await gateway.generate_json(
                task=AIWorkload.INTERVIEW_ASSESSMENT,
                system_prompt="Evaluate candidate",
                user_prompt="Answer text"
            )

            assert result["score"] == 98
            assert result["readiness"] == "EXCELLENT"

    asyncio.run(_test())

# ------------------------------------------------------------------------------
# Test 11: Streaming Generation
# ------------------------------------------------------------------------------
def test_grok_streaming_generation():
    async def _test():
        mock_client = AsyncMock(spec=GrokClient)
        
        async def mock_stream(*args, **kwargs):
            for token in ["Hello", " ", "from", " ", "Grok", "!"]:
                yield token

        mock_client.generate_stream = mock_stream

        router = GrokTaskRouter()
        with patch.object(router, "get_routes", return_value=[
            GrokRoute(workload=AIWorkload.CHAT, model="grok-2-mini", api_key="test-key")
        ]):
            gateway = AIGateway(router=router, client=mock_client)
            tokens = []
            async for token in gateway.generate_stream(
                task=AIWorkload.CHAT,
                system_prompt="Hi",
                user_prompt="Hello"
            ):
                tokens.append(token)

            assert "".join(tokens) == "Hello from Grok!"

    asyncio.run(_test())
