from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class StudentProfileDto(BaseModel):
    id: Optional[str] = None
    userId: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    university: Optional[str] = None
    degree: Optional[str] = None
    graduationYear: Optional[int] = None
    skills: Optional[str] = None
    resumeUrl: Optional[str] = None
    phone: Optional[str] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None

    class Config:
        from_attributes = True
