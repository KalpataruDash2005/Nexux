from typing import Optional, List, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.base import Workspace, PdfDocument, Document

class WorkspaceRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, workspace_id: str) -> Optional[Workspace]:
        return self.db.query(Workspace).filter(Workspace.id == workspace_id).first()

    def get_by_id_and_owner(self, workspace_id: str, owner_id: str) -> Optional[Workspace]:
        return self.db.query(Workspace).filter(
            Workspace.id == workspace_id,
            Workspace.owner_id == owner_id
        ).first()

    def get_all_by_owner(self, owner_id: str) -> List[Workspace]:
        return self.db.query(Workspace).filter(
            Workspace.owner_id == owner_id
        ).order_by(Workspace.created_at.desc()).all()

    def get_all_by_owner_with_doc_counts(self, owner_id: str) -> List[Tuple[Workspace, int]]:
        """
        Fetches all workspaces and aggregated document counts in a single round-trip,
        completely resolving the N+1 query bottleneck.
        """
        rows = (
            self.db.query(
                Workspace,
                func.count(PdfDocument.id).label("doc_count")
            )
            .outerjoin(PdfDocument, Workspace.id == PdfDocument.workspace_id)
            .filter(Workspace.owner_id == owner_id)
            .group_by(Workspace.id)
            .order_by(Workspace.created_at.desc())
            .all()
        )
        return [(r[0], int(r[1])) for r in rows]

    def create(self, workspace: Workspace) -> Workspace:
        self.db.add(workspace)
        self.db.commit()
        self.db.refresh(workspace)
        return workspace

    def update(self, workspace: Workspace) -> Workspace:
        self.db.commit()
        self.db.refresh(workspace)
        return workspace

    def delete(self, workspace: Workspace):
        self.db.delete(workspace)
        self.db.commit()

    def count_documents(self, workspace_id: str) -> int:
        pdf_count = self.db.query(PdfDocument).filter(PdfDocument.workspace_id == workspace_id).count()
        doc_count = self.db.query(Document).filter(Document.workspace_id == workspace_id).count()
        return pdf_count + doc_count
