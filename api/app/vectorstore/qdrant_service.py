import uuid
from typing import List, Dict, Any, Optional
from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings
from app.core.logging import logger

class QdrantService:
    def __init__(self):
        self.collection_name = settings.QDRANT_COLLECTION
        self.dimension = settings.EMBEDDING_DIMENSION
        self.client = self._init_client()
        self._collection_ensured = False
        self._in_memory_store: List[Dict[str, Any]] = []  # Fallback for offline/test environments

    def _init_client(self) -> Optional[QdrantClient]:
        try:
            if settings.QDRANT_URL:
                logger.info(f"Connecting to Qdrant at URL: {settings.QDRANT_URL}")
                return QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY, timeout=10.0, check_compatibility=False)
            elif settings.QDRANT_HOST:
                # Attempt to connect to local/network Qdrant instance (e.g. Docker container on localhost:6333)
                client = QdrantClient(
                    host=settings.QDRANT_HOST,
                    port=settings.QDRANT_PORT,
                    api_key=settings.QDRANT_API_KEY,
                    https=settings.QDRANT_USE_TLS,
                    timeout=5.0
                )
                # Verify live connectivity
                client.get_collections()
                logger.info(f"Connected to live Qdrant server at {settings.QDRANT_HOST}:{settings.QDRANT_PORT}")
                return client
            else:
                # Embedded in-memory Qdrant instance for serverless / testing
                logger.info("Initializing in-memory embedded Qdrant instance")
                return QdrantClient(location=":memory:")
        except Exception as e:
            logger.info(f"Qdrant server not reachable ({e}). Falling back to in-memory embedded Qdrant.")
            return QdrantClient(location=":memory:")

    def ensure_collection(self):
        if not self.client or self._collection_ensured:
            return
        try:
            collections = self.client.get_collections().collections
            names = [c.name for c in collections]
            if self.collection_name not in names:
                logger.info(f"Creating Qdrant collection: {self.collection_name}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.dimension,
                        distance=models.Distance.COSINE
                    )
                )
                # Create payload indexes
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="workspaceId",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="documentId",
                    field_schema=models.PayloadSchemaType.KEYWORD
                )
                logger.info(f"Qdrant collection {self.collection_name} verified and indexed.")
            self._collection_ensured = True
        except Exception as e:
            logger.warning(f"Failed to ensure Qdrant collection on server: {e}")

    def upsert_chunks(
        self,
        workspace_id: str,
        document_id: str,
        chunks: List[str],
        vectors: List[List[float]]
    ) -> int:
        if not chunks:
            return 0

        self.ensure_collection()
        points = []
        for idx, (text, vector) in enumerate(zip(chunks, vectors)):
            # Deterministic UUIDv5 prevents duplicate vector points on re-indexing / retries
            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{workspace_id}:{document_id}:{idx}"))
            payload = {
                "workspaceId": workspace_id,
                "documentId": document_id,
                "chunkIndex": idx,
                "text": text
            }
            points.append(models.PointStruct(id=point_id, vector=vector, payload=payload))

        # Update in-memory fallback store idempotently
        existing_map = {p["id"]: i for i, p in enumerate(self._in_memory_store)}
        for pt in points:
            item_data = {"id": pt.id, "vector": pt.vector, "payload": pt.payload}
            if pt.id in existing_map:
                self._in_memory_store[existing_map[pt.id]] = item_data
            else:
                self._in_memory_store.append(item_data)
                existing_map[pt.id] = len(self._in_memory_store) - 1

        if self.client:
            try:
                self.client.upsert(collection_name=self.collection_name, points=points)
                logger.info(f"Idempotently upserted {len(points)} points to Qdrant for document {document_id}")
                return len(points)
            except Exception as e:
                logger.warning(f"Failed upserting to Qdrant server: {e}. Stored in fallback store.")

        return len(points)

    def search(
        self,
        workspace_id: str,
        query_vector: List[float],
        document_id: Optional[str] = None,
        top_k: int = 5,
        min_score: float = 0.30
    ) -> List[Dict[str, Any]]:
        self.ensure_collection()

        # Build filter conditions
        must_conditions = [
            models.FieldCondition(
                key="workspaceId",
                match=models.MatchValue(value=workspace_id)
            )
        ]
        if document_id:
            must_conditions.append(
                models.FieldCondition(
                    key="documentId",
                    match=models.MatchValue(value=document_id)
                )
            )
        qdrant_filter = models.Filter(must=must_conditions)

        results: List[Dict[str, Any]] = []

        if self.client:
            try:
                if hasattr(self.client, "query_points"):
                    res = self.client.query_points(
                        collection_name=self.collection_name,
                        query=query_vector,
                        query_filter=qdrant_filter,
                        limit=top_k,
                        score_threshold=min_score
                    )
                    hits = res.points
                else:
                    hits = self.client.search(
                        collection_name=self.collection_name,
                        query_vector=query_vector,
                        query_filter=qdrant_filter,
                        limit=top_k,
                        score_threshold=min_score
                    )
                for hit in hits:
                    results.append({
                        "id": str(hit.id),
                        "score": hit.score,
                        "text": hit.payload.get("text", "") if hit.payload else "",
                        "chunkIndex": hit.payload.get("chunkIndex", 0) if hit.payload else 0,
                        "documentId": hit.payload.get("documentId", "") if hit.payload else ""
                    })
                return results
            except Exception as e:
                logger.warning(f"Qdrant server search failed: {e}. Searching in-memory fallback.")

        # In-memory search fallback (dot product of normalized vectors)
        candidates = [
            p for p in self._in_memory_store
            if p["payload"].get("workspaceId") == workspace_id and
               (not document_id or p["payload"].get("documentId") == document_id)
        ]

        scored = []
        for c in candidates:
            # Cosine similarity
            sim = sum(a * b for a, b in zip(query_vector, c["vector"]))
            if sim >= min_score:
                scored.append({
                    "id": c["id"],
                    "score": sim,
                    "text": c["payload"].get("text", ""),
                    "chunkIndex": c["payload"].get("chunkIndex", 0),
                    "documentId": c["payload"].get("documentId", "")
                })

        scored.sort(key=lambda x: x["score"], reverse=True)
        return scored[:top_k]

    def delete_document_vectors(self, workspace_id: str, document_id: str):
        if self.client:
            try:
                self.client.delete(
                    collection_name=self.collection_name,
                    points_selector=models.Filter(
                        must=[
                            models.FieldCondition(key="workspaceId", match=models.MatchValue(value=workspace_id)),
                            models.FieldCondition(key="documentId", match=models.MatchValue(value=document_id))
                        ]
                    )
                )
                logger.info(f"Deleted vectors for document {document_id} from Qdrant")
            except Exception as e:
                logger.warning(f"Could not delete vectors from Qdrant server: {e}")

        # Clean fallback store
        self._in_memory_store = [
            p for p in self._in_memory_store
            if not (p["payload"].get("workspaceId") == workspace_id and p["payload"].get("documentId") == document_id)
        ]

qdrant_service = QdrantService()
