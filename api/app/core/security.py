import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict
import uuid
import jwt
from app.core.config import settings
from app.core.cache import InMemoryLRUCache
from app.core.logging import logger

class TokenBlocklist:
    """Bounded in-memory blocklist for revoked/logged-out JWT tokens."""
    def __init__(self, max_entries: int = 5000, default_ttl: int = 86400):
        self._cache = InMemoryLRUCache(max_entries=max_entries, default_ttl=default_ttl)

    def revoke(self, token_or_jti: str, ttl_seconds: int = 86400):
        self._cache.set(f"revoked:{token_or_jti}", True, ttl_seconds=ttl_seconds)

    def is_revoked(self, token_or_jti: str) -> bool:
        return bool(self._cache.get(f"revoked:{token_or_jti}"))

token_blocklist = TokenBlocklist()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the BCrypt hash matching Spring Boot BCryptPasswordEncoder."""
    try:
        password_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """Generates a BCrypt password hash matching Spring Boot BCryptPasswordEncoder."""
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")

def create_access_token(subject: str, role: Optional[str] = None, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT with subject (email), jti, and optional role:
    claims: { sub: subject, iat: now, exp: now + duration, jti: uuid, role: role }
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(milliseconds=settings.JWT_EXPIRATION_MS)
    
    jti = str(uuid.uuid4())
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "iat": now,
        "exp": expire,
        "jti": jti,
        "type": "access",
    }
    if role:
        to_encode["role"] = str(role).upper()
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    """
    Decodes and validates the JWT, checking expiration, signature, and revocation status.
    Returns the email (subject).
    Raises jwt.PyJWTError on invalid, revoked, or expired token.
    """
    if token_blocklist.is_revoked(token):
        logger.warning("[AUTH] Attempted use of revoked JWT token.")
        raise jwt.PyJWTError("Token has been revoked.")

    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )

    jti = payload.get("jti")
    if jti and token_blocklist.is_revoked(jti):
        logger.warning("[AUTH] Attempted use of revoked JWT jti.")
        raise jwt.PyJWTError("Token has been revoked.")

    subject: Optional[str] = payload.get("sub")
    return subject
