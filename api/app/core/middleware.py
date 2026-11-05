import time
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from app.core.logging import logger

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Assigns or preserves a unique X-Request-ID correlation identifier for every HTTP request.
    Attaches the correlation ID to request state, response headers, and measures request duration.
    """
    async def dispatch(self, request: Request, call_next) -> Response:
        # Respect upstream gateway/client correlation ID if present, otherwise generate one
        correlation_id = request.headers.get("X-Request-ID")
        if not correlation_id:
            correlation_id = f"req_{uuid.uuid4().hex[:12]}"

        request.state.correlation_id = correlation_id

        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"

        # Suppress logging for high-frequency internal health checks
        is_health = request.url.path in ("/health", "/api/v1/health")
        if not is_health:
            logger.info(f"--> [{correlation_id}] {request.method} {request.url.path} from {client_ip}")

        try:
            response: Response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            response.headers["X-Request-ID"] = correlation_id
            response.headers["X-Response-Time"] = f"{duration_ms:.1f}ms"

            if not is_health:
                logger.info(f"<-- [{correlation_id}] {request.method} {request.url.path} | {response.status_code} | {duration_ms:.1f}ms")

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"<-- [{correlation_id}] {request.method} {request.url.path} FAILED: {e} after {duration_ms:.1f}ms")
            raise
