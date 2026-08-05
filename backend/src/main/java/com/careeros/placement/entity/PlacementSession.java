package com.careeros.placement.entity;

import com.careeros.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "placement_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlacementSession {

    @Id
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "type", nullable = false, length = 30)
    private String type;

    @Column(name = "mode", nullable = false, length = 20)
    private String mode;

    @Column(name = "role", length = 100)
    private String role;

    @Column(name = "company", length = 100)
    private String company;

    @Column(name = "difficulty", length = 20)
    private String difficulty;

    @Column(name = "topic", length = 100)
    private String topic;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "score")
    private Integer score;

    @Column(name = "payload_json", columnDefinition = "LONGTEXT")
    private String payloadJson;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "ended_at")
    private LocalDateTime endedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (mode == null || mode.isBlank()) {
            mode = "AI";
        }
        if (status == null || status.isBlank()) {
            status = "ACTIVE";
        }
        createdAt = LocalDateTime.now();
    }
}
