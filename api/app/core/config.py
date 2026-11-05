import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    # App Information
    APP_NAME: str = "CareerOS Backend"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    
    # Database & Connection Pooling (MySQL / PostgreSQL / SQLite)
    DATABASE_URL: str = Field(
        default="mysql+pymysql://careeros_user:careeros_pass@localhost:3307/careeros_db?charset=utf8mb4",
        description="Database Connection URL (MySQL / PostgreSQL / SQLite)"
    )
    MYSQL_HOST: Optional[str] = None
    MYSQL_PORT: Optional[int] = 3307
    MYSQL_USER: Optional[str] = None
    MYSQL_PASSWORD: Optional[str] = None
    MYSQL_DATABASE: Optional[str] = None

    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE: int = 300

    @property
    def effective_database_url(self) -> str:
        """Returns the active database URL, auto-constructing from discrete MYSQL_* env vars if provided."""
        if self.MYSQL_HOST and self.MYSQL_DATABASE:
            from urllib.parse import quote_plus
            user = quote_plus(self.MYSQL_USER or "careeros_user")
            password = quote_plus(self.MYSQL_PASSWORD or "careeros_pass")
            port = self.MYSQL_PORT or 3307
            db = self.MYSQL_DATABASE
            return f"mysql+pymysql://{user}:{password}@{self.MYSQL_HOST}:{port}/{db}?charset=utf8mb4"
        return self.DATABASE_URL
    
    # Upload Limits (4.5 MB Vercel Serverless payload ceiling)
    MAX_UPLOAD_SIZE_BYTES: int = 4_718_592  # 4.5 MB

    # Bounded Cache Configuration
    CACHE_MAX_ENTRIES: int = 200
    CACHE_DEFAULT_TTL_SECONDS: int = 3600

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 60
    
    # Authentication & JWT
    JWT_SECRET: str = Field(
        default="careeros-super-secret-jwt-key-with-at-least-256-bits-length-for-security-purposes!",
        description="JWT Secret for HMAC-SHA256"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MS: int = 86400000  # 24 hours
    
    # CORS
    CORS_ALLOWED_ORIGINS: str = Field(
        default="http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173",
        description="Comma-separated allowed origins"
    )
    
    @property
    def cors_origins_list(self) -> List[str]:
        if not self.CORS_ALLOWED_ORIGINS or self.CORS_ALLOWED_ORIGINS.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]

    # Qdrant Vector Store
    QDRANT_HOST: Optional[str] = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_URL: Optional[str] = None
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION: str = "careeros_pdf_chunks"
    QDRANT_USE_TLS: bool = False
    EMBEDDING_DIMENSION: int = 384
    
    # xAI Grok Provider & Workload Model Routing
    XAI_API_BASE_URL: str = Field(
        default="https://api.x.ai/v1",
        description="xAI API Base URL"
    )

    # Shared default API key (reused across workloads if workload-specific key is omitted)
    XAI_API_KEY: Optional[str] = None

    # Workload-Specific API Keys
    XAI_API_KEY_PDF: Optional[str] = None
    XAI_API_KEY_CHAT: Optional[str] = None
    XAI_API_KEY_RESUME: Optional[str] = None
    XAI_API_KEY_ASSESSMENT: Optional[str] = None
    XAI_API_KEY_GENERAL: Optional[str] = None

    # Backup / Secondary API Keys (for bounded key failover on rate limit)
    XAI_BACKUP_API_KEY: Optional[str] = None
    XAI_BACKUP_API_KEY_PDF: Optional[str] = None
    XAI_BACKUP_API_KEY_CHAT: Optional[str] = None
    XAI_BACKUP_API_KEY_RESUME: Optional[str] = None
    XAI_BACKUP_API_KEY_ASSESSMENT: Optional[str] = None
    XAI_BACKUP_API_KEY_GENERAL: Optional[str] = None

    # Workload Model Routing IDs
    XAI_DEFAULT_MODEL: str = "grok-2-mini"
    XAI_MODEL_PDF: str = "grok-2-1212"
    XAI_MODEL_CHAT: str = "grok-2-mini"
    XAI_MODEL_RESUME: str = "grok-2-1212"
    XAI_MODEL_ASSESSMENT: str = "grok-2-1212"
    XAI_MODEL_GENERAL: str = "grok-2-mini"

    # Workload-Specific Fallback Models (Grok-only)
    XAI_FALLBACK_MODEL: Optional[str] = "grok-beta"
    XAI_FALLBACK_MODEL_PDF: Optional[str] = None
    XAI_FALLBACK_MODEL_CHAT: Optional[str] = None
    XAI_FALLBACK_MODEL_RESUME: Optional[str] = None
    XAI_FALLBACK_MODEL_ASSESSMENT: Optional[str] = None
    XAI_FALLBACK_MODEL_GENERAL: Optional[str] = None

    # Bounded Retry Policy & Limits
    XAI_MAX_RETRIES: int = 2
    XAI_TIMEOUT_SECONDS: float = 30.0
    
    # RAG Tuning Parameters
    RAG_CHUNK_SIZE: int = 1200
    RAG_CHUNK_OVERLAP: int = 150
    RAG_TOP_K: int = 5
    RAG_MIN_SCORE: float = 0.30
    
    # Admin Credentials
    CAREEROS_ADMIN_EMAIL: str = "admin@nexora.app"
    CAREEROS_ADMIN_PASSWORD: Optional[str] = "Admin@12345"

    # Supabase Object Storage (for persistent PDF storage in serverless)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_STORAGE_BUCKET: str = "documents"

    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "ignore"

settings = Settings()
