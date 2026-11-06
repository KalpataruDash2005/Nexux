from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class CreateTaskRequest(BaseModel):
    title: str
    deadline: Optional[datetime] = None

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    deadline: Optional[datetime] = None
    progressNotes: Optional[str] = None

class TaskDto(BaseModel):
    id: str
    title: str
    status: str
    deadline: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    progressNotes: Optional[str] = None
    parentTaskId: Optional[str] = None
    estimatedHours: Optional[float] = None
    remainingHours: Optional[float] = None
    chunkIndex: Optional[int] = None
    totalChunks: Optional[int] = None
    aiGenerated: bool = False
    startedAt: Optional[datetime] = None
    pausedAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None
    lastActivity: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskSummaryResponse(BaseModel):
    total: int
    completed: int
    pending: int
    overdue: int

class AiPlanResponse(BaseModel):
    plan: str
    pendingCount: Optional[int] = 0
    generatedAt: Optional[datetime] = None
    tasksIncluded: Optional[List[Dict[str, Any]]] = []

class PersistAiPlanRequest(BaseModel):
    plan: str
    saveNotesToTasks: Optional[bool] = True

class PersistAiPlanResponse(BaseModel):
    success: bool
    message: str
    persistedAt: datetime
    updatedTasksCount: int = 0

class AssistantRequest(BaseModel):
    taskId: Optional[str] = None
    message: str
    pageContext: Optional[str] = None
    timezone: Optional[str] = None

class AssistantChunk(BaseModel):
    id: str
    title: str
    status: str
    scheduledDate: Optional[str] = None

class AssistantResponse(BaseModel):
    replyMessage: str
    action: str = "REPLY"
    updatedTask: Optional[TaskDto] = None
    createdTask: Optional[TaskDto] = None
    newChunks: List[AssistantChunk] = []
    standardResponse: Optional[Dict[str, Any]] = None

class AssistantContextResponse(BaseModel):
    now: str
    timezone: str
    activeTask: Optional[TaskDto] = None
    recentTasks: List[TaskDto] = []
    upcomingDeadlines: List[TaskDto] = []
    memory: Dict[str, str] = {}
    conversationSummary: str = ""

class AssistantHistoryMessage(BaseModel):
    id: str
    role: str
    content: str
    createdAt: Optional[datetime] = None

class AssistantHistoryResponse(BaseModel):
    messages: List[AssistantHistoryMessage]
