import hashlib
from datetime import datetime, timezone
import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.core.audit import log_security_event, SecurityEventType
from app.repositories.user_repository import UserRepository, StudentProfileRepository
from app.models.base import User, StudentProfile, RevokedToken
from app.core.security import get_password_hash, verify_password, create_access_token, token_blocklist
from app.schemas.auth import RegisterRequestDto, AuthRequestDto, AuthResponseDto
from app.core.logging import logger

class AuthService:
    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.profile_repo = StudentProfileRepository(db)

    def register_user(self, request: RegisterRequestDto) -> str:
        clean_email = request.email.lower().strip()
        if self.user_repo.exists_by_email(clean_email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already in use!"
            )

        requested_role = (request.role or "STUDENT").upper()
        if requested_role not in ("STUDENT", "RECRUITER"):
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

        return "User registered successfully"

    def authenticate_user(self, request: AuthRequestDto) -> AuthResponseDto:
        clean_email = request.email.lower().strip()
        user = self.user_repo.get_by_email(clean_email)
        if not user or not verify_password(request.password, user.password_hash):
            log_security_event(SecurityEventType.AUTH_LOGIN_FAILURE, {"attempted_email": clean_email}, severity="WARNING")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        token = create_access_token(subject=user.email, role=user.role, token_version=getattr(user, "token_version", 1) or 1)

        # Resolve student name if student
        name = None
        if user.role == "STUDENT":
            profile = self.profile_repo.get_by_user_id(user.id)
            if profile and profile.first_name:
                if profile.last_name:
                    name = f"{profile.first_name} {profile.last_name}"
                else:
                    name = profile.first_name

        log_security_event(SecurityEventType.AUTH_LOGIN_SUCCESS, {"email": user.email, "role": user.role}, user_id=str(user.id), severity="INFO")
        return AuthResponseDto(
            token=token,
            type="Bearer",
            email=user.email,
            role=user.role,
            name=name
        )

    def logout_user(self, token: str) -> None:
        """
        Revokes token and its JTI across both in-memory cache and persistent database storage.
        Ensures revocation is respected across distributed Vercel serverless instances.
        """
        if not token:
            return

        token_blocklist.revoke(token)
        try:
            unverified_claims = jwt.decode(token, options={"verify_signature": False})
            jti = unverified_claims.get("jti")
            exp = unverified_claims.get("exp")
            exp_dt = datetime.fromtimestamp(exp, tz=timezone.utc).replace(tzinfo=None) if exp else None
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

            if jti:
                token_blocklist.revoke(jti)

            if self.db is not None:
                existing = self.db.query(RevokedToken).filter(
                    (RevokedToken.jti == (jti or token_hash[:64])) | (RevokedToken.token_hash == token_hash)
                ).first()
                if not existing:
                    revoked_entry = RevokedToken(
                        jti=jti or token_hash[:64],
                        token_hash=token_hash,
                        expires_at=exp_dt
                    )
                    self.db.add(revoked_entry)
                    self.db.commit()
        except Exception as e:
            logger.warning(f"[AUTH] Could not persist revoked token to database: {e}")

        logger.info("[AUTH] User logged out and token invalidated persistently.")
        log_security_event(SecurityEventType.AUTH_LOGOUT, {"status": "SUCCESS"}, severity="INFO")

    def change_password(self, user: User, current_password: str, new_password: str) -> str:
        """
        Securely changes password, increments token_version to invalidate all existing sessions
        across all serverless instances, and updates the password hash.
        """
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        if current_password == new_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as the current password"
            )

        # Increment token_version to invalidate prior JWTs across all nodes
        user.token_version = (getattr(user, "token_version", 1) or 1) + 1
        user.password_hash = get_password_hash(new_password)
        self.user_repo.update(user)
        logger.info(f"[AUTH] Password updated and sessions invalidated for user {user.id} (new token_version: {user.token_version})")
        log_security_event(
            SecurityEventType.AUTH_PASSWORD_CHANGE,
            {"user_id": str(user.id), "token_version": user.token_version},
            user_id=str(user.id),
            severity="INFO"
        )
        return "Password updated successfully"
