from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rate_limiter import rate_limit
from app.services.auth_service import AuthService
from app.schemas.auth import RegisterRequestDto, AuthRequestDto, AuthResponseDto

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post(
    "/register",
    status_code=status.HTTP_200_OK,
    response_model=AuthResponseDto,
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
