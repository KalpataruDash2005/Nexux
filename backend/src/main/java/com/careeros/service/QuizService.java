package com.careeros.service;

import com.careeros.entity.Quiz;
import com.careeros.entity.QuizQuestion;
import com.careeros.entity.User;
import com.careeros.entity.Workspace;
import com.careeros.exception.BadRequestException;
import com.careeros.repository.QuizQuestionRepository;
import com.careeros.repository.QuizRepository;
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
public class QuizService {

    private final QuizRepository quizRepository;
    private final QuizQuestionRepository quizQuestionRepository;
    private final WorkspaceRepository workspaceRepository;
    private final UserRepository userRepository;
    private final EmbeddingStore<TextSegment> embeddingStore;
    private final EmbeddingModel embeddingModel;
    private final ChatLanguageModel chatLanguageModel;
    private final ObjectMapper objectMapper;

    public Quiz generateQuiz(String ownerEmail, String workspaceId, String topic, String difficulty, int count) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        Workspace workspace = workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        // 1. Pull relevant chunks about the topic
        dev.langchain4j.data.embedding.Embedding topicEmbedding = embeddingModel.embed(topic).content();
        Filter workspaceFilter = MetadataFilterBuilder.metadataKey("workspace_id").isEqualTo(workspaceId);

        EmbeddingSearchRequest request = EmbeddingSearchRequest.builder()
                .queryEmbedding(topicEmbedding)
                .maxResults(15) 
                .filter(workspaceFilter)
                .build();

        EmbeddingSearchResult<TextSegment> searchResult = embeddingStore.search(request);

        if (searchResult.matches().isEmpty()) {
            throw new BadRequestException("No relevant documents found in workspace to generate quiz from.");
        }

        String context = searchResult.matches().stream()
                .map(match -> "Doc: " + match.embedded().metadata().getString("document_name") + "\nText: " + match.embedded().text())
                .collect(Collectors.joining("\n\n"));

        // 2. Ask LLM to generate JSON
        String prompt = "You are an academic Quiz generator. Generate exactly " + count + " questions based ONLY on the following context.\n" +
                "Difficulty: " + difficulty + "\n" +
                "Return ONLY a valid JSON array of objects, with no markdown formatting, no backticks, and no extra text.\n" +
                "Each object must have the keys: 'type' (MCQ, TRUE_FALSE, SHORT_ANSWER), 'question' (string), 'options' (a JSON array of 4 strings for MCQ, or null otherwise), 'correct_answer' (string), 'citation' (string containing the document name and summary of context).\n\n" +
                "Context:\n" + context;

        String jsonResponse = chatLanguageModel.generate(prompt);

        try {
            if (jsonResponse.startsWith("`json")) {
                jsonResponse = jsonResponse.substring(7, jsonResponse.length() - 3).trim();
            }

            List<Map<String, Object>> questionsData = objectMapper.readValue(jsonResponse, new TypeReference<List<Map<String, Object>>>(){});

            Quiz quiz = Quiz.builder()
                    .workspace(workspace)
                    .title(topic + " Quiz")
                    .difficulty(difficulty)
                    .build();
            quiz = quizRepository.save(quiz);

            Quiz finalQuiz = quiz;
            List<QuizQuestion> questions = questionsData.stream().map(data -> {
                String optionsStr = null;
                try {
                    if (data.get("options") != null) {
                        optionsStr = objectMapper.writeValueAsString(data.get("options"));
                    }
                } catch (Exception ignored) {}

                return QuizQuestion.builder()
                        .quiz(finalQuiz)
                        .type((String) data.get("type"))
                        .question((String) data.get("question"))
                        .optionsJson(optionsStr)
                        .correctAnswer((String) data.get("correct_answer"))
                        .citation((String) data.get("citation"))
                        .build();
            }).collect(Collectors.toList());

            quizQuestionRepository.saveAll(questions);
            return quiz;

        } catch (Exception e) {
            log.error("Failed to parse LLM quiz output: " + jsonResponse, e);
            throw new BadRequestException("Failed to generate quiz due to parsing error. Try again.");
        }
    }

    public List<Quiz> getQuizzes(String ownerEmail, String workspaceId) {
        User owner = userRepository.findByEmail(ownerEmail)
                .orElseThrow(() -> new BadRequestException("User not found"));

        workspaceRepository.findByIdAndOwnerId(workspaceId, owner.getId())
                .orElseThrow(() -> new BadRequestException("Workspace not found or access denied"));

        return quizRepository.findByWorkspaceIdOrderByCreatedAtDesc(workspaceId);
    }
}
