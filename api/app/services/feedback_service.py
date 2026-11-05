from sqlalchemy.orm import Session
from app.repositories.admin_repository import AdminRepository
from app.models.base import FeedbackSubmission
from app.schemas.admin import FeedbackRequestDto

class FeedbackService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AdminRepository(db)

    def submit_feedback(self, data: FeedbackRequestDto) -> FeedbackSubmission:
        feedback = FeedbackSubmission(
            name=data.name.strip() if data.name else None,
            email=data.email.strip(),
            message=data.message.strip(),
            status="NEW"
        )
        return self.repo.create_feedback(feedback)
