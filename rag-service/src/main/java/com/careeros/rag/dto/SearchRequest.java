package com.careeros.rag.dto;

public class SearchRequest {
    private String workspaceId;
    private String documentId;
    private String query;
    private Integer topK = 5;
    private String questionType;
    private String questionComplexity;

    public String getQuestionComplexity() {
        return questionComplexity;
    }

    public void setQuestionComplexity(String questionComplexity) {
        this.questionComplexity = questionComplexity;
    }

    public String getQuestionType() {
        return questionType;
    }

    public void setQuestionType(String questionType) {
        this.questionType = questionType;
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

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public Integer getTopK() {
        return topK;
    }

    public void setTopK(Integer topK) {
        this.topK = topK;
    }
}
