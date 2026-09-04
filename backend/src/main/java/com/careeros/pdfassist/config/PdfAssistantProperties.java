package com.careeros.pdfassist.config;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Getter
public class PdfAssistantProperties {

    @Value("${app.pdf-assistant.n8n-enabled:true}")
    private boolean n8nEnabled;

    @Value("${app.pdf-assistant.n8n-webhook-url:http://localhost:5678}")
    private String n8nWebhookUrl;

    @Value("${app.pdf-assistant.n8n-api-key:}")
    private String n8nApiKey;

    @Value("${app.pdf-assistant.internal-key:careeros-pdf-internal}")
    private String internalKey;

    @Value("${app.pdf-assistant.storage-dir:./storage/pdf-assistant}")
    private String storageDir;

    @Value("${app.pdf-assistant.qdrant-host:127.0.0.1}")
    private String qdrantHost;

    @Value("${app.pdf-assistant.qdrant-port:6334}")
    private int qdrantPort;

    @Value("${app.pdf-assistant.qdrant-rest-port:6333}")
    private int qdrantRestPort;

    @Value("${app.pdf-assistant.qdrant-collection:careeros_pdf_chunks}")
    private String qdrantCollection;

    @Value("${app.pdf-assistant.embedding-dimension:384}")
    private int embeddingDimension;

    @Value("${app.pdf-assistant.chunk-size:600}")
    private int chunkSize;

    @Value("${app.pdf-assistant.chunk-overlap:100}")
    private int chunkOverlap;

    @Value("${app.pdf-assistant.top-k:5}")
    private int topK;

    @Value("${app.pdf-assistant.min-score:0.30}")
    private double minScore;

    @Value("${app.qdrant-api-key:}")
    private String qdrantApiKey;

    @Value("${app.openai.api-key:your_default_key_here}")
    private String llmApiKey;

    @Value("${app.openai.base-url:https://api.groq.com/openai/v1}")
    private String llmBaseUrl;

    @Value("${app.openai.model:openai/gpt-oss-120b}")
    private String llmModel;
}
