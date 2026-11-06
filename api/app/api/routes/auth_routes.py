from typing import Optional, Dict
from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rate_limiter import rate_limit
from app.api.dependencies import get_current_user, security
from app.models.base import User
from app.services.auth_service import AuthService
from app.schemas.auth import (
    RegisterRequestDto,
    AuthRequestDto,
    AuthResponseDto,
    LogoutResponseDto,
    ChangePasswordRequestDto,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/register",
    status_code=status.HTTP_200_OK,
    response_model=str,
    dependencies=[Depends(rate_limit(max_requests=20, window_seconds=60))]
)
def register(request: RegisterRequestDto, db: Session = Depends(get_db)):
    service = AuthService(db)
    return service.register_user(request)

@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=AuthResponseDto,
    dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))]
)
def login(request: AuthRequestDto, db: Session = Depends(get_db)):
    service = AuthService(db)
    return service.authenticate_user(request)

@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    response_model=LogoutResponseDto,
    dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))]
)
def logout(
    current_user: User = Depends(get_current_user),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    service = AuthService(db)
    if credentials:
        service.logout_user(credentials.credentials)
    return LogoutResponseDto(message="Logged out successfully", status="LOGGED_OUT")

@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    response_model=Dict[str, str],
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
def change_password(
    request: ChangePasswordRequestDto,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = AuthService(db)
    msg = service.change_password(current_user, request.current_password, request.new_password)
    return {"message": msg}
