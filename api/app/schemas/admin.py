from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class UserAdminDto(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class FeedbackRequestDto(BaseModel):
    name: Optional[str] = None
    email: str
    message: str

class FeedbackAdminDto(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    message: str
    status: str
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class UpdateFeedbackStatusDto(BaseModel):
    status: str

class AptitudeSetDto(BaseModel):
    id: str
    title: str
    fileName: Optional[str] = None
    questionCount: int = 0
    createdBy: Optional[str] = None
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class AptitudeQuestionDto(BaseModel):
    id: str
    setId: str
    text: str
    options: List[str]
    correctIndex: int
    explanation: Optional[str] = None
    difficulty: Optional[str] = None
    topic: Optional[str] = None
    category: Optional[str] = None

    class Config:
        from_attributes = True

class NotificationRequestDto(BaseModel):
    title: str
    message: str
    targetRole: Optional[str] = None
    userId: Optional[str] = None
