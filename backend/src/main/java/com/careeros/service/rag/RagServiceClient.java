package com.careeros.service.rag;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

@Service
@Slf4j
public class RagServiceClient {

    private final RestClient restClient;

    public RagServiceClient(
            RestClient.Builder restClientBuilder,
            @Value("${app.rag.service-url:http://localhost:8081}") String baseUrl
    ) {

        // RAG indexing can take 30-120 seconds for PDFs.
        // Default timeout is not enough.
        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(10_000);   // 10 seconds
        requestFactory.setReadTimeout(180_000);     // 3 minutes

        this.restClient = restClientBuilder
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();

        log.info("RAG Service Client initialized with URL: {}", baseUrl);
    }

    // ============================================================
    // UPLOAD DOCUMENT USING MULTIPART FILE
    // ============================================================

    public UploadDocumentResponse uploadDocument(
            String workspaceId,
            String documentId,
            MultipartFile file
    ) {

        log.info(
                "Uploading document {} for workspace {} to RAG service",
                documentId,
                workspaceId
        );

        File tempFile = null;

        try {

            String originalFilename = file.getOriginalFilename();

            if (originalFilename == null || originalFilename.isBlank()) {
                originalFilename = "document.pdf";
            }

            tempFile = File.createTempFile(
                    "rag-upload-",
                    "-" + originalFilename
            );

            file.transferTo(tempFile);

            log.info(
                    "Temporary file created: {} ({} bytes)",
                    tempFile.getAbsolutePath(),
                    tempFile.length()
            );

            org.springframework.http.client.MultipartBodyBuilder builder = new org.springframework.http.client.MultipartBodyBuilder();
            builder.part("workspaceId", workspaceId);
            builder.part("documentId", documentId);
            builder.part("file", new FileSystemResource(tempFile))
                   .filename(originalFilename);

            UploadDocumentResponse response = restClient
                    .post()
                    .uri("/api/rag/documents/upload")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(builder.build())
                    .retrieve()
                    .body(UploadDocumentResponse.class);

            log.info(
                    "RAG service successfully processed document {}",
                    documentId
            );

            return response;

        } catch (Exception e) {

            log.error(
                    "Failed to upload document {} to RAG service",
                    documentId,
                    e
            );

            throw new RuntimeException(
                    "RAG Service upload failed: " + e.getMessage(),
                    e
            );

        } finally {

            // Always delete temporary file
            if (tempFile != null && tempFile.exists()) {

                boolean deleted = tempFile.delete();

                if (deleted) {
                    log.debug(
                            "Temporary file deleted: {}",
                            tempFile.getAbsolutePath()
                    );
                } else {
                    log.warn(
                            "Could not delete temporary file: {}",
                            tempFile.getAbsolutePath()
                    );
                }
            }
        }
    }


    // ============================================================
    // UPLOAD DOCUMENT USING FILE PATH
    // ============================================================

    public UploadDocumentResponse uploadDocument(
            String workspaceId,
            String documentId,
            Path filePath,
            String originalName
    ) {

        log.info(
                "Uploading document file {} for workspace {}",
                documentId,
                workspaceId
        );

        try {

            org.springframework.http.client.MultipartBodyBuilder builder = new org.springframework.http.client.MultipartBodyBuilder();
            builder.part("workspaceId", workspaceId);
            builder.part("documentId", documentId);
            builder.part("file", new FileSystemResource(filePath.toFile()))
                   .filename(originalName);

            UploadDocumentResponse response = restClient
                    .post()
                    .uri("/api/rag/documents/upload")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(builder.build())
                    .retrieve()
                    .body(UploadDocumentResponse.class);

            log.info(
                    "RAG service successfully processed document {}",
                    documentId
            );

            return response;

        } catch (Exception e) {

            log.error(
                    "Failed to upload document {} to RAG service",
                    documentId,
                    e
            );

            throw new RuntimeException(
                    "RAG Service upload failed: " + e.getMessage(),
                    e
            );
        }
    }


    // ============================================================
    // DELETE DOCUMENT
    // ============================================================

