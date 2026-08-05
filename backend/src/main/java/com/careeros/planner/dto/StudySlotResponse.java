package com.careeros.planner.dto;

import com.careeros.planner.entity.StudyPlanItem;

import java.time.LocalTime;

public record StudySlotResponse(
        String id,
        LocalTime startTime,
        String subject,
        double hours,
        String sessionType,
        boolean completed
) {
    public static StudySlotResponse from(StudyPlanItem item) {
        return new StudySlotResponse(
                item.getId(),
                item.getStartTime(),
                item.getSubject(),
                item.getHours() == null ? 1.0 : item.getHours(),
                item.getSessionType(),
                item.isCompleted()
        );
    }
}
