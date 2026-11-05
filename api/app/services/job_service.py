from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.job_repository import JobRepository
from app.repositories.user_repository import UserRepository, StudentProfileRepository
from app.models.base import Job, Application, User
from app.schemas.jobs import (
    JobDto,
    CreateApplicationDto,
    ApplicationDto,
    ApplicationDetailsDto,
    UpdateApplicationStatusDto
)

class JobService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = JobRepository(db)
        self.user_repo = UserRepository(db)
        self.profile_repo = StudentProfileRepository(db)

    def get_active_jobs(self, search: Optional[str] = None) -> List[JobDto]:
        jobs = self.repo.get_active_jobs(search)
        return [
            JobDto(
                id=j.id,
                postedById=j.posted_by_id,
                title=j.title,
                companyName=j.company_name,
                description=j.description,
                location=j.location,
                salary=j.salary,
                status=j.status,
                createdAt=j.created_at
            )
            for j in jobs
        ]

    def create_job(self, user: User, data: JobDto) -> JobDto:
        job = Job(
            posted_by_id=user.id,
            title=data.title.strip(),
            company_name=data.companyName.strip(),
            description=data.description.strip(),
            location=data.location.strip() if data.location else None,
            salary=data.salary.strip() if data.salary else None,
            status=data.status or "ACTIVE"
        )
        saved = self.repo.create_job(job)
        return JobDto(
            id=saved.id,
            postedById=saved.posted_by_id,
            title=saved.title,
            companyName=saved.company_name,
            description=saved.description,
            location=saved.location,
            salary=saved.salary,
            status=saved.status,
            createdAt=saved.created_at
        )

    def apply_for_job(self, user: User, data: CreateApplicationDto) -> ApplicationDto:
        job = self.repo.get_by_id(data.jobId)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        existing = self.repo.get_application(data.jobId, user.id)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already applied to this job")

        app = Application(
            job_id=job.id,
            student_id=user.id,
            status="APPLIED"
        )
        saved = self.repo.create_application(app)
        return ApplicationDto(
            id=saved.id,
            jobId=saved.job_id,
            studentId=saved.student_id,
            status=saved.status,
            createdAt=saved.created_at
        )

    def get_my_applications(self, user: User) -> List[ApplicationDto]:
        apps = self.repo.get_applications_by_student(user.id)
        return [
            ApplicationDto(
                id=a.id,
                jobId=a.job_id,
                studentId=a.student_id,
                status=a.status,
                createdAt=a.created_at
            )
            for a in apps
        ]

    def get_applications_for_job(self, job_id: str, user: User) -> List[ApplicationDetailsDto]:
        job = self.repo.get_by_id(job_id)
        if not job:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

        apps = self.repo.get_applications_by_job(job_id)
        result = []
        for a in apps:
            student = self.user_repo.get_by_id(a.student_id)
            profile = self.profile_repo.get_by_user_id(a.student_id) if student else None
            applicant_name = None
            if profile and profile.first_name:
                applicant_name = f"{profile.first_name} {profile.last_name or ''}".strip()

            result.append(ApplicationDetailsDto(
                id=a.id,
                jobId=a.job_id,
                studentId=a.student_id,
                status=a.status,
                createdAt=a.created_at,
                jobTitle=job.title,
                companyName=job.company_name,
                applicantName=applicant_name,
                applicantEmail=student.email if student else None
            ))
        return result

    def update_application_status(self, application_id: str, status_val: str, user: User) -> ApplicationDetailsDto:
        app = self.repo.get_application_by_id(application_id)
        if not app:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

        app.status = status_val.upper()
        saved = self.repo.update_application(app)
        job = self.repo.get_by_id(saved.job_id)
        student = self.user_repo.get_by_id(saved.student_id)
        profile = self.profile_repo.get_by_user_id(saved.student_id) if student else None
        applicant_name = f"{profile.first_name} {profile.last_name or ''}".strip() if profile and profile.first_name else None

        return ApplicationDetailsDto(
            id=saved.id,
            jobId=saved.job_id,
            studentId=saved.student_id,
            status=saved.status,
            createdAt=saved.created_at,
            jobTitle=job.title if job else "",
            companyName=job.company_name if job else "",
            applicantName=applicant_name,
            applicantEmail=student.email if student else None
        )
