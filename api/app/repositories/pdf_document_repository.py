from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.base import PdfDocument, PdfChatMessage

class PdfDocumentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id_and_owner(self, document_id: str, owner_id: str) -> Optional[PdfDocument]:
        return self.db.query(PdfDocument).filter(
            PdfDocument.id == document_id,
            PdfDocument.owner_id == owner_id
        ).first()

    def get_all_by_workspace_and_owner(self, workspace_id: str, owner_id: str) -> List[PdfDocument]:
        return self.db.query(PdfDocument).filter(
            PdfDocument.workspace_id == workspace_id,
            PdfDocument.owner_id == owner_id
        ).order_by(PdfDocument.created_at.desc()).all()

    def create(self, document: PdfDocument) -> PdfDocument:
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return document

    def update(self, document: PdfDocument) -> PdfDocument:
        self.db.commit()
        self.db.refresh(document)
        return document

    def delete(self, document: PdfDocument):
        self.db.delete(document)
        self.db.commit()

    def save_chat_message(self, message: PdfChatMessage) -> PdfChatMessage:
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def get_chat_history(self, document_id: str) -> List[PdfChatMessage]:
        return self.db.query(PdfChatMessage).filter(
            PdfChatMessage.document_id == document_id
        ).order_by(PdfChatMessage.created_at.asc()).all()
