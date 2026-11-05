from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.base import User
from app.services.task_service import TaskService
from app.schemas.tasks import (
    CreateTaskRequest,
    UpdateTaskRequest,
    TaskDto,
    TaskSummaryResponse,
    AiPlanResponse,
    PersistAiPlanRequest,
    PersistAiPlanResponse,
    AssistantRequest,
    AssistantResponse,
    AssistantContextResponse,
    AssistantHistoryResponse
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=TaskDto)
def create_task(
    data: CreateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.create_task(current_user, data)

@router.get("", response_model=List[TaskDto])
def get_tasks(
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_tasks(current_user, status_filter=status, limit=limit, offset=offset)

@router.get("/summary", response_model=TaskSummaryResponse)
def get_task_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_summary(current_user)

@router.post("/ai-plan", response_model=AiPlanResponse)
async def generate_ai_plan(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return await service.generate_ai_plan(current_user)

@router.post("/ai-plan/persist", response_model=PersistAiPlanResponse)
def persist_ai_plan(
    request: PersistAiPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.persist_ai_plan(current_user, request.plan, request.saveNotesToTasks)

@router.post("/assistant", response_model=AssistantResponse)
async def task_assistant(
    request: AssistantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return await service.handle_assistant(current_user, request)

@router.get("/assistant/context", response_model=AssistantContextResponse)
def get_assistant_context(
    taskId: Optional[str] = Query(None),
    pageContext: Optional[str] = Query(None),
    timezone: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_assistant_context(
        current_user,
        task_id=taskId,
        page_context=pageContext,
        timezone=timezone
    )

@router.get("/assistant/history", response_model=AssistantHistoryResponse)
def get_assistant_history(
    limit: int = Query(20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_assistant_history(current_user, limit=limit)

@router.get("/{id}", response_model=TaskDto)
def get_task(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.get_task(id, current_user)

@router.patch("/{id}", response_model=TaskDto)
def update_task(
    id: str,
    data: UpdateTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    return service.update_task(id, current_user, data)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    service.delete_task(id, current_user)
    return None
