from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.base import Job, Application, User, StudentProfile

class JobRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_active_jobs(self, search: Optional[str] = None) -> List[Job]:
        q = self.db.query(Job).filter(Job.status == "ACTIVE")
        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            q = q.filter(
                (Job.title.ilike(s)) |
                (Job.company_name.ilike(s)) |
                (Job.description.ilike(s))
            )
        return q.order_by(Job.created_at.desc()).all()

    def get_by_id(self, job_id: str) -> Optional[Job]:
        return self.db.query(Job).filter(Job.id == job_id).first()

    def create_job(self, job: Job) -> Job:
        self.db.add(job)
        self.db.commit()
        self.db.refresh(job)
        return job

    def get_all_jobs(self) -> List[Job]:
        return self.db.query(Job).order_by(Job.created_at.desc()).all()

    def create_application(self, application: Application) -> Application:
        self.db.add(application)
        self.db.commit()
        self.db.refresh(application)
        return application

    def get_application(self, job_id: str, student_id: str) -> Optional[Application]:
        return self.db.query(Application).filter(
            Application.job_id == job_id,
            Application.student_id == student_id
        ).first()

    def get_applications_by_student(self, student_id: str) -> List[Application]:
        return self.db.query(Application).filter(
            Application.student_id == student_id
        ).order_by(Application.created_at.desc()).all()

    def get_applications_by_job(self, job_id: str) -> List[Application]:
        return self.db.query(Application).filter(
            Application.job_id == job_id
        ).order_by(Application.created_at.desc()).all()

    def get_application_by_id(self, application_id: str) -> Optional[Application]:
        return self.db.query(Application).filter(Application.id == application_id).first()

    def update_application(self, application: Application) -> Application:
        self.db.commit()
        self.db.refresh(application)
        return application
