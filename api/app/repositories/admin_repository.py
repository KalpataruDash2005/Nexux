from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.base import FeedbackSubmission, AptitudeSet, AptitudeQuestion

class AdminRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_feedback(self, feedback: FeedbackSubmission) -> FeedbackSubmission:
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

    def get_all_feedback(self) -> List[FeedbackSubmission]:
        return self.db.query(FeedbackSubmission).order_by(FeedbackSubmission.created_at.desc()).all()

    def get_feedback_by_id(self, feedback_id: str) -> Optional[FeedbackSubmission]:
        return self.db.query(FeedbackSubmission).filter(FeedbackSubmission.id == feedback_id).first()

    def update_feedback(self, feedback: FeedbackSubmission) -> FeedbackSubmission:
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

    def delete_feedback(self, feedback: FeedbackSubmission):
        self.db.delete(feedback)
        self.db.commit()

    def create_aptitude_set(self, aset: AptitudeSet) -> AptitudeSet:
        self.db.add(aset)
        self.db.commit()
        self.db.refresh(aset)
        return aset

    def get_all_aptitude_sets(self) -> List[AptitudeSet]:
        return self.db.query(AptitudeSet).order_by(AptitudeSet.created_at.desc()).all()

    def get_aptitude_set_by_id(self, set_id: str) -> Optional[AptitudeSet]:
        return self.db.query(AptitudeSet).filter(AptitudeSet.id == set_id).first()

    def delete_aptitude_set(self, aset: AptitudeSet):
        self.db.delete(aset)
        self.db.commit()

    def create_aptitude_question(self, question: AptitudeQuestion) -> AptitudeQuestion:
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        return question

    def get_questions_by_set(self, set_id: str) -> List[AptitudeQuestion]:
        return self.db.query(AptitudeQuestion).filter(
            AptitudeQuestion.set_id == set_id
        ).order_by(AptitudeQuestion.created_at.asc()).all()
