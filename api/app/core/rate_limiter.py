from app.core.audit import log_security_event, SecurityEventType
import hashlib
import time
from typing import Dict, Tuple, List
from collections import defaultdict
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.logging import logger

def get_client_identifier(request: Request) -> str:
    """
    Extracts high-fidelity client identification across reverse proxies (Vercel, Cloudflare).
    Combines client IP with user authentication hash when available for granular per-user rate limiting.
    """
    # 1. Cloudflare header
    client_ip = request.headers.get("cf-connecting-ip")
    if not client_ip:
        # 2. X-Forwarded-For (first IP is the original client)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            if parts:
                client_ip = parts[0]

    # 3. X-Real-IP
    if not client_ip:
        client_ip = request.headers.get("x-real-ip")

    # 4. Socket host fallback
    if not client_ip:
        client_ip = request.client.host if request.client else "unknown"

    # 5. Blend in auth token hash if present to isolate users behind corporate NAT
    auth_header = request.headers.get("authorization", "")
    if auth_header and auth_header.startswith("Bearer "):
        token_hash = hashlib.sha256(auth_header.encode()).hexdigest()[:12]
        return f"{client_ip}:user_{token_hash}"

    return client_ip

class InMemoryRateLimiter:
    """
    Sliding-window in-memory rate limiter with automatic stale key cleanup.
    Provides bounded per-client request throttling suitable for serverless / edge instances.
    """
    def __init__(self):
        # Maps client_key -> list of timestamps
        self._history: Dict[str, List[float]] = defaultdict(list)
        self._last_cleanup = time.time()
        self._cleanup_interval = 300  # Clean up stale IPs every 5 minutes

    def _cleanup_stale(self, now: float, max_window: int = 60):
        cutoff = now - max_window
        keys_to_delete = []
        for key, timestamps in list(self._history.items()):
            self._history[key] = [t for t in timestamps if t > cutoff]
            if not self._history[key]:
                keys_to_delete.append(key)
        for key in keys_to_delete:
            del self._history[key]
        self._last_cleanup = now

    def check_rate_limit(self, client_key: str, max_requests: int = 60, window_seconds: int = 60) -> Tuple[bool, int]:
        """
        Checks whether client_key has exceeded max_requests within window_seconds.
        Returns: (is_allowed, remaining_requests)
        """
        now = time.time()
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup_stale(now, max_window=window_seconds)

        window_start = now - window_seconds
        timestamps = [t for t in self._history[client_key] if t > window_start]
        self._history[client_key] = timestamps

        if len(timestamps) >= max_requests:
            return False, 0

        self._history[client_key].append(now)
        remaining = max_requests - len(self._history[client_key])
        return True, remaining

limiter = InMemoryRateLimiter()

def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    FastAPI dependency for endpoint rate limiting based on client IP / auth token.
    """
    async def dependency(request: Request):
        if not settings.RATE_LIMIT_ENABLED:
            return

        client_id = get_client_identifier(request)
        path = request.url.path
        client_key = f"{client_id}:{path}"

        allowed, remaining = limiter.check_rate_limit(
            client_key=client_key,
            max_requests=max_requests,
            window_seconds=window_seconds
        )

        if not allowed:
            log_security_event(SecurityEventType.RATE_LIMIT_EXCEEDED, {"path": path, "max_requests": max_requests, "window_seconds": window_seconds}, client_ip=client_id, severity="WARNING")
            logger.warning(f"[RATE-LIMIT] Client {client_id} exceeded limit on {path} ({max_requests} req / {window_seconds}s)")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded. Maximum {max_requests} requests per {window_seconds} seconds.",
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(window_seconds)
                }
            )

    return dependency
