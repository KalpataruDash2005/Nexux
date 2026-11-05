import os
import json
from typing import List, Optional
import jwt
from fastapi import APIRouter, Depends, UploadFile, File, Query, status, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.dependencies import get_current_user, security
from app.core.security import decode_access_token
from app.core.logging import logger
from app.models.base import User
from app.services.pdf_assistant_service import PdfAssistantService
from app.schemas.pdf_assistant import (
    PdfUploadResponse,
    PdfDocumentResponse,
    PdfChatRequest,
    PdfChatResponse,
    PdfChatMessageResponse,
    PdfDiagnosticResponse
)

router = APIRouter(prefix="/pdf-assistant", tags=["PDF Assistant"])

@router.post("/workspaces/{workspaceId}/documents", response_model=PdfUploadResponse)
async def upload_pdf_document(
    workspaceId: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return await service.upload_document(workspaceId, current_user, file, background_tasks)

@router.get("/workspaces/{workspaceId}/documents", response_model=List[PdfDocumentResponse])
def list_pdf_documents(
    workspaceId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return service.list_documents(workspaceId, current_user)

@router.get("/workspaces/{workspaceId}/documents/{documentId}", response_model=PdfDocumentResponse)
def get_pdf_document(
    workspaceId: str,
    documentId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return service.get_document(workspaceId, documentId, current_user)

@router.get("/workspaces/{workspaceId}/documents/{documentId}/file")
def get_pdf_document_file(
    workspaceId: str,
    documentId: str,
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
):
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        email = decode_access_token(raw_token)
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except jwt.PyJWTError as e:
        logger.warning(f"JWT validation failed for PDF document file request: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    service = PdfAssistantService(db)
    doc, file_path = service.get_document_file(workspaceId, documentId, user)
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF binary file is not available on server storage."
        )
    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=doc.file_name,
        headers={
            "Content-Disposition": f'inline; filename="{doc.file_name}"',
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
        }
    )

@router.post("/workspaces/{workspaceId}/documents/{documentId}/summarize", response_model=PdfDocumentResponse)
async def regenerate_pdf_summary(
    workspaceId: str,
    documentId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return await service.regenerate_document_summary(workspaceId, documentId, current_user)

@router.delete("/workspaces/{workspaceId}/documents/{documentId}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pdf_document(
    workspaceId: str,
    documentId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    service.delete_document(workspaceId, documentId, current_user)
    return None

@router.post("/workspaces/{workspaceId}/documents/{documentId}/chat", response_model=PdfChatResponse)
async def chat_pdf_document(
    workspaceId: str,
    documentId: str,
    request: PdfChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return await service.chat(workspaceId, documentId, current_user, request.question)

@router.post("/workspaces/{workspaceId}/documents/{documentId}/chat/stream")
async def chat_pdf_document_stream(
    workspaceId: str,
    documentId: str,
    request: PdfChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)

    async def sse_event_generator():
        async for token in service.chat_stream(workspaceId, documentId, current_user, request.question):
            payload = json.dumps({"token": token})
            yield f"data: {payload}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/workspaces/{workspaceId}/documents/{documentId}/chat", response_model=List[PdfChatMessageResponse])
def get_pdf_chat_history(
    workspaceId: str,
    documentId: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return service.get_chat_history(workspaceId, documentId, current_user)

@router.get("/workspaces/{workspaceId}/documents/{documentId}/diagnostics", response_model=PdfDiagnosticResponse)
def get_pdf_diagnostics(
    workspaceId: str,
    documentId: str,
    query: str = Query("summary"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = PdfAssistantService(db)
    return service.get_diagnostics(workspaceId, documentId, current_user, query)

@router.post("/internal/result")
def internal_result_stub():
    return {"status": "SUCCESS", "message": "Synchronous processing active."}
