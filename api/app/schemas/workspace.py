from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class CreateWorkspaceRequestDto(BaseModel):
    name: str
    description: Optional[str] = None

class RenameWorkspaceRequestDto(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceResponseDto(BaseModel):
    id: str
    studentId: Optional[str] = None
    name: str
    description: Optional[str] = None
    status: str = "ACTIVE"
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    documentCount: int = 0

    class Config:
        from_attributes = True

class WorkspaceStatsDto(BaseModel):
    documentCount: int = 0
    totalChunks: int = 0
    lastActive: Optional[str] = None
