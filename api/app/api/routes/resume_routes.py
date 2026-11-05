from fastapi import APIRouter, Depends, UploadFile, File
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.base import User
from app.services.placement_service import PlacementService

router = APIRouter(prefix="/resume", tags=["Resume Legacy"])

@router.post("/upload")
async def upload_resume_legacy(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PlacementService(db)
    res = await service.analyze_resume(current_user, file)
    return f"Resume processed successfully: {res.fileName}"
