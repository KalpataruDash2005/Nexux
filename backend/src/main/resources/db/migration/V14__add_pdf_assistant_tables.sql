CREATE TABLE pdf_documents (
    id VARCHAR(36) NOT NULL,
    workspace_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(100),
    storage_key VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL,
    processing_source VARCHAR(20),
    summary TEXT,
    chunk_count INT,
    error_message TEXT,
    processed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pdf_documents PRIMARY KEY (id),
    CONSTRAINT fk_pdf_doc_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_doc_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE,
    INDEX idx_pdf_documents_workspace_owner (workspace_id, owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pdf_chat_messages (
    id VARCHAR(36) NOT NULL,
    document_id VARCHAR(36) NOT NULL,
    owner_id VARCHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_pdf_chat_messages PRIMARY KEY (id),
    CONSTRAINT fk_pdf_chat_document FOREIGN KEY (document_id) REFERENCES pdf_documents (id) ON DELETE CASCADE,
    CONSTRAINT fk_pdf_chat_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
