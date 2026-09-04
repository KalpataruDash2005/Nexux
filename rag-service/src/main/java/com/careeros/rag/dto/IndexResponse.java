package com.careeros.rag.dto;

public class IndexResponse {
    private String status;
    private String workspaceId;
    private String documentId;
    private int chunksIndexed;

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getWorkspaceId() {
        return workspaceId;
    }

    public void setWorkspaceId(String workspaceId) {
        this.workspaceId = workspaceId;
    }

    public String getDocumentId() {
        return documentId;
    }

    public void setDocumentId(String documentId) {
        this.documentId = documentId;
    }

    public int getChunksIndexed() {
        return chunksIndexed;
    }

    public void setChunksIndexed(int chunksIndexed) {
        this.chunksIndexed = chunksIndexed;
    }
}
