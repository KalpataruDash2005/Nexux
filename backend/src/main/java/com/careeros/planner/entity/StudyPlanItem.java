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
@Table(name = "planner_study_items")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudyPlanItem {

    @Id
    @Column(name = "id", updatable = false, nullable = false, length = 36)
    private String id;

    @ManyToOne
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(name = "plan_date", nullable = false)
    private LocalDate planDate;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "hours", nullable = false)
    private Double hours;

    @Column(name = "session_type", nullable = false, length = 50)
    private String sessionType;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        if (hours == null) {
            hours = 1.0;
        }
        if (sessionType == null) {
            sessionType = "STUDY";
        }
        createdAt = LocalDateTime.now();
    }
}
