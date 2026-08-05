package com.careeros.planner.repository;

import com.careeros.planner.entity.StudyPlanItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StudyPlanItemRepository extends JpaRepository<StudyPlanItem, String> {

    List<StudyPlanItem> findByOwnerIdAndPlanDateOrderByStartTimeAsc(String ownerId, LocalDate date);

    List<StudyPlanItem> findByOwnerIdAndPlanDateGreaterThanEqualOrderByPlanDateAscStartTimeAsc(
            String ownerId, LocalDate from);

    List<StudyPlanItem> findByOwnerIdAndPlanDateGreaterThanEqualAndPlanDateLessThanEqualOrderByPlanDateAsc(
            String ownerId, LocalDate from, LocalDate to);

    List<StudyPlanItem> findByOwnerIdAndPlanDateLessThanEqual(String ownerId, LocalDate to);

    void deleteByOwnerId(String ownerId);
}
