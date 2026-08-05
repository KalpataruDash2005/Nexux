package com.careeros.planner.repository;

import com.careeros.planner.entity.AcademicEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AcademicEventRepository extends JpaRepository<AcademicEvent, String> {

    List<AcademicEvent> findByOwnerIdOrderByEventDateAsc(String ownerId);

    List<AcademicEvent> findByOwnerIdAndEventDateGreaterThanEqualOrderByEventDateAsc(
            String ownerId, LocalDate from);

    List<AcademicEvent> findByOwnerIdAndEventDateLessThanEqualOrderByEventDateAsc(
            String ownerId, LocalDate to);

    List<AcademicEvent> findByOwnerIdAndEventDateGreaterThanEqualAndEventDateLessThanEqualOrderByEventDateAsc(
            String ownerId, LocalDate from, LocalDate to);

    List<AcademicEvent> findByOwnerIdAndEventDate(String ownerId, LocalDate date);

    List<AcademicEvent> findByOwnerIdAndCategoryOrderByEventDateAsc(String ownerId, String category);

    List<AcademicEvent> findByOwnerIdAndCompletedOrderByEventDateAsc(String ownerId, boolean completed);

    Optional<AcademicEvent> findByIdAndOwnerId(String id, String ownerId);

    long countByOwnerId(String ownerId);

    long countByOwnerIdAndCompleted(String ownerId, boolean completed);

    void deleteByOwnerId(String ownerId);
}
