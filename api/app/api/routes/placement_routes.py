from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.base import User
from app.services.placement_service import PlacementService
from app.schemas.placement import (
    ResumeResponse,
    ResumeListItem,
    DashboardData,
    PlacementSessionDto,
    CreateSessionBody,
    StartSessionResponse,
    SendMessageRequest,
    MessageResponse,
    EndSessionResponse,
    SessionDetail,
    CodingSessionResponse,
    CreateCodingBody,
    CodingSubmitResponse,
    SubmitCodingBody,
    RunCodingBody,
    CodingRunResponse,
    SubmissionHistoryItem,
    AptitudeTestResponse,
    CreateAptitudeBody,
    SubmitAptitudeBody,
    AptitudeSubmitResponse,
    AnalyticsData,
    ReadinessData,
    RoadmapData,
    PlacementResetResponse
)

router = APIRouter(prefix="/placement", tags=["Placement & Careers"])

@router.post("/resume/analyze", response_model=ResumeResponse)
async def analyze_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.analyze_resume(current_user, file)

@router.get("/resume/latest", response_model=ResumeResponse)
def get_latest_resume(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_latest_resume(current_user)

@router.get("/resumes", response_model=List[ResumeListItem])
def get_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_resumes(current_user)

@router.get("/dashboard", response_model=DashboardData)
def get_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_dashboard(current_user)

@router.get("/analytics", response_model=AnalyticsData)
def get_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_analytics(current_user)

@router.get("/readiness", response_model=ReadinessData)
async def get_readiness(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.get_readiness(current_user)

@router.get("/roadmap", response_model=RoadmapData)
async def get_roadmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.get_roadmap(current_user)

@router.post("/sessions", response_model=PlacementSessionDto)
def create_session(
    body: CreateSessionBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.create_session(current_user, body)

@router.get("/sessions", response_model=List[PlacementSessionDto])
def get_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_sessions(current_user)

@router.get("/sessions/{id}", response_model=SessionDetail)
def get_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_session(id, current_user)

@router.post("/sessions/{id}/start", response_model=StartSessionResponse)
async def start_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.start_session(id, current_user)

@router.post("/sessions/{id}/messages", response_model=MessageResponse)
async def send_message(
    id: str,
    body: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.send_message(id, current_user, body.content)

@router.post("/sessions/{id}/end", response_model=EndSessionResponse)
def end_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.end_session(id, current_user)

@router.delete("/sessions/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    service.delete_session(id, current_user)
    return None

@router.delete("/reset", response_model=PlacementResetResponse)
def reset_placement(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.reset_placement(current_user)

@router.post("/coding", response_model=CodingSessionResponse)
async def create_coding(
    body: CreateCodingBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.create_coding_session(current_user, body)

@router.post("/coding/{id}/run", response_model=CodingRunResponse)
async def run_coding(
    id: str,
    body: RunCodingBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.run_coding(id, current_user, body)

@router.post("/coding/{id}/submit", response_model=CodingSubmitResponse)
async def submit_coding(
    id: str,
    body: SubmitCodingBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.submit_coding(id, current_user, body)

@router.get("/coding/{id}/submissions", response_model=List[SubmissionHistoryItem])
def get_coding_submissions(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.get_coding_submissions(id, current_user)

@router.post("/aptitude", response_model=AptitudeTestResponse)
async def create_aptitude(
    body: CreateAptitudeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return await service.create_aptitude_test(current_user, body)

@router.post("/aptitude/{id}/submit", response_model=AptitudeSubmitResponse)
def submit_aptitude(
    id: str,
    body: SubmitAptitudeBody,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    return service.submit_aptitude(id, current_user, body)
