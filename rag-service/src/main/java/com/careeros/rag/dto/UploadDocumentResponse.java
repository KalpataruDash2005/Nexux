package com.careeros.rag.dto;

public class UploadDocumentResponse {
    private String status;
    private String workspaceId;
    private String documentId;
    private String fileName;
    private int extractedCharacters;
    private int chunksIndexed;

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getWorkspaceId() { return workspaceId; }
    public void setWorkspaceId(String workspaceId) { this.workspaceId = workspaceId; }

    public String getDocumentId() { return documentId; }
    public void setDocumentId(String documentId) { this.documentId = documentId; }

    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }

    public int getExtractedCharacters() { return extractedCharacters; }
    public void setExtractedCharacters(int extractedCharacters) { this.extractedCharacters = extractedCharacters; }

    public int getChunksIndexed() { return chunksIndexed; }
    public void setChunksIndexed(int chunksIndexed) { this.chunksIndexed = chunksIndexed; }

    private String summary;
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
}
