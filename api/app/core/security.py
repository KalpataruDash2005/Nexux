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

def create_access_token(
    subject: str,
    role: Optional[str] = None,
    expires_delta: Optional[timedelta] = None,
    token_version: int = 1
) -> str:
    """
    Creates a signed JWT with subject (email), jti, token_version, and optional role:
    claims: { sub: subject, iat: now, exp: now + duration, jti: uuid, role: role, token_version: token_version }
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
        "token_version": int(token_version or 1),
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

def decode_token_claims(token: str, db: Optional[Any] = None) -> Dict[str, Any]:
    """
    Decodes and validates the JWT, checking expiration, signature, and multi-tier revocation status:
    1. In-memory LRU blocklist (fast-path)
    2. RevokedToken database table (serverless distributed cross-instance path)
    Returns the decoded claims dictionary.
    Raises jwt.PyJWTError on invalid, revoked, or expired token.
    """
    import hashlib

    # 1. Fast in-memory check
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

    # 2. Database persistent check if db session provided
    if db is not None:
        try:
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            from app.models.base import RevokedToken
            revoked_in_db = db.query(RevokedToken).filter(
                (RevokedToken.jti == jti) | (RevokedToken.token_hash == token_hash)
            ).first() if (jti or token_hash) else None

            if revoked_in_db:
                if jti:
                    token_blocklist.revoke(jti)
                token_blocklist.revoke(token)
                logger.warning("[AUTH] Attempted use of database-revoked JWT token.")
                raise jwt.PyJWTError("Token has been revoked.")
        except jwt.PyJWTError:
            raise
        except Exception as e:
            logger.debug(f"[AUTH] Optional db revocation check skipped/failed: {e}")

    return payload

def decode_access_token(token: str, db: Optional[Any] = None) -> Optional[str]:
    """
    Decodes and validates the JWT. Returns the subject (email).
    Maintains backward compatibility with all callers.
    """
    payload = decode_token_claims(token, db=db)
    subject: Optional[str] = payload.get("sub")
    return subject
