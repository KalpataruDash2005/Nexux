from typing import List, Tuple, Dict, Any, AsyncGenerator
from app.document_processing.chunker import TextChunker
from app.embeddings.embedding_service import embedding_service
from app.vectorstore.qdrant_service import qdrant_service
from app.ai import ai_gateway, AIWorkload, AITask
from app.core.config import settings
from app.core.logging import logger

class RagPipeline:
    def __init__(self):
        self.chunker = TextChunker(
            chunk_size=settings.RAG_CHUNK_SIZE,
            chunk_overlap=settings.RAG_CHUNK_OVERLAP
        )
        self.embedder = embedding_service
        self.vectorstore = qdrant_service

    def index_text(self, workspace_id: str, document_id: str, text: str) -> int:
        """Chunks, embeds, and indexes text into Qdrant."""
        if not text or not text.strip():
            return 0

        chunks = self.chunker.chunk_text(text)
        if not chunks:
            return 0

        logger.info(f"[RAG] Indexing {len(chunks)} chunks for document {document_id}")
        embeddings = self.embedder.embed_documents(chunks)
        indexed_count = self.vectorstore.upsert_chunks(
            workspace_id=workspace_id,
            document_id=document_id,
            chunks=chunks,
            vectors=embeddings
        )
        return indexed_count

    def search_context(
        self,
        workspace_id: str,
        query: str,
        document_id: str = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Searches vectorstore for relevant chunks."""
        query_vector = self.embedder.embed_query(query)
        results = self.vectorstore.search(
            workspace_id=workspace_id,
            query_vector=query_vector,
            document_id=document_id,
            top_k=top_k or settings.RAG_TOP_K,
            min_score=settings.RAG_MIN_SCORE
        )
        # Dynamic fallback threshold: If strict min_score yielded no hits, try relaxed 0.20
        # to accommodate phrasing variation while maintaining signal
        if not results and settings.RAG_MIN_SCORE > 0.20:
            results = self.vectorstore.search(
                workspace_id=workspace_id,
                query_vector=query_vector,
                document_id=document_id,
                top_k=top_k or settings.RAG_TOP_K,
                min_score=0.20
            )
        return results

    def _assemble_prompt(
        self,
        query: str,
        results: List[Dict[str, Any]],
        document_name: str = "Uploaded Document",
        history: List[Dict[str, str]] = None
    ) -> Tuple[str, str, List[str]]:
        sources = []
        context_parts = []
        for i, hit in enumerate(results):
            text = hit.get("text", "").strip()
            if text:
                chunk_idx = hit.get("chunkIndex", i)
                score = hit.get("score", 0.0)
                sources.append(f"[{document_name} | Chunk #{chunk_idx} | Relevance: {score:.2f}]: {text}")
                context_parts.append(
                    f"--- Document Excerpt {i + 1} ({document_name}, Chunk #{chunk_idx}, Relevance: {score:.2f}) ---\n{text}"
                )

        has_context = len(context_parts) > 0
        context_str = "\n\n".join(context_parts) if has_context else "NO RELEVANT DOCUMENT EXCERPTS FOUND."

        history_str = ""
        if history:
            valid_turns = [f"{turn.get('role', 'USER')}: {turn.get('content', '')}" for turn in history[-4:]]
            if valid_turns:
                history_str = "PREVIOUS CONVERSATION HISTORY:\n" + "\n".join(valid_turns) + "\n\n"

        system_prompt = (
            "You are Nexora AI, an intelligent, helpful, and articulate Academic Document Assistant. "
            "Your objective is to provide a clear, accurate, and comprehensive answer to the user's question, "
            "grounded firmly in the provided document context.\n\n"
            "Grounding Rules & Guidelines:\n"
            "1. Answer naturally, smoothly, and authoritatively, exactly like modern state-of-the-art AI assistants (such as ChatGPT or Grok).\n"
            "2. Format your response cleanly using standard GitHub-flavored Markdown: use bolding for core terms, readable paragraphs, and clean bullet points or numbered steps where appropriate.\n"
            "3. Do NOT output robotic structural headers like 'Direct Answer', 'Explanation', 'Key Points', 'Source References', or 'Evidence Limitations'.\n"
            "4. Do NOT cite raw chunk numbers or retrieval scores (do NOT say 'Chunk #123' or 'Relevance 0.65'). Synthesize the facts naturally into fluent prose.\n"
            "5. If the document does not contain sufficient information to answer the question, state that clearly and politely without fabricating external facts.\n"
            "6. Keep the explanation thorough, student-friendly, and engaging."
        )

        user_prompt = (
            f"DOCUMENT CONTEXT:\n{context_str}\n\n"
            f"{history_str}"
            f"QUESTION:\n{query}\n\n"
            "ANSWER:"
        )

        return system_prompt, user_prompt, sources

    def _build_grounded_refusal(self, document_name: str = "Uploaded Document") -> str:
        return (
            f"The uploaded document ({document_name}) does not appear to contain information relevant to your question.\n\n"
            "If your question relates to topics covered elsewhere in your course notes or syllabus, please select the corresponding document or upload the relevant file."
        )

    async def ask_question(
        self,
        workspace_id: str,
        document_id: str,
        query: str,
        top_k: int = 5,
        document_name: str = "Uploaded Document",
        history: List[Dict[str, str]] = None
    ) -> Tuple[str, List[str]]:
        results = self.search_context(workspace_id, query, document_id=document_id, top_k=top_k)

        logger.info(
            f"[RAG] Executing Query | Workspace: {workspace_id} | Document: {document_id} | "
            f"QueryChars: {len(query)} | RetrievedChunks: {len(results)} | "
            f"ChunkIds: {[r.get('id') for r in results]} | "
            f"Scores: {[round(r.get('score', 0.0), 3) for r in results]}"
        )

        if not results:
            return self._build_grounded_refusal(document_name), []

        system_prompt, user_prompt, sources = self._assemble_prompt(
            query, results, document_name=document_name, history=history
        )

        try:
            answer = await ai_gateway.generate(
                task=AIWorkload.PDF_ANALYSIS,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=800
            )
            logger.info(f"[RAG] Query succeeded | Document: {document_id} | AnswerLength: {len(answer)}")
            return answer, sources
        except Exception as e:
            logger.warning(f"AI generation error during PDF Q&A: {e}")
            first_chunk_text = results[0].get("text", "")[:200] if results else "N/A"
            sources_summary = "\n".join(f"- {s.split(']:')[0]}]" for s in sources[:3])
            fallback = (
                f"I found relevant passages in your document, but AI response generation encountered a temporary issue ({e}).\n\n"
                "Please retry in a moment."
            )
            return fallback, sources

    def run_diagnostics(
        self,
        workspace_id: str,
        document_id: str,
        sample_query: str = "summary concepts"
    ) -> Dict[str, Any]:
        """Provides transparency and verification of vector indexing and retrieval."""
        query_vector = self.embedder.embed_query(sample_query)
        norm = sum(x * x for x in query_vector) ** 0.5
        results = self.search_context(workspace_id, sample_query, document_id=document_id, top_k=5)

        points_count = 0
        if self.vectorstore.client:
            try:
                col_info = self.vectorstore.client.get_collection(self.vectorstore.collection_name)
                points_count = col_info.points_count or 0
            except Exception:
                points_count = len(self.vectorstore._in_memory_store)

        return {
            "embeddingModel": getattr(self.embedder, "_backend", "fastembed") + " (sentence-transformers/all-MiniLM-L6-v2)",
            "vectorDimension": self.embedder.dimension,
            "qdrantCollection": self.vectorstore.collection_name,
            "indexedPointsCount": points_count,
            "sampleQuery": sample_query,
            "queryVectorNorm": round(norm, 4),
            "retrievalResultCount": len(results),
            "retrievedChunkIds": [r["id"] for r in results],
            "retrievedChunkScores": [round(r["score"], 4) for r in results]
        }

    async def ask_question_stream(
        self,
        workspace_id: str,
        document_id: str,
        query: str,
        top_k: int = 5,
        document_name: str = "Uploaded Document",
        history: List[Dict[str, str]] = None
    ) -> AsyncGenerator[str, None]:
        results = self.search_context(workspace_id, query, document_id=document_id, top_k=top_k)

        logger.info(
            f"[RAG-STREAM] Executing Query | Workspace: {workspace_id} | Document: {document_id} | "
            f"QueryChars: {len(query)} | RetrievedChunks: {len(results)} | "
            f"Scores: {[round(r.get('score', 0.0), 3) for r in results]}"
        )

        if not results:
            refusal = self._build_grounded_refusal(document_name)
            # Yield in natural token chunks
            for chunk in refusal.split(" "):
                yield chunk + " "
            return

        system_prompt, user_prompt, _ = self._assemble_prompt(
            query, results, document_name=document_name, history=history
        )

        try:
            async for token in ai_gateway.generate_stream(
                task=AIWorkload.PDF_ANALYSIS,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.2,
                max_tokens=800
            ):
                yield token
        except Exception as e:
            logger.warning(f"[RAG-STREAM] Stream generation error: {e}")
            yield f"\n\n*(Response generation interrupted: {e})*"

    def delete_document_vectors(self, workspace_id: str, document_id: str):
        self.vectorstore.delete_document_vectors(workspace_id, document_id)

rag_pipeline = RagPipeline()
