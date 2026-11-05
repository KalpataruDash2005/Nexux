from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user, get_optional_current_user, get_current_recruiter
from app.models.base import User
from app.services.job_service import JobService
from app.schemas.jobs import (
    JobDto,
    CreateApplicationDto,
    ApplicationDto,
    ApplicationDetailsDto,
    UpdateApplicationStatusDto
)

jobs_router = APIRouter(prefix="/jobs", tags=["Jobs"])
applications_router = APIRouter(prefix="/applications", tags=["Applications"])

# --- Job Endpoints ---
@jobs_router.get("", response_model=List[JobDto])
def get_jobs(
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.get_active_jobs(search)

@jobs_router.post("", status_code=status.HTTP_201_CREATED, response_model=JobDto)
def create_job(
    data: JobDto,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.create_job(current_user, data)

# --- Application Endpoints ---
@applications_router.get("/me", response_model=List[ApplicationDto])
def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.get_my_applications(current_user)

@applications_router.post("", status_code=status.HTTP_201_CREATED, response_model=ApplicationDto)
def apply_for_job(
    data: CreateApplicationDto,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.apply_for_job(current_user, data)

@applications_router.get("/jobs/{jobId}", response_model=List[ApplicationDetailsDto])
def get_applications_for_job(
    jobId: str,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.get_applications_for_job(jobId, current_user)

@applications_router.put("/{id}/status", response_model=ApplicationDetailsDto)
def update_application_status(
    id: str,
    data: UpdateApplicationStatusDto,
    current_user: User = Depends(get_current_recruiter),
    db: Session = Depends(get_db)
):
    service = JobService(db)
    return service.update_application_status(id, data.status, current_user)
