from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_admin
from app.models.base import User
from app.services.admin_service import AdminService
from app.schemas.admin import (
    UserAdminDto,
    FeedbackAdminDto,
    UpdateFeedbackStatusDto,
    AptitudeSetDto,
    AptitudeQuestionDto
)
from app.schemas.jobs import JobDto

router = APIRouter(prefix="/admin", tags=["Admin"])

@router.get("/users", response_model=List[UserAdminDto])
def get_all_users(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return service.get_all_users()

@router.get("/jobs", response_model=List[JobDto])
def get_all_jobs(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return service.get_all_jobs()

@router.get("/feedback", response_model=List[FeedbackAdminDto])
def get_all_feedback(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return service.get_all_feedback()

@router.patch("/feedback/{id}/status")
def update_feedback_status(
    id: str,
    data: UpdateFeedbackStatusDto,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    service.update_feedback_status(id, data.status)
    return {"updated": True}

@router.delete("/feedback/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feedback(
    id: str,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    service.delete_feedback(id)
    return None

@router.post("/aptitude/sets", response_model=AptitudeSetDto)
async def upload_aptitude_set(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return await service.upload_aptitude_set(file, title, current_admin)

@router.get("/aptitude/sets", response_model=List[AptitudeSetDto])
def get_aptitude_sets(
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return service.get_aptitude_sets()

@router.get("/aptitude/sets/{setId}/questions", response_model=List[AptitudeQuestionDto])
def get_aptitude_set_questions(
    setId: str,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    return service.get_questions_for_set(setId)

@router.delete("/aptitude/sets/{setId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_aptitude_set(
    setId: str,
    current_admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    service = AdminService(db)
    service.delete_aptitude_set(setId)
    return None
