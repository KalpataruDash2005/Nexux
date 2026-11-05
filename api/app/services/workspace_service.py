from typing import List
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.repositories.workspace_repository import WorkspaceRepository
from app.models.base import Workspace, User
from app.schemas.workspace import (
    CreateWorkspaceRequestDto,
    RenameWorkspaceRequestDto,
    WorkspaceResponseDto,
    WorkspaceStatsDto
)

class WorkspaceService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WorkspaceRepository(db)

    def create_workspace(self, user: User, data: CreateWorkspaceRequestDto) -> WorkspaceResponseDto:
        workspace = Workspace(
            name=data.name.strip(),
            description=data.description.strip() if data.description else None,
            owner_id=user.id,
            status="ACTIVE"
        )
        saved = self.repo.create(workspace)
        return WorkspaceResponseDto(
            id=saved.id,
            studentId=saved.owner_id,
            name=saved.name,
            description=saved.description,
            status=saved.status,
            createdAt=saved.created_at,
            updatedAt=saved.updated_at,
            documentCount=0
        )

    def get_workspaces(self, user: User) -> List[WorkspaceResponseDto]:
        workspace_tuples = self.repo.get_all_by_owner_with_doc_counts(user.id)
        return [
            WorkspaceResponseDto(
                id=w.id,
                studentId=w.owner_id,
                name=w.name,
                description=w.description,
                status=w.status,
                createdAt=w.created_at,
                updatedAt=w.updated_at,
                documentCount=doc_count
            )
            for w, doc_count in workspace_tuples
        ]

    def get_workspace(self, workspace_id: str, user: User) -> WorkspaceResponseDto:
        w = self.repo.get_by_id_and_owner(workspace_id, user.id)
        if not w:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        doc_count = self.repo.count_documents(w.id)
        return WorkspaceResponseDto(
            id=w.id,
            studentId=w.owner_id,
            name=w.name,
            description=w.description,
            status=w.status,
            createdAt=w.created_at,
            updatedAt=w.updated_at,
            documentCount=doc_count
        )

    def archive_workspace(self, workspace_id: str, user: User) -> WorkspaceResponseDto:
        w = self.repo.get_by_id_and_owner(workspace_id, user.id)
        if not w:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        w.status = "ARCHIVED"
        saved = self.repo.update(w)
        return WorkspaceResponseDto(
            id=saved.id,
            studentId=saved.owner_id,
            name=saved.name,
            description=saved.description,
            status=saved.status,
            createdAt=saved.created_at,
            updatedAt=saved.updated_at,
            documentCount=self.repo.count_documents(saved.id)
        )

    def rename_workspace(self, workspace_id: str, user: User, data: RenameWorkspaceRequestDto) -> WorkspaceResponseDto:
        w = self.repo.get_by_id_and_owner(workspace_id, user.id)
        if not w:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        if data.name:
            w.name = data.name.strip()
        if data.description is not None:
            w.description = data.description.strip()
        saved = self.repo.update(w)
        return WorkspaceResponseDto(
            id=saved.id,
            studentId=saved.owner_id,
            name=saved.name,
            description=saved.description,
            status=saved.status,
            createdAt=saved.created_at,
            updatedAt=saved.updated_at,
            documentCount=self.repo.count_documents(saved.id)
        )

    def delete_workspace(self, workspace_id: str, user: User):
        w = self.repo.get_by_id_and_owner(workspace_id, user.id)
        if not w:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        self.repo.delete(w)

    def get_stats(self, workspace_id: str, user: User) -> WorkspaceStatsDto:
        w = self.repo.get_by_id_and_owner(workspace_id, user.id)
        if not w:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
        doc_count = self.repo.count_documents(w.id)
        return WorkspaceStatsDto(
            documentCount=doc_count,
            totalChunks=doc_count * 5,
            lastActive=w.updated_at.isoformat() if w.updated_at else None
        )
