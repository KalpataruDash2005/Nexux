from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.models.base import User, Flashcard, Quiz
from app.services.workspace_service import WorkspaceService
from app.schemas.workspace import (
    CreateWorkspaceRequestDto,
    RenameWorkspaceRequestDto,
    WorkspaceResponseDto,
    WorkspaceStatsDto
)

router = APIRouter(prefix="/workspaces", tags=["Workspaces"])

@router.post("", status_code=status.HTTP_201_CREATED, response_model=WorkspaceResponseDto)
def create_workspace(
    data: CreateWorkspaceRequestDto,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.create_workspace(current_user, data)

@router.get("", response_model=List[WorkspaceResponseDto])
def get_workspaces(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.get_workspaces(current_user)

@router.get("/{id}", response_model=WorkspaceResponseDto)
def get_workspace(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.get_workspace(id, current_user)

@router.patch("/{id}/archive", response_model=WorkspaceResponseDto)
def archive_workspace(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.archive_workspace(id, current_user)

@router.patch("/{id}", response_model=WorkspaceResponseDto)
def rename_workspace(
    id: str,
    data: RenameWorkspaceRequestDto,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.rename_workspace(id, current_user, data)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace(
    id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.delete_workspace(id, current_user)
    return None

@router.get("/{workspaceId}/stats", response_model=WorkspaceStatsDto)
def get_workspace_stats(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    return service.get_stats(workspaceId, current_user)

# --- Study Tools & Search on Workspaces ---
@router.post("/{workspaceId}/chat")
async def ask_workspace_chat(
    workspaceId: str,
    body: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    workspace = service.get_workspace(workspaceId, current_user)
    
    question = (body.get("question") or "").strip()
    if not question:
        return {"answer": "Please ask a question about your workspace or documents.", "sources": []}

    from app.rag.pipeline import rag_pipeline
    from app.ai import ai_gateway, AIWorkload

    # 1. Search across all documents belonging to this workspace
    results = rag_pipeline.search_context(workspace_id=workspaceId, query=question, top_k=6)
    if results:
        answer, sources = await rag_pipeline.ask_question(
            workspace_id=workspaceId,
            document_id=None,
            query=question,
            document_name=workspace.name or "Workspace Documents"
        )
        return {"answer": answer, "sources": sources}
    else:
        # 2. If no matching chunks or no documents yet, provide intelligent academic tutoring
        academic_system = (
            f"You are the dedicated Academic AI Tutor for the student workspace '{workspace.name}'. "
            "Provide a thorough, conceptually sound, and educational answer to the student's question. "
            "Use clear headings, bullet points, and practical examples where appropriate. "
            "Remind the student that uploading course PDFs, syllabus files, and textbooks to this workspace enables document-grounded answers."
        )
        answer = await ai_gateway.generate(
            task=AIWorkload.CHAT,
            system_prompt=academic_system,
            user_prompt=question,
            temperature=0.5,
            max_tokens=1000
        )
        return {"answer": answer, "sources": []}

@router.get("/{workspaceId}/chat")
def get_workspace_chat_messages(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return []

@router.post("/{workspaceId}/sessions")
def create_workspace_session(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return {"sessionId": "ws-session-1", "workspaceId": workspaceId}

@router.get("/{workspaceId}/sessions")
def get_workspace_sessions(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return []

@router.delete("/{workspaceId}/sessions/{sessionId}")
def delete_workspace_session(
    workspaceId: str,
    sessionId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return {"deleted": True}

@router.post("/{workspaceId}/flashcards/generate")
def generate_flashcards(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return []

@router.get("/{workspaceId}/flashcards")
def get_flashcards(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return []

@router.delete("/{workspaceId}/flashcards/{flashcardId}")
def delete_flashcard(
    workspaceId: str,
    flashcardId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return {"deleted": True}

@router.post("/{workspaceId}/quizzes/generate")
def generate_quiz(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return {"id": "quiz-1", "workspaceId": workspaceId, "title": "Auto-generated Quiz", "questions": []}

@router.get("/{workspaceId}/quizzes")
def get_quizzes(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    return []

@router.get("/{workspaceId}/search")
def search_workspace(
    workspaceId: str,
    query: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = WorkspaceService(db)
    service.get_workspace(workspaceId, current_user)
    from app.rag.pipeline import rag_pipeline
    hits = rag_pipeline.search_context(workspaceId, query, top_k=5)
    return hits
