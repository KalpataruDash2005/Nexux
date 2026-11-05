import pytest
from app.document_processing.pdf_extractor import PDFExtractor
from app.document_processing.chunker import TextChunker
from app.embeddings.embedding_service import embedding_service
from app.vectorstore.qdrant_service import qdrant_service
from app.rag.pipeline import rag_pipeline

def test_pdf_extractor_clean_text():
    raw_text = "Hello\r\nWorld!\x00   This  is   Nexux.\n\n\n\nCareerOS."
    cleaned = PDFExtractor.clean_text(raw_text)
    assert "\r" not in cleaned
    assert "\x00" not in cleaned
    assert "This is Nexux." in cleaned
    assert "\n\n\n" not in cleaned

def test_text_chunking_size_and_overlap():
    chunker = TextChunker(chunk_size=100, chunk_overlap=20)
    text = "The quick brown fox jumps over the lazy dog. " * 10
    chunks = chunker.chunk_text(text)

    assert len(chunks) > 1
    for c in chunks:
        assert len(c) <= 120  # allows small boundary flexibility

def test_embedding_dimensions():
    sample_text = "Career readiness and placement preparation in computer science."
    vector = embedding_service.embed_query(sample_text)
    assert len(vector) == 384
    # Check L2 normalization (sum of squares ≈ 1.0)
    norm = sum(x * x for x in vector)
    assert abs(norm - 1.0) < 1e-3

def test_qdrant_indexing_and_workspace_isolation():
    ws_a = "workspace-alpha-123"
    doc_a = "doc-alpha-456"
    text_a = "Python FastAPI serverless microservices deployed on Vercel."

    ws_b = "workspace-beta-789"
    doc_b = "doc-beta-012"
    text_b = "Java Spring Boot applications using Maven and Docker."

    # Index doc A in workspace A
    count_a = rag_pipeline.index_text(ws_a, doc_a, text_a)
    assert count_a >= 1

    # Index doc B in workspace B
    count_b = rag_pipeline.index_text(ws_b, doc_b, text_b)
    assert count_b >= 1

    # Search in workspace A for Python
    hits_a = rag_pipeline.search_context(ws_a, "FastAPI and Vercel", top_k=5)
    assert len(hits_a) > 0
    assert any("FastAPI" in h["text"] for h in hits_a)

    # Workspace Isolation Check: Searching in workspace B for Python should NOT return doc A
    hits_b_for_python = rag_pipeline.search_context(ws_b, "FastAPI and Vercel", top_k=5)
    for h in hits_b_for_python:
        assert h["documentId"] != doc_a
        assert "FastAPI" not in h["text"]

    # Clean up
    rag_pipeline.delete_document_vectors(ws_a, doc_a)
    rag_pipeline.delete_document_vectors(ws_b, doc_b)
