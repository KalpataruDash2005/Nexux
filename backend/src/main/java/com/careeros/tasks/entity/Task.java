package com.careeros.tasks.entity;

import com.careeros.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Task {

    @Id
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "title", nullable = false, length = 255)
    private String title;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "progress_notes", columnDefinition = "TEXT")
    private String progressNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_task_id")
    private Task parentTask;

    @Column(name = "deadline")
    private LocalDateTime deadline;

    @Column(name = "estimated_hours", precision = 5, scale = 2)
    private BigDecimal estimatedHours;

    @Column(name = "remaining_hours", precision = 5, scale = 2)
    private BigDecimal remainingHours;

    @Column(name = "chunk_index")
    private Integer chunkIndex;

    @Column(name = "total_chunks")
    private Integer totalChunks;

    @Column(name = "ai_generated", nullable = false)
    private boolean aiGenerated;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "paused_at")
    private LocalDateTime pausedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "last_activity")
    private LocalDateTime lastActivity;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (status == null || status.isBlank()) {
            status = "PENDING";
        }
        createdAt = LocalDateTime.now();
    }
}
