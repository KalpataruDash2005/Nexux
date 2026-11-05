import os
from typing import Generator
import pymysql
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool, QueuePool
from app.core.config import settings
from app.core.logging import logger
from app.models.base import Base

# Ensure pymysql registers as MySQLdb for compatibility with any mysql:// connection string
try:
    pymysql.install_as_MySQLdb()
except Exception:
    pass

def get_engine():
    db_url = settings.effective_database_url
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    elif db_url.startswith("mysql://"):
        db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)
        
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
            pool_pre_ping=settings.DB_POOL_PRE_PING,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=settings.DB_POOL_RECYCLE
        )
    else:
        # PostgreSQL / Supabase
        if os.getenv("VERCEL") == "1" or ":6543" in db_url:
            return create_engine(
                db_url,
                poolclass=NullPool,
                pool_pre_ping=True
            )
        return create_engine(
            db_url,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=settings.DB_POOL_RECYCLE
        )

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initializes tables if they do not exist (especially for SQLite or development)."""
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
