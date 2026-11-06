from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.core.database import init_db, SessionLocal
from app.core.middleware import CorrelationIdMiddleware
from app.core.error_handler import sanitize_error_detail
from app.models.base import User
from app.core.security import get_password_hash

# Routes
from app.api.routes.health_routes import router as health_router
from app.api.routes.auth_routes import router as auth_router
from app.api.routes.student_routes import router as student_router
from app.api.routes.workspace_routes import router as workspace_router
from app.api.routes.pdf_assistant_routes import router as pdf_assistant_router
from app.api.routes.task_routes import router as task_router
from app.api.routes.placement_routes import router as placement_router
from app.api.routes.job_routes import jobs_router, applications_router
from app.api.routes.admin_routes import router as admin_router
from app.api.routes.feedback_routes import router as feedback_router
from app.api.routes.resume_routes import router as resume_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info(f"Starting {settings.APP_NAME}...")
    settings.validate_security()
    init_db()

    # Seed Admin User only if explicitly configured with complex credentials
    if settings.CAREEROS_ADMIN_EMAIL and settings.CAREEROS_ADMIN_PASSWORD:
        db = SessionLocal()
        try:
            admin_email = settings.CAREEROS_ADMIN_EMAIL.lower().strip()
            existing_admin = db.query(User).filter(User.email == admin_email).first()
            if not existing_admin:
                pwd = settings.CAREEROS_ADMIN_PASSWORD
                if len(pwd) >= 12:
                    admin_user = User(
                        email=admin_email,
                        password_hash=get_password_hash(pwd),
                        role="ADMIN"
                    )
                    db.add(admin_user)
                    db.commit()
                    logger.info(f"Seeded initial admin user: {admin_email}")
                else:
                    logger.warning("Admin seeding skipped: CAREEROS_ADMIN_PASSWORD must be at least 12 characters.")
        except Exception as e:
            logger.warning(f"Admin seeding skipped: {e}")
        finally:
            db.close()

    yield
    # Shutdown
    logger.info(f"Shutting down {settings.APP_NAME}...")

app = FastAPI(
    title=settings.APP_NAME,
    description="CareerOS Unified FastAPI Backend for Vercel Deployment",
    version="1.0.0",
    lifespan=lifespan
)

# 1. Observability Middlewares
app.add_middleware(CorrelationIdMiddleware)

# 2. Defense-in-Depth HTTP Security Headers Middleware
@app.middleware("http")
async def add_security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response

# 3. Strict CORS Middleware
origins = settings.cors_origins_list
# Regex strictly limits Vercel preview URLs to our specific projects rather than arbitrary *.vercel.app subdomains
strict_preview_regex = r"^https:\/\/(.*\.)?(nexoraos\.space|nexora\.space)$|^https:\/\/(frontend|nexux)[a-zA-Z0-9\-]*\.vercel\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_origin_regex=None if origins == ["*"] else strict_preview_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Exception handlers ensuring sanitized, standardized { "message": "...", "detail": "...", "requestId": "..." } format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    correlation_id = getattr(request.state, "correlation_id", None)
    safe_detail = sanitize_error_detail(
        exc.detail,
        request_id=correlation_id,
        status_code=exc.status_code,
        path=request.url.path
    )
    content = {
        "message": safe_detail,
        "detail": safe_detail,
        "status": exc.status_code,
    }
    if correlation_id:
        content["requestId"] = correlation_id
    return JSONResponse(
        status_code=exc.status_code,
        content=content,
        headers=exc.headers
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = jsonable_encoder(exc.errors())
    first_msg = errors[0].get("msg") if errors else "Validation error"
    field = errors[0].get("loc", [])[-1] if errors else ""
    detail = f"{field}: {first_msg}" if field else first_msg
    correlation_id = getattr(request.state, "correlation_id", None)
    content = {
        "message": detail,
        "detail": errors,
        "status": status.HTTP_422_UNPROCESSABLE_ENTITY
    }
    if correlation_id:
        content["requestId"] = correlation_id
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=content
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    correlation_id = getattr(request.state, "correlation_id", None)
    logger.error(f"[SERVER-ERROR] Unhandled error [req={correlation_id}]: {exc}", exc_info=True)
    safe_message = sanitize_error_detail(
        str(exc),
        request_id=correlation_id,
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        path=request.url.path
    )
    content = {
        "message": safe_message,
        "detail": safe_message,
        "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
    }
    if correlation_id:
        content["requestId"] = correlation_id
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=content
    )

# Top-level Health Endpoints
app.include_router(health_router)

# Mount Routers under /api/v1 Prefix
api_v1 = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=api_v1)
app.include_router(student_router, prefix=api_v1)
app.include_router(workspace_router, prefix=api_v1)
app.include_router(pdf_assistant_router, prefix=api_v1)
app.include_router(task_router, prefix=api_v1)
app.include_router(placement_router, prefix=api_v1)
app.include_router(jobs_router, prefix=api_v1)
app.include_router(applications_router, prefix=api_v1)
app.include_router(admin_router, prefix=api_v1)
app.include_router(feedback_router, prefix=api_v1)

# Legacy Resume Router
app.include_router(resume_router, prefix="/api")

# Also include health check under /api/v1/health for frontend health service
app.include_router(health_router, prefix=api_v1)
