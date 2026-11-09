from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.user_repository import StudentProfileRepository, UserRepository
from app.models.base import StudentProfile, User
from app.schemas.profile import StudentProfileDto
from app.core.cache import cache_manager

class ProfileService:
    def __init__(self, db: Session):
        self.db = db
        self.profile_repo = StudentProfileRepository(db)
        self.user_repo = UserRepository(db)

    def get_profile(self, user: User) -> StudentProfileDto:
        cache_key = f"student:profile:{user.id}"
        cached = cache_manager.get(cache_key)
        if cached is not None:
            try:
                return StudentProfileDto.model_validate(cached)
            except Exception:
                pass
        profile = self.profile_repo.get_by_user_id(user.id)
        if not profile:
            # Return empty skeleton
            return StudentProfileDto(
                id="",
                userId=user.id,
                firstName="",
                lastName="",
                university="",
                degree="",
                graduationYear=None,
                skills="",
                resumeUrl=""
            )
        res = StudentProfileDto(
            id=profile.id,
            userId=profile.user_id,
            firstName=profile.first_name,
            lastName=profile.last_name,
            university=profile.university,
            degree=profile.degree,
            graduationYear=profile.graduation_year,
            skills=profile.skills,
            resumeUrl=profile.resume_url,
            createdAt=profile.created_at,
            updatedAt=profile.updated_at
        )
        cache_manager.set(cache_key, res.model_dump(), ttl_seconds=300)
        return res

    def update_profile(self, user: User, data: StudentProfileDto) -> StudentProfileDto:
        profile = self.profile_repo.get_by_user_id(user.id)
        if not profile:
            profile = StudentProfile(user_id=user.id)

        if data.firstName is not None:
            profile.first_name = data.firstName
        if data.lastName is not None:
            profile.last_name = data.lastName
        if data.university is not None:
            profile.university = data.university
        if data.degree is not None:
            profile.degree = data.degree
        if data.graduationYear is not None:
            profile.graduation_year = data.graduationYear
        if data.skills is not None:
            profile.skills = data.skills
        if data.resumeUrl is not None:
            profile.resume_url = data.resumeUrl

        saved = self.profile_repo.create_or_update(profile)
        cache_manager.delete(f"student:profile:{user.id}")
        cache_manager.delete(f"user_cache:{user.email}")
        return StudentProfileDto(
            id=saved.id,
            userId=saved.user_id,
            firstName=saved.first_name,
            lastName=saved.last_name,
            university=saved.university,
            degree=saved.degree,
            graduationYear=saved.graduation_year,
            skills=saved.skills,
            resumeUrl=saved.resume_url,
            createdAt=saved.created_at,
            updatedAt=saved.updated_at
        )
