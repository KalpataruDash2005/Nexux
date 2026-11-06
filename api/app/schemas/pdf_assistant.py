from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class PdfUploadResponse(BaseModel):
    id: str
    fileName: str
    status: str
    message: str

class PdfDocumentResponse(BaseModel):
    id: str
    workspaceId: Optional[str] = None
    fileName: str
    fileSize: int
    contentType: Optional[str] = "application/pdf"
    status: str
    processingSource: Optional[str] = "NATIVE"
    summary: Optional[str] = None
    chunkCount: Optional[int] = 0
    errorMessage: Optional[str] = None
    processedAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    standardResponse: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class PdfChatRequest(BaseModel):
    question: str

class PdfChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    createdAt: Optional[datetime] = None

    class Config:
        from_attributes = True

class PdfChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    history: List[PdfChatMessageResponse] = []
    standardResponse: Optional[Dict[str, Any]] = None

class PdfDiagnosticResponse(BaseModel):
    documentId: str
    fileName: str
    extractionStatus: str
    extractedTextLength: int
    chunkCount: int
    embeddingModel: str
    vectorDimension: int
    qdrantCollection: str
    indexedPointsCount: int
    sampleQuery: Optional[str] = None
    retrievalResultCount: int
    retrievedChunkIds: List[str] = []
    retrievedChunkScores: List[float] = []
    modelCallSucceeded: bool = False
    systemStatus: str = "HEALTHY"
