import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool
from app.core.config import settings
from app.core.logging import logger
from app.models.base import Base

try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

def get_engine():
    import urllib.parse
    db_url = (settings.effective_database_url or "").strip()

    # Automatically normalize scheme
    if db_url.startswith("postgres://"):
        db_url = "postgresql://" + db_url[len("postgres://"):]

    # Auto-encode passwords containing special characters (like '@') safely
    if "://" in db_url and "@" in db_url:
        scheme, rest = db_url.split("://", 1)
        if ":" in rest and "@" in rest:
            user_part, rest2 = rest.split(":", 1)
            password_part, host_part = rest2.rsplit("@", 1)
            unquoted = urllib.parse.unquote_plus(password_part)
            encoded_pw = urllib.parse.quote_plus(unquoted)
            db_url = f"{scheme}://{user_part}:{encoded_pw}@{host_part}"

    if db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
        db_url = "postgresql+psycopg2://" + db_url[len("postgresql://"):]
    elif db_url.startswith("mysql://") and not db_url.startswith("mysql+"):
        db_url = "mysql+pymysql://" + db_url[len("mysql://"):]
        
    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        return create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=True
        )
    elif "mysql" in db_url:
        connect_args["charset"] = "utf8mb4"
        return create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=False,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=settings.DB_POOL_RECYCLE
        )
    else:
        # PostgreSQL / Supabase
        connect_args = {"sslmode": "require", "connect_timeout": 5}
        # In serverless environments, warm execution containers handle consecutive requests.
        # QueuePool with larger overflow avoids connection queue starvation during concurrent page bursts.
        # pool_pre_ping=False eliminates the sequential 'SELECT 1;' network ping before every query.
        return create_engine(
            db_url,
            connect_args=connect_args,
            pool_pre_ping=False,
            pool_size=10,
            max_overflow=20,
            pool_timeout=5,
            pool_recycle=300
        )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes tables if they do not exist (only for SQLite or development)."""
    db_url = (settings.effective_database_url or "").strip()
    # In production on Vercel or PostgreSQL, tables are pre-provisioned.
    # Never block cold start with multi-second metadata.create_all reflection queries over WAN.
    if os.getenv("VERCEL") == "1" or "postgresql" in db_url or "postgres" in db_url:
        logger.info("Production database detected; skipping create_all() to ensure sub-millisecond cold starts.")
        return
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.error(f"Error initializing database tables: {e}")

def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency for obtaining a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