    public void deleteDocument(
            String workspaceId,
            String documentId
    ) {

        log.info(
                "Deleting document {} for workspace {} from RAG service",
                documentId,
                workspaceId
        );

        try {

            restClient
                    .delete()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/rag/documents/{documentId}")
                            .queryParam("workspaceId", workspaceId)
                            .build(documentId)
                    )
                    .retrieve()
                    .toBodilessEntity();

            log.info(
                    "Successfully deleted document {} from RAG service",
                    documentId
            );

        } catch (Exception e) {

            log.error(
                    "Failed to delete document {} from RAG service",
                    documentId,
                    e
            );
        }
    }


    // ============================================================
    // ASK QUESTION
    // ============================================================

    public AskResponse askQuestion(
            String workspaceId,
            String documentId,
            String query,
            int topK
    ) {

        log.info(
                "Asking RAG service question for document {} in workspace {}",
                documentId,
                workspaceId
        );

        try {

            AskRequest request = new AskRequest();
            request.setWorkspaceId(workspaceId);
            request.setDocumentId(documentId);
            request.setQuery(query);
            request.setTopK(topK);

            AskResponse response = restClient
                    .post()
                    .uri("/api/rag/ask")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(AskResponse.class);

            log.info(
                    "RAG service successfully answered query for workspace {}",
                    workspaceId
            );

            return response;

        } catch (Exception e) {

            log.error(
                    "Failed to ask RAG service",
                    e
            );

            throw new RuntimeException(
                    "RAG Service ask failed: " + e.getMessage(),
                    e
            );
        }
    }

    // ============================================================
    // ASK QUESTION STREAM
    // ============================================================

    public void askQuestionStream(
            String workspaceId,
            String documentId,
            String query,
            int topK,
            java.util.function.Consumer<String> onToken,
            Runnable onComplete,
            java.util.function.Consumer<Throwable> onError
    ) {
        log.info("Asking RAG service stream for document {} in workspace {}", documentId, workspaceId);

        try {
            AskRequest request = new AskRequest();
            request.setWorkspaceId(workspaceId);
            request.setDocumentId(documentId);
            request.setQuery(query);
            request.setTopK(topK);

            restClient.post()
                    .uri("/api/rag/ask/stream")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.TEXT_EVENT_STREAM)
                    .body(request)
                    .exchange((req, res) -> {
                        if (res.getStatusCode().isError()) {
                            throw new RuntimeException("Error from RAG service: " + res.getStatusCode());
                        }
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        try (java.io.InputStreamReader reader = new java.io.InputStreamReader(res.getBody(), java.nio.charset.StandardCharsets.UTF_8)) {
                            char[] charBuf = new char[1024];
                            int bytesRead;
                            StringBuilder buffer = new StringBuilder();
                            while ((bytesRead = reader.read(charBuf)) != -1) {
                                buffer.append(charBuf, 0, bytesRead);
                                
                                // Standardize CRLF to LF
                                String currentBuffer = buffer.toString().replace("\r\n", "\n");
                                buffer.setLength(0);
                                buffer.append(currentBuffer);
                                
                                int eventEndIndex;
                                while ((eventEndIndex = buffer.indexOf("\n\n")) != -1) {
                                    String eventString = buffer.substring(0, eventEndIndex);
                                    buffer.delete(0, eventEndIndex + 2);
                                    
                                    StringBuilder dataPayload = new StringBuilder();
                                    for (String eLine : eventString.split("\n")) {
                                        if (eLine.startsWith("data:")) {
                                            String data = eLine.substring(5);
                                            if (data.startsWith(" ")) data = data.substring(1);
                                            dataPayload.append(data);
                                        }
                                    }
                                    
                                    if (dataPayload.length() > 0) {
                                        try {
                                            String token = mapper.readTree(dataPayload.toString()).get("token").asText();
                                            log.info("BACKEND_RECEIVED=[{}] BACKEND_LENGTH={}", token, token.length());
                                            onToken.accept(token);
                                        } catch (Exception e) {
                                            log.error("Failed to parse SSE JSON payload in RagServiceClient: {}", dataPayload.toString(), e);
                                        }
                                    }
                                }
                            }
                        }
                        return null;
                    });
            
            onComplete.run();
        } catch (Exception e) {
            log.error("Failed to ask RAG service stream", e);
            onError.accept(e);
        }
    }


    // ============================================================
    // RESPONSE DTO
    // ============================================================

    @Data
    public static class UploadDocumentResponse {

        private String status;

        private String workspaceId;

        private String documentId;

        private String fileName;

        private Integer extractedCharacters;

        private Integer chunksIndexed;

        private String summary;
    }


    // ============================================================
    // ASK REQUEST DTO
    // ============================================================

    @Data
    public static class AskRequest {

        private String workspaceId;

        private String documentId;

        private String query;

        private Integer topK;
    }


    // ============================================================
    // ASK RESPONSE DTO
    // ============================================================

    @Data
    public static class AskResponse {

        private String status;

        private String answer;

        private List<String> sources;
    }
}