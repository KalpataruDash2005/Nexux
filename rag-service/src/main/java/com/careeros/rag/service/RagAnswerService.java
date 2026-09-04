package com.careeros.rag.service;

import com.careeros.rag.dto.AskRequest;
import com.careeros.rag.dto.AskResponse;
import com.careeros.rag.dto.SearchRequest;
import com.careeros.rag.dto.SearchResponse;
import com.careeros.rag.dto.SearchResult;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class RagAnswerService {

    private static final Logger log = LoggerFactory.getLogger(RagAnswerService.class);

    private final RagSearchService searchService;
    private final ChatLanguageModel chatLanguageModel;
    private final StreamingChatLanguageModel streamingChatLanguageModel;

    @Value("${llm.provider:groq}")
    private String llmProvider;

    @Value("${llm.groq.model:llama3-8b-8192}")
    private String groqModel;

    public RagAnswerService(RagSearchService searchService,
                            ChatLanguageModel chatLanguageModel,
                            StreamingChatLanguageModel streamingChatLanguageModel) {
        this.searchService = searchService;
        this.chatLanguageModel = chatLanguageModel;
        this.streamingChatLanguageModel = streamingChatLanguageModel;
    }

    private boolean isBroadQuery(String query) {
        String lowerQuery = query.toLowerCase();
        return lowerQuery.contains("what is this document about") ||
               lowerQuery.contains("summarize this document") ||
               lowerQuery.contains("summarize this pdf") ||
               lowerQuery.contains("give an overview") ||
               lowerQuery.contains("what topics are covered") ||
               lowerQuery.contains("explain major topics") ||
               lowerQuery.contains("overview of this document") ||
               lowerQuery.contains("explain all the major topics");
    }

    private String determineComplexity(String query) {
        String lowerQuery = query.toLowerCase();
        if (lowerQuery.contains("explain all") || lowerQuery.contains("explain each") ||
            lowerQuery.contains("types of") || lowerQuery.contains("in detail") ||
            lowerQuery.contains("major topics") || lowerQuery.contains("advantages and disadvantages") ||
            lowerQuery.contains("explain") || lowerQuery.contains("detail") || 
            lowerQuery.contains("describe") || lowerQuery.contains("examples") || 
            lowerQuery.contains("compare") || lowerQuery.contains("difference") || 
            lowerQuery.contains("elaborate")) {
            return "DETAILED";
        }
        if (lowerQuery.split(" ").length > 7) {
            return "MEDIUM";
        }
        return "SIMPLE";
    }

    private int getTopKForComplexity(String complexity) {
        switch (complexity) {
            case "DETAILED": return 12;
            case "MEDIUM": return 8;
            case "SIMPLE": 
            default: return 5;
        }
    }

    private String buildPrompt(String query, String context, String complexity) {
        StringBuilder sb = new StringBuilder();
        sb.append("You must use the provided document context as the primary source.\n\n");
        sb.append("For questions asking about the document, summarize and explain only information supported by the provided context.\n");
        sb.append("For educational conceptual questions, if the context explains a concept but does not provide a concrete example, you may provide a simple, clearly educational general example.\n");
        sb.append("Do not fabricate claims about the uploaded document.\n");
        sb.append("Never return 'Information not available' when relevant context exists. Instead synthesize the available context into the best complete answer.\n\n");
        
        if ("DETAILED".equals(complexity)) {
            sb.append("The user asked for a detailed explanation. Provide a structured, comprehensive answer.\n");
            sb.append("Use clear formatting such as headings, numbered lists, and bullet points where appropriate.\n");
            sb.append("If the user asks for multiple items (e.g. 'each type'), explain EVERY requested item individually in detail.\n\n");
        } else if ("MEDIUM".equals(complexity)) {
            sb.append("The user asked for an explanation. Explain the concept thoroughly using the retrieved context.\n\n");
        } else {
            sb.append("The user asked a simple question. Answer clearly and directly.\n\n");
        }

        sb.append("Context:\n").append(context).append("\n\n");
        sb.append("Question:\n").append(query).append("\n\n");
        sb.append("Answer:\n");
        return sb.toString();
    }

    private List<SearchResult> deduplicateAndSort(List<SearchResult> searchResults) {
        return searchResults.stream()
                .collect(Collectors.toMap(SearchResult::getText, res -> res, (existing, replacement) -> existing))
                .values()
                .stream()
                .sorted(Comparator.comparing(SearchResult::getDocumentId)
                                  .thenComparing(SearchResult::getChunkIndex))
                .collect(Collectors.toList());
    }

    public AskResponse ask(AskRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getWorkspaceId() == null || request.getWorkspaceId().trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            throw new IllegalArgumentException("query must not be blank");
        }

        boolean broadQuery = isBroadQuery(request.getQuery());
        String questionType = broadQuery ? "BROAD_DOCUMENT" : "SEMANTIC";
        String complexity = determineComplexity(request.getQuery());
        int effectiveTopK = getTopKForComplexity(complexity);

        log.info("QUESTION_RECEIVED");
        log.info("QUESTION = {}", request.getQuery());
        log.info("DOCUMENT_ID = {}", request.getDocumentId());
        log.info("WORKSPACE_ID = {}", request.getWorkspaceId());
        log.info("QUESTION_TYPE = {}", questionType);
        log.info("QUESTION_COMPLEXITY = {}", complexity);

        SearchRequest searchReq = new SearchRequest();
        searchReq.setWorkspaceId(request.getWorkspaceId());
        searchReq.setDocumentId(request.getDocumentId());
        searchReq.setQuery(request.getQuery());
        searchReq.setTopK(effectiveTopK);
        searchReq.setQuestionType(questionType);
        searchReq.setQuestionComplexity(complexity);

        long searchStart = System.currentTimeMillis();
        SearchResponse searchResp = searchService.search(searchReq);
        List<SearchResult> rawSearchResults = searchResp.getResults();
        long searchDuration = System.currentTimeMillis() - searchStart;
        log.info("RETRIEVAL_TIME_MS = {}", searchDuration);
        
        List<SearchResult> searchResults = deduplicateAndSort(rawSearchResults);
        
        log.info("QDRANT_RESULTS_COUNT = {}", rawSearchResults.size());
        

        if (searchResults.isEmpty()) {
            log.info("No relevant chunks found. Returning safe fallback response.");
            AskResponse response = new AskResponse();
            response.setStatus("SUCCESS");
            response.setAnswer("I'm sorry, but I couldn't find any relevant information in the uploaded documents to answer your question.");
            response.setSources(List.of());
            return response;
        }

        long contextStart = System.currentTimeMillis();
        String context = searchResults.stream()
                .map(SearchResult::getText)
                .collect(Collectors.joining("\n\n"));

        List<String> sources = searchResults.stream()
                .map(res -> res.getDocumentId() + " (chunk " + res.getChunkIndex() + ")")
                .distinct()
                .collect(Collectors.toList());
        long contextDuration = System.currentTimeMillis() - contextStart;
        log.info("CONTEXT_BUILD_TIME_MS = {}", contextDuration);

        log.info("CONTEXT_LENGTH = {}", context.length());
        if (context.length() > 0) {
            log.info("CONTEXT_PREVIEW = {}", context.substring(0, Math.min(context.length(), 200)).replace("\n", " "));
        }

        String prompt = buildPrompt(request.getQuery(), context, complexity);

        String answer;
        long llmStart = System.currentTimeMillis();
        try {
            log.info("LLM_PROVIDER = {}", llmProvider.toUpperCase());
            answer = chatLanguageModel.generate(prompt);
            long llmDuration = System.currentTimeMillis() - llmStart;
            log.info("LLM_FIRST_RESPONSE_TIME_MS = {}", llmDuration);
            log.info("LLM_TOTAL_TIME_MS = {}", llmDuration);
        } catch (Exception e) {
            log.error("LLM generation failed", e);
            throw new RuntimeException("Failed to generate answer from LLM: " + e.getMessage(), e);
        }

        AskResponse response = new AskResponse();
        response.setStatus("SUCCESS");
        response.setAnswer(answer);
        response.setSources(sources);

        long totalDuration = System.currentTimeMillis() - startTime;
        log.info("TOTAL_REQUEST_TIME_MS = {}", totalDuration);

        return response;
    }

    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter askStream(AskRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getWorkspaceId() == null || request.getWorkspaceId().trim().isEmpty()) {
            throw new IllegalArgumentException("workspaceId must not be blank");
        }
        if (request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            throw new IllegalArgumentException("query must not be blank");
        }

        boolean broadQuery = isBroadQuery(request.getQuery());
        String questionType = broadQuery ? "BROAD_DOCUMENT" : "SEMANTIC";
        String complexity = determineComplexity(request.getQuery());
        int effectiveTopK = getTopKForComplexity(complexity);

        log.info("QUESTION_RECEIVED");
        log.info("QUESTION = {}", request.getQuery());
        log.info("DOCUMENT_ID = {}", request.getDocumentId());
        log.info("WORKSPACE_ID = {}", request.getWorkspaceId());
        log.info("QUESTION_TYPE = {}", questionType);
        log.info("QUESTION_COMPLEXITY = {}", complexity);

        SearchRequest searchReq = new SearchRequest();
        searchReq.setWorkspaceId(request.getWorkspaceId());
        searchReq.setDocumentId(request.getDocumentId());
        searchReq.setQuery(request.getQuery());
        searchReq.setTopK(effectiveTopK);
        searchReq.setQuestionType(questionType);
        searchReq.setQuestionComplexity(complexity);

        long searchStart = System.currentTimeMillis();
        SearchResponse searchResp = searchService.search(searchReq);
        List<SearchResult> rawSearchResults = searchResp.getResults();
        long searchDuration = System.currentTimeMillis() - searchStart;
        log.info("RETRIEVAL_TIME_MS = {}", searchDuration);
        
        List<SearchResult> searchResults = deduplicateAndSort(rawSearchResults);

        log.info("QDRANT_RESULTS_COUNT = {}", rawSearchResults.size());
        

        org.springframework.web.servlet.mvc.method.annotation.SseEmitter emitter = new org.springframework.web.servlet.mvc.method.annotation.SseEmitter(600000L); // 10 minutes timeout

        if (searchResults.isEmpty()) {
            log.info("No relevant chunks found. Returning safe fallback response stream.");
            try {
                emitter.send(java.util.Map.of("token", "I'm sorry, but I couldn't find any relevant information in the uploaded documents to answer your question."));
                emitter.complete();
            } catch (Exception e) {
                emitter.completeWithError(e);
            }
            return emitter;
        }

        long contextStart = System.currentTimeMillis();
        String context = searchResults.stream()
                .map(SearchResult::getText)
                .collect(Collectors.joining("\n\n"));
        long contextDuration = System.currentTimeMillis() - contextStart;
        log.info("CONTEXT_BUILD_TIME_MS = {}", contextDuration);

        log.info("CONTEXT_LENGTH = {}", context.length());
        if (context.length() > 0) {
            log.info("CONTEXT_PREVIEW = {}", context.substring(0, Math.min(context.length(), 200)).replace("\n", " "));
        }

        String prompt = buildPrompt(request.getQuery(), context, complexity);

        log.info("LLM_PROVIDER = {}", llmProvider.toUpperCase());
        if ("GROQ".equalsIgnoreCase(llmProvider)) {
            log.info("GROQ_BASE_URL = https://api.groq.com/openai/v1");
            log.info("GROQ_MODEL = {}", groqModel);
            log.info("GROQ_STREAM_REQUEST_STARTED");
        }
        
        long llmStart = System.currentTimeMillis();
        streamingChatLanguageModel.generate(prompt, new dev.langchain4j.model.StreamingResponseHandler<dev.langchain4j.data.message.AiMessage>() {
            private boolean firstTokenSent = false;
            
            @Override
            public void onNext(String token) {
                if (!firstTokenSent) {
                    long ttft = System.currentTimeMillis() - llmStart;
                    log.info("LLM_FIRST_RESPONSE_TIME_MS = {}", ttft);
                    if ("GROQ".equalsIgnoreCase(llmProvider)) {
                        log.info("GROQ_FIRST_TOKEN_RECEIVED");
                    }
                    firstTokenSent = true;
                }
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    String json = mapper.writeValueAsString(java.util.Map.of("token", token));
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().data(json));
                } catch (Exception e) {
                    emitter.completeWithError(e);
                }
            }

            @Override
            public void onComplete(dev.langchain4j.model.output.Response<dev.langchain4j.data.message.AiMessage> response) {
                if ("GROQ".equalsIgnoreCase(llmProvider)) {
                    log.info("GROQ_STREAM_COMPLETED");
                }
                long llmDuration = System.currentTimeMillis() - llmStart;
                log.info("LLM_TOTAL_TIME_MS = {}", llmDuration);
                long totalDuration = System.currentTimeMillis() - startTime;
                log.info("TOTAL_REQUEST_TIME_MS = {}", totalDuration);
                emitter.complete();
            }

            @Override
            public void onError(Throwable error) {
                if ("GROQ".equalsIgnoreCase(llmProvider)) {
                    log.error("GROQ_API_ERROR = {}", error.getMessage());
                }
                log.error("Streaming LLM generation failed", error);
                
                if (error instanceof NullPointerException && 
                    error.getMessage() != null && 
                    error.getMessage().contains("Response.content()")) {
                    log.warn("Caught known LangChain4j Groq streaming NPE, gracefully completing stream.");
                    if ("GROQ".equalsIgnoreCase(llmProvider)) {
                        log.info("GROQ_STREAM_COMPLETED");
                    }
                    emitter.complete();
                    return;
                }
                
                try {
                    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                    String json = mapper.writeValueAsString(java.util.Map.of("token", "\n\n[Error: " + error.getMessage() + "]"));
                    emitter.send(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.event().data(json));
                } catch (Exception e) {
                    // ignore
                }
                emitter.complete();
            }
        });

        return emitter;
    }
}
