package com.careeros.dto.chat;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class ChatSessionResponseDto {
    private String id;
    private String workspaceId;
    private String title;
    private LocalDateTime createdAt;
}
