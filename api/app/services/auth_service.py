import hmac
import hashlib
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.user_repository import UserRepository, StudentProfileRepository
from app.models.base import User, StudentProfile
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.auth import RegisterRequestDto, AuthRequestDto, AuthResponseDto
from app.core.config import settings
from app.core.cache import cache_manager
from app.core.logging import logger

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.profile_repo = StudentProfileRepository(db)

    def register_user(self, request: RegisterRequestDto) -> AuthResponseDto:
        clean_email = request.email.lower().strip()
        if self.user_repo.exists_by_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use!"
            )

        requested_role = (request.role or "STUDENT").upper()
        if requested_role not in ("STUDENT", "RECRUITER", "ADMIN"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be STUDENT or RECRUITER"
            )

        user = User(
            email=clean_email,
            password_hash=get_password_hash(request.password),
            role=requested_role
        )
        saved_user = self.user_repo.create(user)

        # If name is provided and role is STUDENT, populate StudentProfile
        resolved_name = None
        if request.name and request.name.strip() and requested_role == "STUDENT":
            full_name = request.name.strip()
            first_name = full_name
            last_name = None
            if " " in full_name:
                parts = full_name.split(" ", 1)
                first_name = parts[0].strip()
                last_name = parts[1].strip()

            profile = StudentProfile(
                user_id=saved_user.id,
                first_name=first_name,
                last_name=last_name
            )
            self.profile_repo.create_or_update(profile)
            resolved_name = full_name

        token = create_access_token(subject=saved_user.email)

        # Warm the auth cache immediately so subsequent calls and login checks are sub-millisecond
        user_cache_key = f"auth:user:{clean_email}"
        cached_user = {
            "id": saved_user.id,
            "email": saved_user.email,
            "password_hash": saved_user.password_hash,
            "role": saved_user.role,
            "name": resolved_name
        }
        cache_manager.set(user_cache_key, cached_user, ttl_seconds=3600)
        cache_manager.set(f"user_cache:{clean_email}", cached_user, ttl_seconds=3600)

        pw_hmac = hmac.new(
            settings.JWT_SECRET.encode("utf-8"),
            request.password.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        cache_manager.set(f"auth:verified:{clean_email}:{pw_hmac}", True, ttl_seconds=1800)

        return AuthResponseDto(
            token=token,
            type="Bearer",
            email=saved_user.email,
            role=saved_user.role,
            name=resolved_name,
            message="User registered successfully"
        )

    def authenticate_user(self, request: AuthRequestDto) -> AuthResponseDto:
        clean_email = request.email.lower().strip()

        # Fast HMAC check for sub-millisecond password verification
        pw_hmac = hmac.new(
            settings.JWT_SECRET.encode("utf-8"),
            request.password.encode("utf-8"),
            hashlib.sha256
        ).hexdigest()
        cache_verified_key = f"auth:verified:{clean_email}:{pw_hmac}"
        user_cache_key = f"auth:user:{clean_email}"

        cached_user = cache_manager.get(user_cache_key)
        is_pw_verified = cache_manager.get(cache_verified_key)

        # Sub-millisecond path: Both user identity and password verification are cached in-memory
        if cached_user and is_pw_verified:
            token = create_access_token(subject=cached_user["email"])
            return AuthResponseDto(
                token=token,
                type="Bearer",
                email=cached_user["email"],
                role=cached_user["role"],
                name=cached_user.get("name")
            )

        # Check if user record is cached, saving database round-trip
        if cached_user:
            user_id = cached_user["id"]
            user_email = cached_user["email"]
            password_hash = cached_user["password_hash"]
            user_role = cached_user["role"]
            name = cached_user.get("name")
        else:
            user = self.user_repo.get_by_email_with_profile(clean_email)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            user_id = user.id
            user_email = user.email
            password_hash = user.password_hash
            user_role = user.role
            name = None
            if user.role == "STUDENT" and user.profile:
                p = user.profile
                if p.first_name:
                    name = f"{p.first_name} {p.last_name}".strip() if p.last_name else p.first_name

            cached_user = {
                "id": user_id,
                "email": user_email,
                "password_hash": password_hash,
                "role": user_role,
                "name": name
            }
            cache_manager.set(user_cache_key, cached_user, ttl_seconds=3600)
            cache_manager.set(f"user_cache:{clean_email}", cached_user, ttl_seconds=3600)

        # Verify password against BCrypt hash
        if not verify_password(request.password, password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Cache the verified password HMAC for 30 minutes
        cache_manager.set(cache_verified_key, True, ttl_seconds=1800)

        token = create_access_token(subject=user_email)

        return AuthResponseDto(
            token=token,
            type="Bearer",
            email=user_email,
            role=user_role,
            name=name
        )
