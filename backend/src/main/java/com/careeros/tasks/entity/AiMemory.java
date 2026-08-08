package com.careeros.tasks.entity;

import com.careeros.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_memory")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiMemory {

    @Id
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "mem_key", nullable = false, length = 64)
    private String key;

    @Column(name = "mem_value", nullable = false, length = 500)
    private String value;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        updatedAt = LocalDateTime.now();
    }
}
