import io
import re
from typing import Tuple
from pypdf import PdfReader
from app.core.logging import logger

class PDFExtractor:
    @staticmethod
    def clean_text(text: str) -> str:
        if not text:
            return ""
        # Normalize carriage returns and line feeds
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        # Replace non-printable characters
        text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", " ", text)
        # Collapse multiple spaces
        text = re.sub(r"[ \t]+", " ", text)
        # Collapse excessive newlines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @classmethod
    def extract_from_bytes(cls, file_bytes: bytes) -> Tuple[str, int]:
        """
        Extracts clean text from PDF bytes.
        Returns: (extracted_text, page_count)
        """
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            page_count = len(reader.pages)
            extracted_pages = []
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text() or ""
                    extracted_pages.append(page_text)
                except Exception as pe:
                    logger.warning(f"Failed extracting page {i + 1}: {pe}")
            
            full_text = "\n\n".join(extracted_pages)
            cleaned = cls.clean_text(full_text)
            return cleaned, page_count
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            # Try reading as plain UTF-8 text if it was a .txt file
            try:
                decoded = file_bytes.decode("utf-8", errors="ignore")
                return cls.clean_text(decoded), 1
            except Exception:
                raise RuntimeError(f"Could not extract text from document: {e}")
