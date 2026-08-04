package com.careeros.dto.workspace;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkspaceStatsDto {
    private long totalDocuments;
    private long totalPages;
    private long totalChunks;
    private long storageUsedBytes;
    private long totalConversations;
}
