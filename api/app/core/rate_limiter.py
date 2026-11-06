import hashlib
import ipaddress
import json
import time
import urllib.request
from typing import Dict, Tuple, List, Optional
from collections import defaultdict
from fastapi import Request, HTTPException, status
from app.core.audit import log_security_event, SecurityEventType
from app.core.config import settings
from app.core.logging import logger

def is_valid_ip(ip_str: Optional[str]) -> bool:
    """Validates that a string is a syntactically valid IPv4 or IPv6 address."""
    if not ip_str:
        return False
    try:
        ipaddress.ip_address(ip_str.strip())
        return True
    except ValueError:
        return False

def get_client_identifier(request: Request) -> str:
    """
    Extracts high-fidelity, tamper-resistant client identification across reverse proxies (Vercel, Cloudflare).
    Prioritizes trusted edge headers (CF-Connecting-IP, X-Real-IP, X-Vercel-IP).
    When parsing X-Forwarded-For, selects the rightmost valid proxy IP to prevent client-injected spoofing.
    Combines client IP with user authentication hash when available for granular per-user rate limiting.
    """
    client_ip: Optional[str] = None

    # 1. Cloudflare edge header (cannot be forged by client when Cloudflare is the proxy)
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and is_valid_ip(cf_ip):
        client_ip = cf_ip.strip()

    # 2. X-Forwarded-For (standard RFC 7239: original client IP is leftmost valid entry)
    if not client_ip:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            for candidate in parts:
                if is_valid_ip(candidate):
                    client_ip = candidate
                    break

    # 3. X-Real-IP (set by Vercel / Nginx edge)
    if not client_ip:
        real_ip = request.headers.get("x-real-ip")
        if real_ip and is_valid_ip(real_ip):
            client_ip = real_ip.strip()

    # 4. X-Vercel-IP (set by Vercel edge infrastructure)
    if not client_ip:
        vercel_ip = request.headers.get("x-vercel-ip")
        if vercel_ip and is_valid_ip(vercel_ip):
            client_ip = vercel_ip.strip()

    # 5. Socket client host fallback
    if not client_ip:
        if request.client and request.client.host and is_valid_ip(request.client.host):
            client_ip = request.client.host
        else:
            client_ip = "127.0.0.1"

    # 6. Granular per-user isolation (prevents NAT collision among distinct users)
    auth_header = request.headers.get("authorization", "")
    if auth_header and auth_header.startswith("Bearer "):
        token_hash = hashlib.sha256(auth_header.encode("utf-8")).hexdigest()[:12]
        return f"{client_ip}:user_{token_hash}"

    return client_ip

class InMemoryRateLimiter:
    """
    Sliding-window in-memory rate limiter with automatic stale key cleanup.
    Provides bounded per-client request throttling suitable for serverless / edge instances.
    """
    def __init__(self):
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

class DistributedRateLimiter:
    """
    Dual-layer rate limiter:
    - Primary: Upstash Redis REST distributed cache (shared across all Vercel serverless instances).
    - Resilient Fallback: Sliding-window InMemoryRateLimiter on network timeout or when Redis is unconfigured.
    """
    def __init__(self):
        self.in_memory = InMemoryRateLimiter()

    def check_rate_limit(self, client_key: str, max_requests: int = 60, window_seconds: int = 60) -> Tuple[bool, int]:
        if settings.UPSTASH_REDIS_REST_URL and settings.UPSTASH_REDIS_REST_TOKEN:
            try:
                clean_key = f"rl:{hashlib.sha256(client_key.encode('utf-8')).hexdigest()[:24]}"
                url = f"{settings.UPSTASH_REDIS_REST_URL.rstrip('/')}/pipeline"
                headers = {
                    "Authorization": f"Bearer {settings.UPSTASH_REDIS_REST_TOKEN}",
                    "Content-Type": "application/json"
                }
                pipeline_cmds = [
                    ["INCR", clean_key],
                    ["EXPIRE", clean_key, window_seconds]
                ]
                req = urllib.request.Request(
                    url,
                    data=json.dumps(pipeline_cmds).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                    if isinstance(payload, list) and len(payload) > 0:
                        count = payload[0].get("result", 1)
                        if isinstance(count, int):
                            if count > max_requests:
                                return False, 0
                            return True, max(0, max_requests - count)
            except Exception as e:
                logger.debug(f"[RATELIMIT] Upstash Redis check bypassed/failed: {e}. Falling back to in-memory.")

        return self.in_memory.check_rate_limit(client_key, max_requests, window_seconds)

limiter = DistributedRateLimiter()

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
            log_security_event(
                SecurityEventType.RATE_LIMIT_EXCEEDED,
                {"path": path, "max_requests": max_requests, "window_seconds": window_seconds},
                client_ip=client_id,
                severity="WARNING"
            )
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
