from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.feedback_service import FeedbackService
from app.schemas.admin import FeedbackRequestDto, NotificationRequestDto

router = APIRouter(tags=["Feedback & Notifications"])

@router.post("/feedback", status_code=status.HTTP_200_OK)
def submit_feedback(data: FeedbackRequestDto, db: Session = Depends(get_db)):
    service = FeedbackService(db)
    service.submit_feedback(data)
    return {"message": "Feedback submitted successfully"}

@router.post("/notifications", status_code=status.HTTP_200_OK)
def send_notification(data: NotificationRequestDto):
    return {"message": "Notification dispatched"}

@router.post("/notifications/pending-work", status_code=status.HTTP_200_OK)
def send_pending_work_reminder():
    return {
        "status": "SENT",
        "message": "Pending work reminders delivered"
    }
