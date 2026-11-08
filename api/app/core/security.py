import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Any
import jwt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the BCrypt hash matching Spring Boot BCryptPasswordEncoder."""
    try:
        password_bytes = plain_password.encode("utf-8")[:72]
        hash_bytes = hashed_password.encode("utf-8")
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    """
    Generates a BCrypt password hash matching Spring Boot BCryptPasswordEncoder.
    Optimized to rounds=10 for fast, responsive interactive logins while maintaining OWASP standard security.
    """
    password_bytes = password.encode("utf-8")[:72]
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a signed JWT with subject (email) matching Spring Boot JwtUtil:
    claims: { sub: subject, iat: now, exp: now + duration }
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(milliseconds=settings.JWT_EXPIRATION_MS)
    
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "iat": datetime.utcnow(),
        "exp": expire,
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    """
    Decodes and validates the JWT, returning the email (subject).
    Raises jwt.PyJWTError on invalid or expired token.
    """
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )
    subject: Optional[str] = payload.get("sub")
    return subject
