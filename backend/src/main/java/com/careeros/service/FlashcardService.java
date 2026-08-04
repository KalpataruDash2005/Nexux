package com.careeros.service;

import com.careeros.entity.Flashcard;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.FlashcardRepository;
import com.careeros.repository.UserRepository;
import com.careeros.repository.WorkspaceRepository;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.store.embedding.EmbeddingStore;
import dev.langchain4j.store.embedding.EmbeddingSearchRequest;
import dev.langchain4j.store.embedding.EmbeddingSearchResult;
import dev.langchain4j.store.embedding.filter.Filter;
import dev.langchain4j.store.embedding.filter.MetadataFilterBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class FlashcardService {

    private final FlashcardRepository flashcardRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;
    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper;

    private static final int MAX_RETRIES = 5;

    public List<Flashcard> generateFlashcards(String ownerEmail, String workspaceId, String topic, int count) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        // 1. Pull relevant chunks about the topic
        dev.langchain4j.data.embedding.Embedding topicEmbedding = embeddingModel.embed(topic).content();
        Filter workspaceFilter = MetadataFilterBuilder.metadataKey("workspace_id").isEqualTo(workspaceId);

        EmbeddingSearchRequest request = EmbeddingSearchRequest.builder()
                .queryEmbedding(topicEmbedding)
                .maxResults(10) // pull a lot of context for flashcard gen
                .filter(workspaceFilter)
                .build();

        EmbeddingSearchResult<TextSegment> searchResult = embeddingStore.search(request);

        if (searchResult.matches().isEmpty()) {
            throw new BadRequestException("No relevant documents found in workspace to generate flashcards from.");
        }

        String context = searchResult.matches().stream()
                .map(match -> "Doc: " + match.embedded().metadata().getString("document_name") + "\nText: " + match.embedded().text())
                .collect(Collectors.joining("\n\n"));

        // 2. Ask LLM to generate JSON
        String prompt = "You are an academic flashcard generator. Generate exactly " + count + " flashcards based ONLY on the following context.\n" +
                "Return ONLY a valid JSON array of objects, with no markdown formatting, no backticks, and no extra text.\n" +
                "Each object must have the following keys: 'front', 'back', 'difficulty' (EASY, MEDIUM, HARD), 'document_id' (if available, else null).\n\n" +
                "Context:\n" + context;

        String jsonResponse = chatLanguageModel.generate(prompt);

        try {
            // Cleanup just in case Groq added backticks
            if (jsonResponse.startsWith("`json")) {
                jsonResponse = jsonResponse.substring(7, jsonResponse.length() - 3).trim();
            }

            List<Map<String, String>> cardsData = objectMapper.readValue(jsonResponse, new TypeReference<List<Map<String, String>>>(){});

            List<Flashcard> flashcards = cardsData.stream().map(data -> Flashcard.builder()
                    .workspace(workspace)
                    .front(data.get("front"))
                    .back(data.get("back"))
                    .difficulty(data.get("difficulty") != null ? data.get("difficulty").toUpperCase() : "MEDIUM")
                    .documentId(data.get("document_id"))
                    .build()
            ).collect(Collectors.toList());

            return flashcardRepository.saveAll(flashcards);

        } catch (Exception e) {
            log.error("Failed to parse LLM flashcard output: " + jsonResponse, e);
            throw new BadRequestException("Failed to generate flashcards due to parsing error. Try again.");
        }
    }

    public List<Flashcard> getFlashcards(String ownerEmail, String workspaceId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        return flashcardRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
    }

    public void deleteFlashcard(String ownerEmail, String workspaceId, String flashcardId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        flashcardRepository.deleteById(flashcardId);
    }
}
