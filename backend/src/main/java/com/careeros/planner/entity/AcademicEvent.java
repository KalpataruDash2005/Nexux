package com.careeros.planner.entity;

import com.careeros.entity.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "academic_events")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AcademicEvent {

    @Id
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "event_date", nullable = false)
    private LocalDate eventDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "priority", nullable = false, length = 20)
    private String priority;

    @Column(name = "color", length = 20)
    private String color;

    @Column(name = "location", length = 255)
    private String location;

    @Column(name = "semester", length = 100)
    private String semester;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    @Column(name = "needs_verification", nullable = false)
    private boolean needsVerification;

    @Column(name = "ai_confidence")
    private Double aiConfidence;

    @Column(name = "source_file", length = 255)
    private String sourceFile;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (priority == null) {
            priority = "MEDIUM";
        }
        if (color == null) {
            color = defaultColor(category);
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public static String defaultColor(String category) {
        if (category == null) {
            return "#6366f1";
        }
        return switch (category.toUpperCase()) {
            case "EXAM", "EXTERNAL_EXAM", "INTERNAL_EXAM", "PRACTICAL_EXAM" -> "#ef4444";
            case "ASSIGNMENT", "SUBMISSION" -> "#f59e0b";
            case "HOLIDAY", "FESTIVAL", "VACATION" -> "#22c55e";
            case "WORKSHOP", "SEMINAR", "INDUSTRIAL_VISIT", "ORIENTATION" -> "#3b82f6";
            case "PLACEMENT" -> "#8b5cf6";
            case "PROJECT", "HACKATHON" -> "#f97316";
            case "SPORTS" -> "#10b981";
            case "CONVOCATION" -> "#ec4899";
            case "CLASS" -> "#6366f1";
            default -> "#6366f1";
        };
    }

    public static String inferPriority(String category) {
        if (category == null) {
            return "MEDIUM";
        }
        return switch (category.toUpperCase()) {
            case "EXAM", "EXTERNAL_EXAM", "INTERNAL_EXAM", "PRACTICAL_EXAM",
                 "ASSIGNMENT", "SUBMISSION", "PROJECT", "HACKATHON", "PLACEMENT" -> "HIGH";
            case "CLASS", "WORKSHOP", "SEMINAR", "INDUSTRIAL_VISIT", "ORIENTATION" -> "MEDIUM";
            default -> "LOW";
        };
    }
}
