import hashlib
import math
from typing import List
from app.core.config import settings
from app.core.logging import logger

class EmbeddingService:
    def __init__(self):
        self.dimension = settings.EMBEDDING_DIMENSION  # 384
        self._model = None
        self._backend = None
        self._initialized = False

    def _ensure_initialized(self):
        """Lazy initialization of embedding models so startup and health checks are instantaneous."""
        if self._initialized:
            return
        self._init_model()
        self._initialized = True

    def _init_model(self):
        """Attempts to load fastembed (ONNX runtime) or sentence_transformers."""
        try:
            from fastembed import TextEmbedding
            # Use quantized ONNX all-MiniLM-L6-v2 matching Spring Boot LangChain4j
            self._model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")
            self._backend = "fastembed"
            logger.info("Initialized FastEmbed (ONNX) 384-dim all-MiniLM-L6-v2 embedding model")
            return
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"Could not load FastEmbed: {e}")

        try:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            self._backend = "sentence_transformers"
            logger.info("Initialized SentenceTransformer 384-dim all-MiniLM-L6-v2 model")
            return
        except ImportError:
            pass
        except Exception as e:
            logger.warning(f"Could not load SentenceTransformers: {e}")

        self._backend = "deterministic_fallback"
        logger.info("Using deterministic 384-dim normalized embedding fallback for testing/serverless cold-start")

    def _fallback_embed(self, text: str) -> List[float]:
        """
        Deterministic, L2-normalized 384-dimensional vector based on text tokens and hashes.
        Ensures consistent cosine similarity in test environments and serverless edge cases.
        """
        import re
        vector = [0.0] * self.dimension
        tokens = re.findall(r"\w+", text.lower())
        if not tokens:
            tokens = ["empty"]
        
        for token in tokens:
            h = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16)
            slot = h % self.dimension
            val = ((h >> 8) % 100) / 100.0 + 1.0  # Positive weight [1.0, 2.0]
            vector[slot] += val

        # L2 normalize
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            vector = [x / norm for x in vector]
        else:
            vector[0] = 1.0
        return vector

    def embed_query(self, text: str) -> List[float]:
        return self.embed_documents([text])[0]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        self._ensure_initialized()

        if self._backend == "fastembed" and self._model is not None:
            try:
                embeddings = list(self._model.embed(texts, batch_size=64))
                return [e.tolist() for e in embeddings]
            except Exception as e:
                logger.error(f"FastEmbed embedding error: {e}. Using fallback.")

        elif self._backend == "sentence_transformers" and self._model is not None:
            try:
                embeddings = self._model.encode(texts, normalize_embeddings=True)
                return [e.tolist() for e in embeddings]
            except Exception as e:
                logger.error(f"SentenceTransformers error: {e}. Using fallback.")

        return [self._fallback_embed(t) for t in texts]

# Singleton instance
embedding_service = EmbeddingService()
