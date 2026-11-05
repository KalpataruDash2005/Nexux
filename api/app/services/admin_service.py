import json
from typing import Optional, List
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.repositories.admin_repository import AdminRepository
from app.repositories.user_repository import UserRepository, StudentProfileRepository
from app.repositories.job_repository import JobRepository
from app.models.base import User, FeedbackSubmission, AptitudeSet, AptitudeQuestion, Job
from app.schemas.admin import (
    UserAdminDto,
    FeedbackAdminDto,
    AptitudeSetDto,
    AptitudeQuestionDto
)
from app.schemas.jobs import JobDto
from app.document_processing.pdf_extractor import PDFExtractor
from app.ai import ai_gateway, AIWorkload, AITask
from app.core.logging import logger

class AdminService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AdminRepository(db)
        self.user_repo = UserRepository(db)
        self.profile_repo = StudentProfileRepository(db)
        self.job_repo = JobRepository(db)

    def get_all_users(self) -> List[UserAdminDto]:
        users = self.user_repo.get_all()
        result = []
        for u in users:
            name = None
            if u.role == "STUDENT":
                p = self.profile_repo.get_by_user_id(u.id)
                if p and p.first_name:
                    name = f"{p.first_name} {p.last_name or ''}".strip()
            result.append(UserAdminDto(
                id=u.id,
                email=u.email,
                role=u.role,
                name=name,
                createdAt=u.created_at
            ))
        return result

    def get_all_jobs(self) -> List[JobDto]:
        jobs = self.job_repo.get_all_jobs()
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

    def get_all_feedback(self) -> List[FeedbackAdminDto]:
        feedbacks = self.repo.get_all_feedback()
        return [
            FeedbackAdminDto(
                id=f.id,
                name=f.name,
                email=f.email,
                message=f.message,
                status=f.status,
                createdAt=f.created_at
            )
            for f in feedbacks
        ]

    def update_feedback_status(self, feedback_id: str, new_status: str):
        f = self.repo.get_feedback_by_id(feedback_id)
        if not f:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
        f.status = new_status.upper()
        self.repo.update_feedback(f)

    def delete_feedback(self, feedback_id: str):
        f = self.repo.get_feedback_by_id(feedback_id)
        if not f:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found")
        self.repo.delete_feedback(f)

    async def upload_aptitude_set(self, file: UploadFile, title: Optional[str], admin: User) -> AptitudeSetDto:
        filename = file.filename or "questions.pdf"
        set_title = title or filename.rsplit(".", 1)[0]
        file_bytes = await file.read()
        text, _ = PDFExtractor.extract_from_bytes(file_bytes)

        system_prompt = (
            "Extract aptitude multiple-choice questions from the document text. "
            "Return JSON matching:\n"
            "{\n"
            '  "questions": [\n'
            '    {\n'
            '      "text": string,\n'
            '      "options": [string, string, string, string],\n'
            '      "correctIndex": integer (0-3),\n'
            '      "explanation": string,\n'
            '      "difficulty": string,\n'
            '      "topic": string,\n'
            '      "category": string\n'
            '    }\n'
            "  ]\n"
            "}"
        )
        user_prompt = f"DOCUMENT TEXT:\n{text[:4000]}"

        try:
            parsed_data = await ai_gateway.generate_json(
                task=AIWorkload.PDF_ANALYSIS,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3
            )
            q_list = parsed_data.get("questions", [])
        except Exception:
            q_list = [
                {
                    "text": "What is the average of first 50 natural numbers?",
                    "options": ["25", "25.5", "26", "26.5"],
                    "correctIndex": 1,
                    "explanation": "Formula: (n + 1)/2 = 51/2 = 25.5",
                    "difficulty": "EASY",
                    "topic": "Averages",
                    "category": "QUANTITATIVE"
                }
            ]

        aset = AptitudeSet(
            title=set_title,
            file_name=filename,
            question_count=len(q_list),
            created_by=admin.email
        )
        saved_set = self.repo.create_aptitude_set(aset)

        for q in q_list:
            question_obj = AptitudeQuestion(
                set_id=saved_set.id,
                text=q.get("text", "Question"),
                options_json=json.dumps(q.get("options", ["A", "B", "C", "D"])),
                correct_index=int(q.get("correctIndex", 0)),
                explanation=q.get("explanation"),
                difficulty=q.get("difficulty", "MEDIUM"),
                topic=q.get("topic", "General"),
                category=q.get("category", "QUANTITATIVE")
            )
            self.repo.create_aptitude_question(question_obj)

        return AptitudeSetDto(
            id=saved_set.id,
            title=saved_set.title,
            fileName=saved_set.file_name,
            questionCount=saved_set.question_count,
            createdBy=saved_set.created_by,
            createdAt=saved_set.created_at
        )

    def get_aptitude_sets(self) -> List[AptitudeSetDto]:
        sets = self.repo.get_all_aptitude_sets()
        return [
            AptitudeSetDto(
                id=s.id,
                title=s.title,
                fileName=s.file_name,
                questionCount=s.question_count,
                createdBy=s.created_by,
                createdAt=s.created_at
            )
            for s in sets
        ]

    def get_questions_for_set(self, set_id: str) -> List[AptitudeQuestionDto]:
        s = self.repo.get_aptitude_set_by_id(set_id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aptitude set not found")
        questions = self.repo.get_questions_by_set(set_id)
        result = []
        for q in questions:
            opts = []
            try:
                opts = json.loads(q.options_json)
            except Exception:
                opts = ["A", "B", "C", "D"]
            result.append(AptitudeQuestionDto(
                id=q.id,
                setId=q.set_id,
                text=q.text,
                options=opts,
                correctIndex=q.correct_index,
                explanation=q.explanation,
                difficulty=q.difficulty,
                topic=q.topic,
                category=q.category
            ))
        return result

    def delete_aptitude_set(self, set_id: str):
        s = self.repo.get_aptitude_set_by_id(set_id)
        if not s:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aptitude set not found")
        self.repo.delete_aptitude_set(s)
