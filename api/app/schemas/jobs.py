from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class JobDto(BaseModel):
    id: Optional[str] = None
    postedById: Optional[str] = None
    title: str
    companyName: str
    description: str
    location: Optional[str] = None
    salary: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class CreateApplicationDto(BaseModel):
    jobId: str

class ApplicationDto(BaseModel):
    id: str
    jobId: str
    studentId: str
    status: str
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class ApplicationDetailsDto(BaseModel):
    id: str
    jobId: str
    studentId: str
    status: str
    createdAt: Optional[datetime] = None
    jobTitle: Optional[str] = None
    companyName: Optional[str] = None
    applicantName: Optional[str] = None
    applicantEmail: Optional[str] = None

    class Config:
        from_attributes = True

class UpdateApplicationStatusDto(BaseModel):
    status: str
