package com.careeros.dto.document;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class DocumentResponseDto {
    private String id;
    private String workspaceId;
    private String name;
    private String type;
    private Long sizeBytes;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
