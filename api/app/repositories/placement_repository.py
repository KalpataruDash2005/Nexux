from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.base import (
    PlacementResume,
    PlacementResumeAnalysis,
    PlacementSession,
    PlacementMessage
)

class PlacementRepository:
    def __init__(self, db: Session):
        self.db = db

    def create_resume(self, resume: PlacementResume) -> PlacementResume:
        self.db.add(resume)
        self.db.commit()
        self.db.refresh(resume)
        return resume

    def get_latest_resume(self, owner_id: str) -> Optional[PlacementResume]:
        return self.db.query(PlacementResume).filter(
            PlacementResume.owner_id == owner_id
        ).order_by(PlacementResume.created_at.desc()).first()

    def get_resume_by_id(self, resume_id: str, owner_id: str) -> Optional[PlacementResume]:
        return self.db.query(PlacementResume).filter(
            PlacementResume.id == resume_id,
            PlacementResume.owner_id == owner_id
        ).first()

    def get_all_resumes(self, owner_id: str) -> List[PlacementResume]:
        return self.db.query(PlacementResume).filter(
            PlacementResume.owner_id == owner_id
        ).order_by(PlacementResume.created_at.desc()).all()

    def create_analysis(self, analysis: PlacementResumeAnalysis) -> PlacementResumeAnalysis:
        self.db.add(analysis)
        self.db.commit()
        self.db.refresh(analysis)
        return analysis

    def get_analysis_by_resume_id(self, resume_id: str) -> Optional[PlacementResumeAnalysis]:
        return self.db.query(PlacementResumeAnalysis).filter(
            PlacementResumeAnalysis.resume_id == resume_id
        ).first()

    def create_session(self, session: PlacementSession) -> PlacementSession:
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)
        return session

    def get_sessions(self, owner_id: str) -> List[PlacementSession]:
        return self.db.query(PlacementSession).filter(
            PlacementSession.owner_id == owner_id
        ).order_by(PlacementSession.created_at.desc()).all()

    def get_session_by_id(self, session_id: str, owner_id: str) -> Optional[PlacementSession]:
        return self.db.query(PlacementSession).filter(
            PlacementSession.id == session_id,
            PlacementSession.owner_id == owner_id
        ).first()

    def update_session(self, session: PlacementSession) -> PlacementSession:
        self.db.commit()
        self.db.refresh(session)
        return session

    def delete_session(self, session: PlacementSession):
        self.db.delete(session)
        self.db.commit()

    def save_message(self, message: PlacementMessage) -> PlacementMessage:
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_messages(self, session_id: str) -> List[PlacementMessage]:
        return self.db.query(PlacementMessage).filter(
            PlacementMessage.session_id == session_id
        ).order_by(PlacementMessage.created_at.asc()).all()

    def reset_placement(self, owner_id: str) -> tuple[int, int]:
        del_sessions = self.db.query(PlacementSession).filter(PlacementSession.owner_id == owner_id).delete()
        del_resumes = self.db.query(PlacementResume).filter(PlacementResume.owner_id == owner_id).delete()
        self.db.commit()
        return del_sessions, del_resumes
