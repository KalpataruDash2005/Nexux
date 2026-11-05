from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.base import User
from app.services.profile_service import ProfileService
from app.schemas.profile import StudentProfileDto

router = APIRouter(prefix="/students", tags=["Students"])

@router.get("/me", response_model=StudentProfileDto)
def get_my_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = ProfileService(db)
    return service.get_profile(current_user)

@router.put("/me", response_model=StudentProfileDto)
def update_my_profile(data: StudentProfileDto, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    service = ProfileService(db)
    return service.update_profile(current_user, data)
