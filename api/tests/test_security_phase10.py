import time
import pytest
from unittest.mock import MagicMock
from fastapi import Request
from starlette.datastructures import Headers
from app.core.rate_limiter import InMemoryRateLimiter, get_client_identifier

def test_in_memory_rate_limiter_basic():
    """Verify in-memory sliding window limiter allows up to max_requests and rejects excess."""
    limiter = InMemoryRateLimiter()
    key = "test-client-1:test-path"

    # Allow 3 requests in a 10-second window
    allowed1, rem1 = limiter.check_rate_limit(key, max_requests=3, window_seconds=10)
    assert allowed1 is True
    assert rem1 == 2

    allowed2, rem2 = limiter.check_rate_limit(key, max_requests=3, window_seconds=10)
    assert allowed2 is True
    assert rem2 == 1

    allowed3, rem3 = limiter.check_rate_limit(key, max_requests=3, window_seconds=10)
    assert allowed3 is True
    assert rem3 == 0

    # 4th request must be rejected
    allowed4, rem4 = limiter.check_rate_limit(key, max_requests=3, window_seconds=10)
    assert allowed4 is False
    assert rem4 == 0

def test_in_memory_rate_limiter_window_slide():
    """Verify that requests slide out of the window as time passes."""
    limiter = InMemoryRateLimiter()
    key = "test-client-2:test-path"

    # Send 2 requests with a short 1-second window
    allowed1, _ = limiter.check_rate_limit(key, max_requests=2, window_seconds=1)
    allowed2, _ = limiter.check_rate_limit(key, max_requests=2, window_seconds=1)
    assert allowed1 is True
    assert allowed2 is True

    # 3rd request fails immediately
    allowed3, _ = limiter.check_rate_limit(key, max_requests=2, window_seconds=1)
    assert allowed3 is False

    # Sleep past the 1-second window
    time.sleep(1.1)

    # Next request should be allowed again
    allowed4, rem4 = limiter.check_rate_limit(key, max_requests=2, window_seconds=1)
    assert allowed4 is True
    assert rem4 == 1

def test_client_identifier_proxy_headers():
    """Verify get_client_identifier properly prioritizes reverse proxy headers."""
    # 1. Cloudflare header
    req_cf = MagicMock(spec=Request)
    req_cf.headers = Headers({"cf-connecting-ip": "198.51.100.1"})
    req_cf.client = MagicMock(host="10.0.0.1")
    assert get_client_identifier(req_cf) == "198.51.100.1"

    # 2. X-Forwarded-For chain
    req_xff = MagicMock(spec=Request)
    req_xff.headers = Headers({"x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178"})
    req_xff.client = MagicMock(host="10.0.0.1")
    assert get_client_identifier(req_xff) == "203.0.113.195"

    # 3. X-Real-IP
    req_xreal = MagicMock(spec=Request)
    req_xreal.headers = Headers({"x-real-ip": "198.51.100.2"})
    req_xreal.client = MagicMock(host="10.0.0.1")
    assert get_client_identifier(req_xreal) == "198.51.100.2"

def test_client_identifier_with_bearer_token():
    """Verify user token hash is appended to client identifier for NAT isolation."""
    req_auth = MagicMock(spec=Request)
    req_auth.headers = Headers({
        "x-forwarded-for": "203.0.113.50",
        "authorization": "Bearer sample_user_jwt_token_12345"
    })
    req_auth.client = MagicMock(host="10.0.0.1")
    ident = get_client_identifier(req_auth)
    assert ident.startswith("203.0.113.50:user_")
    assert len(ident) > len("203.0.113.50:user_")
