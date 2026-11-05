from typing import List
from app.core.config import settings

class TextChunker:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or settings.RAG_CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.RAG_CHUNK_OVERLAP

    def chunk_text(self, text: str) -> List[str]:
        """
        Splits text into chunks of specified length with overlap.
        Respects paragraph / sentence boundaries when available.
        """
        if not text or not text.strip():
            return []

        clean_text = text.strip()
        if len(clean_text) <= self.chunk_size:
            return [clean_text]

        chunks: List[str] = []
        start = 0
        text_len = len(clean_text)

        while start < text_len:
            end = start + self.chunk_size
            if end >= text_len:
                chunk = clean_text[start:].strip()
                if chunk:
                    chunks.append(chunk)
                break

            # Try to break at paragraph or period boundary
            cutoff = -1
            boundary_candidates = ["\n\n", ".\n", ". ", "? ", "! "]
            for b in boundary_candidates:
                candidate_pos = clean_text.rfind(b, start + self.chunk_size // 2, end)
                if candidate_pos != -1:
                    cutoff = candidate_pos + len(b)
                    break

            if cutoff == -1:
                # Break at space
                space_pos = clean_text.rfind(" ", start + self.chunk_size // 2, end)
                if space_pos != -1:
                    cutoff = space_pos + 1
                else:
                    cutoff = end

            chunk = clean_text[start:cutoff].strip()
            if chunk:
                chunks.append(chunk)

            # Advance by step size (chunk_size - overlap)
            step = max(1, (cutoff - start) - self.chunk_overlap)
            start += step

        return chunks
