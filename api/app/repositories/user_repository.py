from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.base import User, StudentProfile

class UserRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Optional[User]:
        return self.db.query(User).filter(User.email == email.lower().strip()).first()

    def get_by_id(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.id == user_id).first()

    def exists_by_email(self, email: str) -> bool:
        return self.db.query(User).filter(User.email == email.lower().strip()).count() > 0

    def create(self, user: User) -> User:
        user.email = user.email.lower().strip()
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def get_all(self) -> List[User]:
        return self.db.query(User).order_by(User.created_at.desc()).all()


class StudentProfileRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user_id(self, user_id: str) -> Optional[StudentProfile]:
        return self.db.query(StudentProfile).filter(StudentProfile.user_id == user_id).first()

    def create_or_update(self, profile: StudentProfile) -> StudentProfile:
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile
